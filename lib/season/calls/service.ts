import type { Scenario } from '../scenarios/types';
import type { CallStore, CallRecord, Transaction } from './store';
import type { PublicCall, CallAction } from './types';
import { leakedSecrets } from '../../practice/leaks';
import { redact } from '../../policy/redact';

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
    ...(call.phase === 'complete' ? { result: call.result } : {}),
  };
}
function deliveredLink(call: CallRecord) {
  return call.version === 'scam' && call.turns.some(t => t.role === 'caller' && t.step >= 3) ? call.scenario.versions.scam.link : undefined;
}
export function createCallService(deps: {
  store: CallStore; scenario(id: string): Promise<Scenario | null>;
  plan(scenario: Scenario, version: 'real' | 'scam'): Promise<[string, string, string]>;
  finishCall: FinishCall; now?: () => Date; random?: () => number;
}) {
  const now = deps.now ?? (() => new Date());
  async function update(playerId: string, id: string, action?: CallAction) {
    let expiredReply = false;
    const call = await deps.store.update(playerId, id, async (call, tx) => {
      const at = now();
      if (call.phase === 'call' && at.getTime() - Date.parse(call.startedAt) >= 180000) {
        call.phase = 'verdict'; call.endedAt = at.toISOString();
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
        } else call.turns.push({ role: 'caller', text: call.lines[call.replies.length]!, step: step + 1 });
      } else if (action.type === 'end') {
        if (call.phase === 'call') { call.phase = 'verdict'; call.endedAt = at.toISOString(); }
      } else if (action.type === 'own-app') {
        if (call.phase === 'complete') throw new CallError(409, 'This call is complete.');
        if (!call.verifyEvents.length) call.verifyEvents.push({ at: at.toISOString(), step: call.replies.length + 1 });
        call.sheet = call.scenario.card.ownApp;
      } else if (action.type === 'caller-link') {
        const link = deliveredLink(call);
        if (!link || call.phase === 'complete') throw new CallError(409, 'No caller link is available.');
        call.sheet = link.sheet;
      } else if (action.type === 'verdict') {
        if (call.phase === 'complete') return;
        if (call.phase !== 'verdict') throw new CallError(409, 'End the call before giving a Verdict.');
        call.verdict = action.verdict;
        call.result = await deps.finishCall(tx, call);
        call.phase = 'complete';
      }
    });
    if (!call) throw new CallError(404, 'Call not found.');
    if (expiredReply) throw new CallError(409, 'This call has ended.');
    return call;
  }
  return {
    get: (playerId: string, id: string) => update(playerId, id),
    act: (playerId: string, id: string, action: CallAction) => update(playerId, id, action),
    async start(playerId: string, scenarioId: string) {
      const scenario = await deps.scenario(scenarioId);
      if (!scenario) throw new CallError(404, 'Call scenario not found.');
      const version = (deps.random ?? Math.random)() < 0.5 ? 'real' : 'scam';
      const lines = [...await deps.plan(scenario, version), version === 'real' ? scenario.versions.real.next_step : scenario.versions.scam.ask_line] as CallRecord['lines'];
      return deps.store.start(playerId, { id: crypto.randomUUID(), scenario, version, lines, phase: 'call', turns: [{ role: 'caller', text: lines[0], step: 1 }], replies: [], verifyEvents: [], leaks: [] }, now());
    },
  };
}
