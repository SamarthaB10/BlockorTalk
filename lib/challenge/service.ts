import pg from 'pg';
import type { Action, Challenge, Reply, Turn } from './types.ts';
import { DISCLOSURE } from './recruiter.ts';
import { CALLERS, CALL_ORDER, CODE_REQUEST_LINES, FAKE_SECRETS } from './scenarios.ts';
import { mentionsSecret } from '../policy/normalize.mjs';

export class ChallengeError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

// Reject likely personal data before it reaches the model or stored transcript.
function safeText(text: string) {
  if (/\b(?:(?:my|the)\s+)?(?:pin|password|passcode|code|social security number|ssn|date of birth|birthday|address|phone number)\s*(?:is|:|=)\s*\S+/i.test(text)) return '[personal details removed]';
  return text.replace(/\b(?:\d[ -]?){7,}\b/g, '[details removed]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[details removed]')
    .replace(/\b(?:\d{1,2}[/-]){2}\d{2,4}\b/g, '[details removed]')
    .replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4}\b/gi, '[details removed]')
    .replace(/\b\d+\s+(?:[a-z]+\s+){1,5}(?:street|st|road|rd|drive|dr|avenue|ave|lane|ln|court|ct)\b/gi, '[details removed]');
}

/** Adds newly said fake secrets to `day.leaked` and returns them. Scores the original text, before redaction. */
function scanLeaks(day: Challenge, raw: string) {
  const added: string[] = [];
  for (const [key, value] of Object.entries(FAKE_SECRETS)) {
    if (key === 'live_code' && !day.codeVisible) continue;
    if (mentionsSecret(raw, key, value) && !day.leaked.includes(key)) { day.leaked.push(key); added.push(key); }
  }
  return added;
}

export function createChallengeService({ connectionString, reply, now = Date.now }: { connectionString: string; reply: Reply; now?: () => number }) {
  async function withClient<T>(work: (client: pg.Client) => Promise<T>) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    await client.connect();
    try { return await work(client); } finally { await client.end(); }
  }
  function end(day: Challenge, reason: Challenge['endReason']) {
    day.phase = 'verdict';
    day.endedAt = new Date(now()).toISOString();
    day.endReason = reason;
  }
  async function update(id: string, action?: Action) {
    return withClient(async client => {
      await client.query('BEGIN');
      try {
        const result = await client.query('SELECT state FROM tell_challenges WHERE id = $1 FOR UPDATE', [id]);
        if (!result.rowCount) throw new ChallengeError('This day was not found. Start a new challenge.', 404);
        const day = result.rows[0].state as Challenge;
        // Upgrade saved issue-5 days without losing their verdict or transcript.
        day.calls ??= day.verdict ? [{ callerId: 'recruiter', verdict: day.verdict, turns: day.turns, cost: 0, leaked: [] }] : [];
        day.leaked ??= [];
        day.codeVisible ??= false;
        day.callbackStep ??= 0;
        if (day.phase === 'complete' && day.callerId === 'recruiter') day.phase = 'between';
        if (day.phase === 'call' && now() - Date.parse(day.startedAt) >= 180000) end(day, 'time_cap');
        if (action?.type === 'reply' && day.phase === 'call') {
          const raw = action.text.trim();
          if (!raw || raw.length > 1000) throw new ChallengeError('Use a reply from 1 to 1,000 characters.', 400);
          // Score the original text before personal-data redaction. Only user turns count.
          const leakedNow = scanLeaks(day, raw);
          const text = safeText(raw);
          const at = new Date(now()).toISOString();
          day.turns.push({ role: 'user', text, at, ...(leakedNow.length ? { leaked: leakedNow } : {}) });
          day.replies += 1;
          if (/\bstop\s+drill\b/i.test(raw)) end(day, 'stop');
          else if (day.replies >= 12) end(day, 'reply_cap');
          else {
            const beats = CALLERS[day.callerId].beats;
            const options = beats[Math.min(day.replies - 1, beats.length - 1)];
            let answer: string = options[0];
            let source: Turn['source'] = 'script';
            if (text !== raw) answer = 'Quick pause: this is a practice call. Please do not use real personal details. Use only the fictional details on your scenario card.';
            else {
              try {
                const generated = await reply({ turns: day.turns, options });
                if (options.some(option => option === generated)) { answer = generated; source = 'nemotron'; }
              } catch (error) {
                console.warn('Challenge used a scripted reply:', error instanceof Error ? error.message : 'LLM unavailable');
              }
            }
            if (now() - Date.parse(day.startedAt) >= 180000) end(day, 'time_cap');
            else {
              day.turns.push({ role: 'assistant', text: answer, at: new Date(now()).toISOString(), source });
              if (day.callerId === 'fraud_team' && CODE_REQUEST_LINES.some(line => line === answer)) day.codeVisible = true;
            }
          }
        } else if (action?.type === 'reply' && day.phase !== 'verdict') {
          throw new ChallengeError('This call has ended.');
        } else if (action?.type === 'end' && day.phase === 'call') end(day, 'disconnect');
        else if (action?.type === 'verdict') {
          if (day.phase !== 'verdict') throw new ChallengeError('End the call before you give a verdict.');
          if (!['Real', 'Scam', 'Unverified'].includes(action.verdict)) throw new ChallengeError('Choose Real, Scam or Unverified.', 400);
          day.verdict = action.verdict;
          const cost = day.callerId === 'onboarding' && day.leaked.includes('gift_card_code') ? 350
            : day.callerId === 'fraud_team' && day.leaked.includes('live_code') ? 650 : 0;
          day.balance -= cost;
          if (day.callerId === 'fraud_team' && cost) day.bank = 'FAILED';
          if (day.callerId === 'recruiter' && (day.verdict === 'Real' || (day.verdict === 'Unverified' && day.events.some(event => event.surface === 'portal')))) day.interview = 'BOOKED';
          day.calls.push({ callerId: day.callerId, verdict: day.verdict, turns: day.turns, cost, leaked: day.leaked, startedAt: day.startedAt, endedAt: day.endedAt, endReason: day.endReason });
          day.phase = day.callerId === 'fraud_team' ? 'complete' : 'between';
        } else if (action?.type === 'voice_turns') {
          // Yui's browser-voice call is spoken, so its transcript only exists in the browser. Accept it once,
          // after the call has ended and before the verdict, so the reveal has something to show.
          if (day.phase !== 'verdict' || day.callerId !== 'recruiter' || day.turns.length > 2) throw new ChallengeError('This call has no voice transcript to save.');
          if (!Array.isArray(action.turns) || action.turns.length > 40) throw new ChallengeError('That voice transcript is too long.', 400);
          const start = Date.parse(day.startedAt);
          const span = Math.max(0, Date.parse(day.endedAt ?? day.startedAt) - start);
          const spoken = action.turns.filter(turn => (turn.role === 'assistant' || turn.role === 'user') && typeof turn.text === 'string' && turn.text.trim());
          // The disclosure and opening line are already in day.turns; drop spoken repeats of them.
          const fresh = spoken.filter(turn => !(turn.role === 'assistant' && (turn.text.includes('Tell practice call') || turn.text.includes('This is Yui from'))));
          fresh.forEach((turn, i) => {
            const raw = turn.text.trim().slice(0, 1000);
            const leaked = turn.role === 'user' ? scanLeaks(day, raw) : [];
            const at = new Date(start + Math.round(span * (i + 1) / (fresh.length + 1))).toISOString();
            day.turns.push(turn.role === 'user'
              ? { role: 'user', text: safeText(raw), at, ...(leaked.length ? { leaked } : {}) }
              : { role: 'assistant', text: raw, at, source: 'script' });
          });
          day.replies = day.turns.filter(turn => turn.role === 'user').length;
        } else if (action?.type === 'portal') {
          day.events.push({ type: 'Verify', surface: 'portal', at: new Date(now()).toISOString() });
          if (day.calls.some(call => call.callerId === 'recruiter' && call.verdict === 'Unverified')) day.interview = 'BOOKED';
        } else if (action?.type === 'next') {
          if (day.phase !== 'between') throw new ChallengeError('Give this caller a verdict before the next call.');
          const callerId = CALL_ORDER[CALL_ORDER.indexOf(day.callerId) + 1];
          const at = new Date(now()).toISOString();
          Object.assign(day, { callerId, phase: 'call', startedAt: at, endedAt: undefined, endReason: undefined, replies: 0, verdict: undefined, leaked: [], codeVisible: false,
            turns: [{ role: 'system', text: DISCLOSURE, at }, { role: 'assistant', text: CALLERS[callerId].opening, at, source: 'script' }] });
        } else if (action?.type === 'bank') {
          day.events.push({ type: 'Verify', surface: 'bank', at: new Date(now()).toISOString() });
        } else if (action?.type === 'callback_start') {
          if (day.callerId !== 'fraud_team' || day.phase === 'call') throw new ChallengeError('End the bank call before you call Corvanta.');
          if (!day.events.some(event => event.surface === 'bank')) throw new ChallengeError('Open your bank app first.');
          if (!day.callbackStep) day.callbackStep = 1;
        } else if (action?.type === 'callback_next') {
          if (!day.callbackStep) throw new ChallengeError('Call Corvanta first.');
          if (day.callbackStep < 3) {
            day.callbackStep += 1;
            if (day.callbackStep === 3) {
              day.events.push({ type: 'Verify', surface: 'callback', at: new Date(now()).toISOString() });
              if (!day.leaked.includes('live_code') && day.bank !== 'FAILED') day.bank = 'RESOLVED';
            }
          }
        }
        await client.query('UPDATE tell_challenges SET state = $2, updated_at = now() WHERE id = $1', [id, JSON.stringify(day)]);
        await client.query('COMMIT');
        return day;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    });
  }
  return {
    async start(): Promise<Challenge> {
      const startedAt = new Date(now()).toISOString();
      const day: Challenge = { id: crypto.randomUUID(), balance: 1000, interview: 'OPEN', bank: 'OPEN', callerId: 'recruiter', phase: 'call', startedAt, replies: 0,
        turns: [{ role: 'system', text: DISCLOSURE, at: startedAt }, { role: 'assistant', text: CALLERS.recruiter.opening, at: startedAt, source: 'script' }], events: [], calls: [], leaked: [], codeVisible: false, callbackStep: 0 };
      await withClient(client => client.query('INSERT INTO tell_challenges (id, state) VALUES ($1, $2)', [day.id, JSON.stringify(day)]));
      return day;
    },
    get: (id: string) => update(id),
    /** Caches the reveal in the saved day. A concurrent action may overwrite it; the next request recomputes. */
    async saveReveal(id: string, reveal: NonNullable<Challenge['reveal']>) {
      await withClient(client => client.query(`UPDATE tell_challenges SET state = jsonb_set(state, '{reveal}', $2::jsonb), updated_at = now() WHERE id = $1`, [id, JSON.stringify(reveal)]));
    },
    act: (id: string, action: Action) => update(id, action),
  };
}
