import pg from 'pg';
import type { Challenge, CallerId, Turn } from './types.ts';
import type { Detection, Transcript, Tactic } from '../debrief/index.mjs';
import { DetectorRateLimitError } from './detector.ts';
import { CALLERS } from './scenarios.ts';
import type { PresenterSnapshot } from './presenter-types.ts';

const TACTICS: readonly string[] = ['authority', 'urgency', 'details-as-proof', 'reward', 'fear'];
export type RiskPoint = {
  turn: number; at: string; status: 'pending' | 'scoring' | 'done' | 'unavailable';
  risk: number | null; label: 'scam' | 'legit' | null; tactics: Tactic[];
  lease?: string; leaseUntil?: number; retryAt?: number; attempts: number;
};
export type RiskCall = { callerId: CallerId; startedAt: string; series: RiskPoint[]; firstCorrectTurn: number | null; firstCorrectSeconds: number | null };
export type RiskState = { token: string; calls: RiskCall[]; cooldownUntil?: number };

/** Enqueue only metadata in the day transaction; the saved, redacted turns remain the source. */
export function queueRisk(day: Challenge) {
  day.risk ??= { token: crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''), calls: [] };
  let call = day.risk.calls.find(call => call.callerId === day.callerId && call.startedAt === day.startedAt);
  if (!call) {
    call = { callerId: day.callerId, startedAt: day.startedAt, series: [], firstCorrectTurn: null, firstCorrectSeconds: null };
    day.risk.calls.push(call);
  }
  day.turns.forEach((turn, index) => {
    if (turn.role === 'system' || call.series.some(point => point.turn === index + 1)) return;
    call.series.push({ turn: index + 1, at: turn.at, status: 'pending', risk: null, label: null, tactics: [], attempts: 0 });
  });
}

function transcriptFor(day: Challenge, call: RiskCall, point: RiskPoint): Transcript {
  const saved = day.calls.find(saved => saved.callerId === call.callerId && (saved.startedAt ?? saved.turns[0]?.at) === call.startedAt);
  const turns: Turn[] = saved?.turns ?? (day.callerId === call.callerId && day.startedAt === call.startedAt ? day.turns : []);
  if (turns.length < point.turn) throw new Error('Risk transcript no longer available');
  return { id: `${day.id}:${call.callerId}:${call.startedAt}:${point.turn}`, persona_id: call.callerId, verdict: null,
    turns: turns.slice(0, point.turn).map((turn, index) => ({ turn: index + 1, speaker: turn.role === 'user' ? 'player' : 'caller', text: turn.text,
      t: Math.max(0, (Date.parse(turn.at) - Date.parse(call.startedAt)) / 1000) })), events: [] };
}

/** The model runs outside every day lock. A persisted lease prevents duplicate work across requests. */
export function createRiskService({ connectionString, detect, now = Date.now }: {
  connectionString: string; detect: (transcript: Transcript) => Promise<Detection>; now?: () => number;
}) {
  async function mutate<T>(id: string, work: (day: Challenge) => T): Promise<T | null> {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    await client.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT state FROM tell_challenges WHERE id = $1 FOR UPDATE', [id]);
      if (!result.rowCount) { await client.query('COMMIT'); return null; }
      const day = result.rows[0].state as Challenge;
      const value = work(day);
      if (day.risk) await client.query("UPDATE tell_challenges SET state = jsonb_set(state, '{risk}', $2::jsonb) WHERE id = $1", [id, JSON.stringify(day.risk)]);
      await client.query('COMMIT');
      return value;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); }
  }
  return {
    async read(id: string, token: string): Promise<PresenterSnapshot | null> {
      const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
      await client.connect();
      try {
        const result = await client.query('SELECT state FROM tell_challenges WHERE id = $1', [id]);
        const day = result.rows[0]?.state as Challenge | undefined;
        if (!day?.risk || day.risk.token !== token) return null;
        const call = day.risk.calls.find(call => call.callerId === day.callerId && call.startedAt === day.startedAt);
        const last = call?.series.at(-1);
        const scored = call?.series.findLast(point => point.status === 'done');
        return {
          callerName: CALLERS[day.callerId].name, organization: CALLERS[day.callerId].org, phase: day.phase,
          risk: scored?.risk ?? null, tactics: scored?.tactics ?? [], scoredTurn: scored?.turn ?? null, currentTurn: last?.turn ?? null,
          status: (day.risk.cooldownUntil ?? 0) > now() ? 'rate-limited' : !last ? 'waiting'
            : last.status === 'pending' || last.status === 'scoring' ? 'scoring' : last.status === 'unavailable' ? 'unavailable' : last.risk === null ? 'uncertain' : 'ready',
          firstCorrectTurn: call?.firstCorrectTurn ?? null, firstCorrectSeconds: call?.firstCorrectSeconds ?? null,
          series: call?.series.map(({ turn, at, risk, status }) => ({ turn, at, risk, status })) ?? [],
        };
      } finally { await client.end(); }
    },
    async score(id: string) {
      // Three prefixes fit within the Worker's background lifetime at the detector's 7-second cap.
      for (let n = 0; n < 3; n++) {
        const job = await mutate(id, day => {
          const calls = day.risk?.calls ?? [];
          if ((day.risk?.cooldownUntil ?? 0) > now()) return null;
          if (calls.some(call => call.series.some(point => point.status === 'scoring' && (point.leaseUntil ?? 0) > now()))) return null;
          for (const call of calls) {
            const point = call.series.find(point => (point.status === 'pending' && (point.retryAt ?? 0) <= now()) || (point.status === 'scoring' && (point.leaseUntil ?? 0) <= now()));
            if (!point) continue;
            const transcript = transcriptFor(day, call, point);
            point.status = 'scoring'; point.lease = crypto.randomUUID(); point.leaseUntil = now() + 30000; point.attempts++;
            return { callerId: call.callerId, startedAt: call.startedAt, turn: point.turn, lease: point.lease, transcript };
          }
          return null;
        });
        if (!job) return;
        let result: Detection | undefined;
        let limited: DetectorRateLimitError | undefined;
        try { result = await detect(job.transcript); }
        catch (error) { if (error instanceof DetectorRateLimitError) limited = error; }
        await mutate(id, day => {
          const call = day.risk?.calls.find(call => call.callerId === job.callerId && call.startedAt === job.startedAt);
          const point = call?.series.find(point => point.turn === job.turn && point.lease === job.lease);
          if (!call || !point) return;
          point.status = result ? 'done' : 'unavailable';
          delete point.lease; delete point.leaseUntil;
          if (limited && day.risk) {
            day.risk.cooldownUntil = Math.max(limited.retryAt, now() + Math.min(30000 * 2 ** (point.attempts - 1), 300000));
            if (point.attempts < 3) { point.status = 'pending'; point.retryAt = day.risk.cooldownUntil; }
          }
          if (result && Number.isFinite(result.confidence) && result.confidence >= .6 && result.confidence <= 1 && (result.label === 'scam' || result.label === 'legit')) {
            point.label = result.label;
            point.risk = Math.round(100 * (result.label === 'scam' ? result.confidence : 1 - result.confidence));
            point.tactics = [...new Set(result.red_flags.filter(flag => {
              const turn = job.transcript.turns.find(turn => turn.turn === flag.turn);
              return TACTICS.includes(flag.tactic) && turn?.text.slice(flag.span.start, flag.span.end) === flag.span.text;
            }).map(flag => flag.tactic as Tactic))];
          }
          const expected = call.callerId === 'recruiter' ? 'legit' : 'scam';
          const first = call.series.find(point => point.status === 'done' && point.label === expected);
          call.firstCorrectTurn = first?.turn ?? null;
          call.firstCorrectSeconds = first ? Math.max(0, (Date.parse(first.at) - Date.parse(call.startedAt)) / 1000) : null;
        });
      }
    },
  };
}
