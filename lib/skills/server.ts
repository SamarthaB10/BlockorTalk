/**
 * Server side of the Skill Log: reads the Player's finished calls from `calls.state` (the call
 * engine's record) and turns each into a SkillCall. Persistent by construction: the log is rebuilt
 * from stored calls on every read, so it follows the Player across devices.
 */
import { labelByRules, MOVES, type Move } from '../blokbuks/rules.ts';
import { authenticatePlayer } from '../season/calls/server';
import { withCallDatabase, type CallRecord } from '../season/calls/store';
import { SCENARIO_TACTICS } from '../season/scenarios/tactics.ts';
import { isSkillId } from './catalog.ts';
import { withExamples } from './examples.ts';
import { progressView, type SkillCall } from './log.ts';

type ReplyMoment = { kind?: string; step?: number; move?: string; quote?: string };

/** One finished call as Skill Log evidence, or null when the call has no Verdict yet. */
export function toSkillCall(state: CallRecord, endedAt?: string | Date | null): SkillCall | null {
  if (state.phase !== 'complete' || !state.verdict) return null;
  const result = state.result as { moments?: ReplyMoment[] } | undefined;
  const moments = (result?.moments ?? []).filter(moment => moment.kind === 'reply');
  const secrets = state.scenario.secrets ?? [];
  const firstStep = (events?: { step: number }[]) => (events?.length ? Math.min(...events.map(event => event.step)) : null);
  return {
    id: state.id,
    scenarioId: state.scenario.id,
    category: state.scenario.category,
    org: state.scenario.org,
    tactic: state.scenario.tactic ?? SCENARIO_TACTICS[state.scenario.id] ?? '',
    version: state.version,
    verdict: state.verdict,
    at: state.endedAt ?? (endedAt ? new Date(endedAt).toISOString() : state.startedAt),
    replies: state.replies.map(reply => {
      const moment = moments.find(item => item.step === reply.step && MOVES.includes(item.move as Move));
      const leaked = reply.leaks.length > 0;
      return {
        step: reply.step,
        move: leaked ? 'Leak' : (moment?.move as Move | undefined) ?? labelByRules(reply.text, secrets),
        text: reply.text,
        quote: moment?.quote ?? reply.text,
        leaked,
      };
    }),
    ownAppStep: firstStep(state.verifyEvents),
    linkStep: firstStep(state.linkEvents),
    linkOffered: state.version === 'scam' && Boolean(state.scenario.versions?.scam?.link) && state.turns.some(turn => turn.role === 'caller' && turn.step >= 3),
    hintSteps: (state.hintEvents ?? []).map(event => event.step),
    endedBy: state.endedBy ?? null,
    drill: isSkillId(state.drill) ? state.drill : null,
    secretLabel: secrets[0]?.label ?? 'practice code',
  };
}

export function createSkillCallReader(connectionString: string) {
  return (playerId: string) => withCallDatabase(connectionString, async client => {
    const rows = (await client.query<{ state: CallRecord; ended_at: Date | null }>(
      `SELECT state, ended_at FROM calls
        WHERE player_id = $1 AND verdict IS NOT NULL AND NOT synthetic
        ORDER BY ended_at NULLS LAST, started_at, id`, [playerId])).rows;
    // Every account starts from its example quizzes; real calls add on after them.
    return withExamples(playerId, rows.flatMap(row => {
      const call = toSkillCall(row.state, row.ended_at);
      return call ? [call] : [];
    }));
  });
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function createProgressHandlers(deps: {
  authenticate(request: Request): Promise<string | null>;
  calls(playerId: string): Promise<SkillCall[]>;
  now?: () => Date;
}) {
  return {
    async GET(request: Request) {
      try {
        const playerId = await deps.authenticate(request);
        if (!playerId) return json({ error: 'Sign in to see your progress.' }, 401);
        return json({ progress: progressView(await deps.calls(playerId), deps.now?.() ?? new Date()) });
      } catch {
        return json({ error: 'Your progress is not available right now. Please try again soon.' }, 503);
      }
    },
  };
}

export function progressHandlers(env = process.env) {
  const connectionString = env.DATABASE_URL ?? '';
  return createProgressHandlers({
    authenticate: request => authenticatePlayer(request, connectionString),
    calls: createSkillCallReader(connectionString),
  });
}
