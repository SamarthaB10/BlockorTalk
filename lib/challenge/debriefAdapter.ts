// Turns one finished Challenge call into the persona card and transcript the Debrief agent reads.
// Code facts the day already settled (leaks, verify events, how the call ended) are carried over as
// transcript turns and events, so the agent's tools reach the same answers the board showed.
import type { CallEvent, PersonaCard, Transcript, TranscriptTurn } from '../debrief/index.mjs';
import { mentionsSecret } from '../policy/normalize.mjs';
import { secretLabel } from '../policy/rules.mjs';
import { CHALLENGE_PERSONAS, beatFor, isCodeRequest } from './personaCards.ts';
import { CALL_ORDER } from './scenarios.ts';
import type { CallResult, Challenge } from './types.ts';

const VERIFY_TYPE = { portal: 'portal_opened', bank: 'bank_app_opened', callback: 'callback_completed' } as const;

function callStart(call: CallResult) {
  return Date.parse(call.turns[0]?.at ?? '') || 0;
}

/** Which day-level verify events belong to this call (see the Challenge rules in the README). */
function eventsFor(day: Challenge, index: number) {
  const call = day.calls[index];
  const start = callStart(call);
  const nextCall = day.calls[index + 1];
  const end = nextCall ? callStart(nextCall) : Infinity;
  return day.events.filter(event => {
    const at = Date.parse(event.at);
    if (call.callerId === 'recruiter') return event.surface === 'portal'; // A later portal check still books an Unverified interview.
    if (call.callerId === 'onboarding') return event.surface === 'portal' && at >= start && at < end;
    return event.surface !== 'portal' && at >= start;
  });
}

export function toDebriefInput(day: Challenge, index: number): { persona: PersonaCard; transcript: Transcript } {
  const call = day.calls[index];
  if (!call) throw new Error(`No finished call ${index}`);
  const persona = CHALLENGE_PERSONAS[call.callerId];
  const start = callStart(call);
  const seconds = (iso: string) => Math.max(0, Math.round((Date.parse(iso) - start) / 1000));

  const turns: TranscriptTurn[] = call.turns.map((turn, i) => {
    const base = { turn: i + 1, t: seconds(turn.at), text: turn.text };
    if (turn.role === 'system') return { ...base, speaker: 'caller', beat: 'disclosure' };
    if (turn.role === 'assistant') {
      const beat = beatFor(call.callerId, turn.text);
      return { ...base, speaker: 'caller', ...(beat ? { beat } : {}) };
    }
    return { ...base, speaker: 'player' };
  });

  // Redaction can hide a leak the day already counted. Put the fictional value back so the
  // normalized leak check finds it on the turn where it happened.
  const playerTurns = turns.filter(turn => turn.speaker === 'player');
  for (const key of call.leaked) {
    const value = persona.fake_secrets[key];
    if (!value || playerTurns.some(turn => mentionsSecret(turn.text, key, value))) continue;
    const marked = call.turns.findIndex(turn => turn.leaked?.includes(key));
    const target = marked >= 0 ? turns[marked] : playerTurns[playerTurns.length - 1];
    if (target) target.text = `${target.text} [shared the fictional ${secretLabel(key)}: ${value}]`;
  }

  const lastTurn = turns.length;
  const afterTurn = (iso: string) => {
    const at = Date.parse(iso);
    let n = 0;
    call.turns.forEach((turn, i) => { if (Date.parse(turn.at) <= at) n = i + 1; });
    return Math.min(Math.max(n, 1), lastTurn);
  };
  const events: CallEvent[] = [];
  const codeTurn = call.turns.findIndex(turn => turn.role === 'assistant' && isCodeRequest(turn.text));
  if (codeTurn >= 0) events.push({ type: 'code_popup', after_turn: codeTurn + 1, t: seconds(call.turns[codeTurn].at) });
  const lastAt = call.turns[call.turns.length - 1]?.at ?? new Date(start).toISOString();
  if (call.endReason === 'disconnect' || call.endReason === 'stop') events.push({ type: 'hangup', by: 'player', after_turn: lastTurn, t: seconds(lastAt) });
  else if (call.endReason) events.push({ type: 'cap_reached', after_turn: lastTurn, t: seconds(lastAt) });
  for (const event of eventsFor(day, index)) {
    events.push({ type: VERIFY_TYPE[event.surface], after_turn: afterTurn(event.at), t: seconds(event.at) });
  }

  return {
    persona,
    transcript: {
      id: `${day.id}-${CALL_ORDER.indexOf(call.callerId) + 1}-${call.callerId}`,
      persona_id: persona.id,
      mode: 'text',
      verdict: call.verdict.toLowerCase() as Transcript['verdict'],
      turns,
      events,
    },
  };
}

/** Changes whenever something the debrief scores changes after the day ends (a late callback, a portal check). */
export function debriefKey(day: Challenge) {
  return `${day.calls.length}:${day.events.length}`;
}
