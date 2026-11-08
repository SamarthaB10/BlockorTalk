import { createNemotronAnalystLlm } from '../season/analyst';
import { scenarios } from '../season/scenarios/server';
import { createInsightsAnalyst } from './analyst';
import { createInsightsHandlers } from './routes';
import { createInsightsStore } from './store';

const publicScenarios = scenarios.map(({ id, category, tactic }) => ({ id, category, tactic }));

/** Real wiring for /insights. Secrets stay on the server: TELL_INSIGHTS_SECRET, DATABASE_URL, NVIDIA_API_KEY. */
export function insightsHandlers(env = process.env) {
  return createInsightsHandlers({
    secret: env.TELL_INSIGHTS_SECRET,
    store: createInsightsStore(env.DATABASE_URL ?? '', publicScenarios),
    analyst: createInsightsAnalyst(createNemotronAnalystLlm(env)),
  });
}
