// The Debrief agent over a played Challenge day: a day as the service stores it goes in, and the
// reveal's results (rules, costs, rewind, steps) come out. No database or network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDayDebrief } from '../lib/challenge/debrief.ts';
import { CALLERS, CODE_REQUEST_LINES } from '../lib/challenge/scenarios.ts';
import { DISCLOSURE } from '../lib/challenge/recruiter.ts';
import { assertDebriefResult } from '../lib/debrief/index.mjs';

const T0 = Date.parse('2026-11-08T10:00:00Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const sys = (s) => ({ role: 'system', text: DISCLOSURE, at: at(s) });
const caller = (text, s) => ({ role: 'assistant', text, at: at(s), source: 'script' });
const you = (text, s, leaked) => ({ role: 'user', text, at: at(s), ...(leaked ? { leaked } : {}) });

/** A day where Yui is trusted, Ren is refused after a portal check, and Kai gets the code. */
function playedDay({ leakKaiCode = true, callback = false } = {}) {
  const yui = [sys(0), caller(CALLERS.recruiter.opening, 0), you('Yes, this is Alex.', 5), caller(CALLERS.recruiter.beats[0][0], 6), you('Tuesday works.', 12), caller(CALLERS.recruiter.beats[1][0], 13)];
  const ren = [sys(100), caller(CALLERS.onboarding.opening, 100), you('Hi.', 104), caller(CALLERS.onboarding.beats[0][0], 105), you("I won't share that. I'll check the portal.", 110), caller(CALLERS.onboarding.beats[1][0], 111)];
  const kai = [sys(200), caller(CALLERS.fraud_team.opening, 200), you('Yes.', 203), caller(CALLERS.fraud_team.beats[0][0], 204), you('Yes I did.', 208), caller(CALLERS.fraud_team.beats[1][0], 209), you('No.', 212), caller(CODE_REQUEST_LINES[0], 213),
    // The service redacts "the code is …" before storing it, and marks the turn instead.
    leakKaiCode ? you('[personal details removed]', 220, ['live_code']) : you("I'm not reading that. I'll call the number in my app.", 220)];
  const events = [{ type: 'Verify', surface: 'portal', at: at(108) }, { type: 'Verify', surface: 'bank', at: at(240) }];
  if (callback) events.push({ type: 'Verify', surface: 'callback', at: at(260) });
  return {
    id: '00000000-0000-4000-8000-000000000001', balance: leakKaiCode ? 350 : 1000, interview: 'BOOKED', bank: leakKaiCode ? 'FAILED' : callback ? 'RESOLVED' : 'OPEN',
    callerId: 'fraud_team', phase: 'complete', startedAt: at(200), replies: 4, turns: kai, leaked: leakKaiCode ? ['live_code'] : [], codeVisible: true, callbackStep: callback ? 3 : 0,
    events,
    calls: [
      { callerId: 'recruiter', verdict: 'Real', turns: yui, cost: 0, leaked: [], endReason: 'disconnect' },
      { callerId: 'onboarding', verdict: 'Scam', turns: ren, cost: 0, leaked: [], endReason: 'disconnect' },
      { callerId: 'fraud_team', verdict: 'Unverified', turns: kai, cost: leakKaiCode ? 650 : 0, leaked: leakKaiCode ? ['live_code'] : [], endReason: 'disconnect' },
    ],
  };
}

test('the debrief scores each call the way the board did, and rewinds to the leaked code', async () => {
  const steps = [];
  const debrief = await runDayDebrief(playedDay(), { onStep: (event) => steps.push(event) });
  debrief.calls.forEach((r) => assertDebriefResult(r));
  const [yui, ren, kai] = debrief.calls;

  assert.equal(yui.persona.call_type, 'legit');
  assert.equal(yui.outcome.task.status, 'done');
  assert.equal(yui.decisions.find((d) => d.kind === 'verdict').result, 'worked');

  assert.equal(ren.outcome.money_lost, 0);
  assert.equal(ren.rules[0].status, 'kept');
  assert.ok(ren.moves.some((m) => m.move === 'verify' && m.event === 'portal_opened'));

  // The redacted reply still counts as the leak it was.
  assert.equal(kai.outcome.money_lost, 650);
  assert.equal(kai.outcome.task.status, 'failed');
  assert.equal(kai.rules[0].status, 'broken');
  assert.equal(debrief.rewind.persona.id, 'fraud_team');
  assert.equal(debrief.rewind.cost_you, true);
  assert.equal(kai.decisions.find((d) => d.id === debrief.rewind.decision_id).kind, 'leak');

  // Every step was reported live, tagged with its call.
  assert.deepEqual([...new Set(steps.map((s) => s.call))], [0, 1, 2]);
  assert.equal(steps.length, debrief.calls.reduce((n, r) => n + r.steps.length, 0));
  assert.ok(debrief.calls.every((r) => r.path === 'fixed'));
});

test('a callback after a clean bank call completes the bank task', async () => {
  const debrief = await runDayDebrief(playedDay({ leakKaiCode: false, callback: true }));
  const kai = debrief.calls[2];
  assert.equal(kai.outcome.money_lost, 0);
  assert.equal(kai.outcome.task.status, 'done');
  assert.equal(kai.rules[3].status, 'kept');
  assert.notEqual(debrief.key, (await runDayDebrief(playedDay({ leakKaiCode: false }))).key);
});

test('with Nemotron, the agent path runs for each call and its sentences reach the reveal', async () => {
  let n = 0;
  const llm = {
    model: 'fake-nemotron',
    async chat({ messages }) {
      const last = messages[messages.length - 1];
      const fresh = messages.filter((m) => m.role === 'assistant').length === 0;
      if (fresh) return { model: 'fake-nemotron', message: { content: null, tool_calls: [{ id: `m${n++}`, type: 'function', function: { name: 'map_moves_to_rules', arguments: '{}' } }] } };
      const decisions = JSON.parse(last.content).decisions ?? [];
      return { model: 'fake-nemotron', message: { content: null, tool_calls: [{ id: `s${n++}`, type: 'function', function: { name: 'submit_debrief', arguments: JSON.stringify({ sentences: decisions.map((d) => ({ decision_id: d.id, sentence: `Agent note on ${d.id}.` })), rewind_decision_id: decisions[0]?.id }) } }] } };
    },
  };
  const debrief = await runDayDebrief(playedDay(), { llm });
  for (const r of debrief.calls) {
    assert.equal(r.path, 'agent');
    assert.ok(r.decisions.every((d) => d.sentence_source === 'nemotron'), r.persona.id);
    assert.equal(r.steps[0].by, 'nemotron');
  }
});
