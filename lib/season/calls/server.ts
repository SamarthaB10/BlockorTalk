import { createNemotronClient } from '../../debrief/index.mjs';
import { createPracticeSpeech } from '../../practice/speech';
import { createScenarioStore } from '../scenarios/server';
import { createScenarioCorpus } from '../scenarios/corpus';
import { createCallStore, readCurrentSeason, withCallDatabase } from './store';
import { CallError, createCallService, type FinishCall } from './service';
import { createCallPlanner } from './planner';
import { createCallHandlers } from './routes';

export async function authenticatePlayer(request: Request, connectionString = process.env.DATABASE_URL ?? '', at = new Date()): Promise<string | null> {
  const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('tell_player='))?.slice('tell_player='.length);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
  return withCallDatabase(connectionString, async client =>
    (await client.query('SELECT player_id FROM player_sessions WHERE token_hash=$1 AND expires_at>$2', [hash, at])).rows[0]?.player_id ?? null);
}
export async function currentSeason(connectionString = process.env.DATABASE_URL ?? '', at = new Date()) {
  return withCallDatabase(connectionString, client => readCurrentSeason(client, at));
}
export function createProductionCallHandlers(env = process.env, finishCall: FinishCall = async () => {
  throw new CallError(503, 'Results are unavailable. Please try again.');
}) {
  const connectionString = env.DATABASE_URL ?? '';
  const scenarios = createScenarioStore(connectionString);
  const corpus = createScenarioCorpus(connectionString);
  const service = createCallService({ store: createCallStore(connectionString, () => new Date()), scenario: scenarios.get,
    plan: createCallPlanner({ examples: corpus.examples, model: createNemotronClient(env) }), finishCall });
  return createCallHandlers({ service, authenticate: request => authenticatePlayer(request, connectionString), speech: createPracticeSpeech(env) });
}
