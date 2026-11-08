import type { Scenario } from '../scenarios/types';
import type { CallRow } from '../analysis';
import { weakestTactic } from '../finishedCalls';
import type { CallStore, CallRecord, Transaction } from './store';
import type { PublicCall, CallAction } from './types';
import type { SpokenPlan } from './planner';
import { leakedSecrets } from '../../practice/leaks';
import { redact } from '../../policy/redact';
import { CALL_SECONDS, DRILL_SECONDS, SKILLS, hintFor, type SkillId } from '../../skills/catalog';

export class CallError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type FinishCall = (tx: Transaction, call: CallRecord) => Promise<Record<string, unknown>>;
export function publicCall(call: CallRecord): PublicCall {
  const { id, category, org, card, secrets } = call.scenario;
  return { id: call.id, scenario: { id, category, org, card, secrets }, label: 'AI practice caller',
    turns: call.turns.map(({ role, text, step }) => ({ role, text, step })), phase: call.phase,
    replies: call.replies.length, serverNow: new Date().toISOString(), startedAt: call.startedAt, scored: call.scored, callsLeft: call.callsLeft,
    ...(deliveredLink(call) ? { callerLink: { href: deliveredLink(call)!.href } } : {}),
    ...(call.sheet ? { sheet: call.sheet } : {}),
    limitSeconds: call.limitSeconds ?? CALL_SECONDS,
    ...(call.hint && call.phase === 'call' ? { hint: call.hint } : {}),
    ...(call.drill ? { drill: { skill: call.drill, name: SKILLS[call.drill].name } } : {}),
    ...(call.phase === 'complete' ? { result: call.result } : {}),
  };
}
function deliveredLink(call: CallRecord) {
  return call.version === 'scam' && call.turns.some(t => t.role === 'caller' && t.step >= 3) ? call.scenario.versions.scam.link : undefined;
}
export function createCallService(deps: {
  store: CallStore; scenario(id: string): Promise<Scenario | null>;
  plan(scenario: Scenario, version: 'real' | 'scam', hint?: { press: boolean }): Promise<SpokenPlan>;
  finishCall: FinishCall; now?: () => Date; random?: () => number;
  /** Finished calls for this player. A failure must not stop the call from starting. */
  finished?: (playerId: string) => Promise<CallRow[]>;
  /** Runs after a verdict is committed. A failure must not fail the call. */
  onFinished?: (playerId: string) => Promise<unknown>;
}) {
  const now = deps.now ?? (() => new Date());
  async function update(playerId: string, id: string, action?: CallAction) {
    let expiredReply = false;
    let finishedNow = false;
    const call = await deps.store.update(playerId, id, async (call, tx) => {
      const at = now();
      if (call.phase === 'call' && at.getTime() - Date.parse(call.startedAt) >= (call.limitSeconds ?? CALL_SECONDS) * 1000) {
        call.phase = 'verdict'; call.endedAt = at.toISOString(); call.endedBy = 'time';
      }
      if (!action) return;
      if (action.type === 'reply') {
        if (call.phase !== 'call') { expiredReply = true; return; }
        const text = action.text.trim();
        if (!text || text.length > 1000) throw new CallError(400, 'Use 1 to 1,000 characters.');
        const leaks = leakedSecrets(text, call.scenario.secrets);
        const step = call.replies.length + 1;
        const safe = redact(text);
        call.replies.push({ step, text: safe, leaks });
        call.turns.push({ role: 'player', text: safe, step });
        call.leaks = [...new Set([...call.leaks, ...leaks])];
        if (call.replies.length === 4 || /\bstop\s+drill\b/i.test(text)) {
          call.phase = 'verdict'; call.endedAt = at.toISOString();
          call.endedBy = call.replies.length === 4 ? 'replies' : 'player';
        } else call.turns.push({ role: 'caller', text: call.lines[call.replies.length]!, step: step + 1 });
      } else if (action.type === 'end') {
        if (call.phase === 'call') { call.phase = 'verdict'; call.endedAt = at.toISOString(); call.endedBy = 'player'; }
      } else if (action.type === 'hint') {
        if (call.phase !== 'call') { expiredReply = true; return; }
        const step = call.replies.length + 1;
        (call.hintEvents ??= []).push({ at: at.toISOString(), step });
        call.hint = hintFor(step);
      } else if (action.type === 'own-app') {
        if (call.phase === 'complete') throw new CallError(409, 'This call is complete.');
        if (!call.verifyEvents.length) call.verifyEvents.push({ at: at.toISOString(), step: call.replies.length + 1 });
        call.sheet = call.scenario.card.ownApp;
      } else if (action.type === 'caller-link') {
        const link = deliveredLink(call);
        if (!link || call.phase === 'complete') throw new CallError(409, 'No caller link is available.');
        if (!call.linkEvents?.length) call.linkEvents = [{ at: at.toISOString(), step: call.replies.length + 1 }];
        call.sheet = link.sheet;
      } else if (action.type === 'verdict') {
        if (call.phase === 'complete') return;
        if (call.phase !== 'verdict') throw new CallError(409, 'End the call before giving a Verdict.');
        call.verdict = action.verdict;
        call.result = await deps.finishCall(tx, call);
        call.phase = 'complete';
        finishedNow = true;
      }
    });
    if (!call) throw new CallError(404, 'Call not found.');
    if (expiredReply) throw new CallError(409, 'This call has ended.');
    return { call, finishedNow };
  }
  return {
    get: async (playerId: string, id: string) => (await update(playerId, id)).call,
    async act(playerId: string, id: string, action: CallAction) {
      const { call, finishedNow } = await update(playerId, id, action);
      if (deps.onFinished && finishedNow) {
        try { await deps.onFinished(playerId); } catch (error) { console.error('analysis refresh failed', error); }
      }
      return call;
    },
    /** A drill is a 60-second practice call for one skill, in whatever story the caller picked. */
    async start(playerId: string, scenarioId: string, options: { drill?: SkillId } = {}) {
      const scenario = await deps.scenario(scenarioId);
      if (!scenario) throw new CallError(404, 'Call scenario not found.');
      const version = (deps.random ?? Math.random)() < 0.5 ? 'real' : 'scam';
      let press = false;
      if (deps.finished) {
        try { press = weakestTactic(await deps.finished(playerId)) === scenario.tactic; }
        catch (error) { console.error('finished calls unavailable', error); }
      }
      const planned = await deps.plan(scenario, version, { press });
      const lines = [...planned.lines, version === 'real' ? scenario.versions.real.next_step : scenario.versions.scam.ask_line] as CallRecord['lines'];
      const drill = options.drill ? { drill: options.drill, limitSeconds: DRILL_SECONDS } : { limitSeconds: CALL_SECONDS };
      return deps.store.start(playerId, { id: crypto.randomUUID(), scenario, version, lines, phase: 'call', turns: [{ role: 'caller', text: lines[0], step: 1 }], replies: [], verifyEvents: [], leaks: [], ...drill }, now(), { practice: Boolean(options.drill) });
    },
  };
}
