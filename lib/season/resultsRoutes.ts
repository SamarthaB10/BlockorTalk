import { ANALYSIS_UNLOCK_CALLS } from './analysis';
import { buildResults, rankChange, type FinishedCallView } from './results';
import type { Score } from './routes';
import { progressView, skillUpdate, type SkillCall } from '../skills/log';

export interface ResultsStore {
  /** The Player's own call, or null when it doesn't exist or belongs to someone else. */
  call(playerId: string, id: string): Promise<FinishedCallView | null>;
  scores(seasonId: string): Promise<Score[]>;
  /** Finished, non-synthetic calls, practice included (the analysis unlock rule). */
  finishedCalls(playerId: string): Promise<number>;
  /** The Player's finished calls as Skill Log evidence. Optional: results never wait on it. */
  skillCalls?(playerId: string): Promise<SkillCall[]>;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function createResultsHandlers({ authenticate, store }: {
  authenticate(request: Request): Promise<string | null>;
  store: ResultsStore;
}) {
  return {
    async GET(request: Request, id: string) {
      try {
        const playerId = await authenticate(request);
        if (!playerId) return json({ error: 'Sign in to see your results.' }, 401);
        if (!id || id.length > 100) return json({ error: 'Call not found.' }, 404);
        const call = await store.call(playerId, id);
        if (!call) return json({ error: 'Call not found.' }, 404);
        if (call.phase !== 'complete' || !call.result) return json({ error: 'Give your Verdict to see your results.' }, 409);
        const result = call.result;
        const [scores, finished] = await Promise.all([
          call.seasonId ? store.scores(call.seasonId) : Promise.resolve([]),
          store.finishedCalls(playerId),
        ]);
        const rank = rankChange(scores, playerId, { scored: call.scored && result.total !== null, delta: result.delta, right: result.right, wrong: result.wrong, total: result.total });
        let skills = { skill: null as ReturnType<typeof skillUpdate>, next: null as ReturnType<typeof progressView>['recommended'] };
        try {
          const calls = await store.skillCalls?.(playerId);
          if (calls) skills = { skill: skillUpdate(calls, call.id), next: progressView(calls).recommended };
        } catch (error) { console.error('skill log unavailable', error); }
        return json({ results: buildResults(call, rank, finished >= ANALYSIS_UNLOCK_CALLS, skills) });
      } catch {
        return json({ error: 'Your results are not available right now. Please try again.' }, 503);
      }
    },
  };
}
