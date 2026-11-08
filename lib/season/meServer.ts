import { createMeHandlers } from './me.ts';
import { createAnalysisStore } from './analysisStore.ts';
import { createAnalysisRefresher } from './refresh.ts';
import { createNemotronAnalystLlm, createPlayerAnalyst } from './analyst.ts';
import { scenarios } from './scenarios/server.ts';
import type { CallRow } from './analysis.ts';

/**
 * Real wiring for /me and the analysis refresher.
 * Two seams wait for other tickets and fail closed until they land:
 *  - getPlayerId: the session cookie lookup from BS-02 (signup and sessions).
 *  - loadCalls: one Player's finished calls as CallRow[] from BS-05/BS-07.
 */
async function getPlayerId(_request: Request): Promise<string | null> { return null; }
async function loadCalls(_playerId: string): Promise<CallRow[]> { return []; }

const publicScenarios = scenarios.map(({ id, category, tactic }) => ({ id, category, tactic }));

export function meHandlers(env = process.env) {
  return createMeHandlers({ getPlayerId, loadCalls, scenarios: publicScenarios, store: createAnalysisStore(env.DATABASE_URL ?? '') });
}

/** For the BS-07 finished-call hook: `await refreshPlayerAnalysis(playerId)` after every finished call. */
export function refreshPlayerAnalysis(playerId: string, env = process.env) {
  return createAnalysisRefresher({
    loadCalls, scenarios: publicScenarios, store: createAnalysisStore(env.DATABASE_URL ?? ''),
    analyst: createPlayerAnalyst(createNemotronAnalystLlm(env)),
  })(playerId);
}
