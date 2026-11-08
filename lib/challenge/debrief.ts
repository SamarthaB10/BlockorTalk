// Runs the Debrief agent over each finished call of a Challenge day, one call after another, and
// picks the day's rewind. Every step is reported through `onStep` as it happens so the reveal can
// show the agent's work live.
import { runDebrief, pickDayRewind } from '../debrief/index.mjs';
import type { DebriefResult, LlmClient, Step } from '../debrief/index.mjs';
import { debriefKey, toDebriefInput } from './debriefAdapter.ts';
import type { Challenge } from './types.ts';

export type DayDebrief = {
  key: string;
  calls: DebriefResult[];
  rewind: ReturnType<typeof pickDayRewind>;
};
export type DayStep = { call: number; step: Step };

export async function runDayDebrief(day: Challenge, { llm = null, onStep, timeoutMs }: { llm?: LlmClient | null; onStep?: (event: DayStep) => void; timeoutMs?: number } = {}): Promise<DayDebrief> {
  const calls: DebriefResult[] = [];
  for (let call = 0; call < day.calls.length; call++) {
    const { persona, transcript } = toDebriefInput(day, call);
    calls.push(await runDebrief({ persona, transcript, llm, timeoutMs, onStep: step => onStep?.({ call, step }) }));
  }
  return { key: debriefKey(day), calls, rewind: pickDayRewind(calls) };
}

/** What the reveal needs from a saved debrief, without the bulky tool results. */
export function slimDebrief(debrief: DayDebrief): DayDebrief {
  return {
    ...debrief,
    calls: debrief.calls.map(result => ({
      ...result,
      steps: result.steps.map(({ result: _result, ...step }) => ({ ...step, result: null })),
    })),
  };
}
