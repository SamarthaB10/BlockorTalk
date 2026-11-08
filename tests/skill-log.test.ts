import { describe, expect, it } from 'vitest';
import { judgeCall, progressView, skillUpdate, type SkillCall } from '../lib/skills/log';

const NOW = new Date('2026-11-08T18:00:00Z');
let n = 0;
/** A finished call. Defaults: a scam bank call where the player probed, protected and said Scam. */
function call(over: Partial<SkillCall> = {}): SkillCall {
  n += 1;
  return {
    id: `call-${n}`, scenarioId: 'bank', category: 'Bank fraud alert', org: 'Puffinvale Bank', tactic: 'Details as proof',
    version: 'scam', verdict: 'Scam', at: `2026-11-08T1${Math.min(n, 7)}:00:00Z`,
    replies: [], ownAppStep: null, linkStep: null, linkOffered: false, hintSteps: [], endedBy: 'replies', drill: null,
    secretLabel: 'Practice protection code',
    ...over,
  };
}
const reply = (step: number, move: SkillCall['replies'][number]['move'], text: string, leaked = false) => ({ step, move, text, quote: text, leaked });

describe('judging one call', () => {
  it('records an own-app check before the caller’s link as verifying independently', () => {
    const [entry] = judgeCall(call({ ownAppStep: 3, linkOffered: true, scenarioId: 'phishing', org: 'Cloudpetal Club', tactic: 'Urgency' })).filter(e => e.skill === 'verify');
    expect(entry).toMatchObject({ outcome: 'success', guided: false, step: 3 });
    expect(entry!.evidence).toBe('Opened your own Cloudpetal Club app instead of using the caller’s link.');
  });

  it('records following the caller’s link first as needing practice', () => {
    const [entry] = judgeCall(call({ linkStep: 3, ownAppStep: 4 })).filter(e => e.skill === 'verify');
    expect(entry).toMatchObject({ outcome: 'miss', step: 3, evidence: 'Opened the caller’s link before checking your own app.' });
  });

  it('describes a shared code without repeating the secret', () => {
    const [entry] = judgeCall(call({ replies: [reply(4, 'Leak', 'ok it is 8201', true)] })).filter(e => e.skill === 'protect');
    expect(entry).toMatchObject({ outcome: 'miss', step: 4 });
    expect(entry!.evidence).toBe('Shared the fictional practice protection code with the caller.');
    expect(entry!.evidence).not.toContain('8201');
  });

  it('marks a success as guided only when a hint came at or before it', () => {
    const before = judgeCall(call({ ownAppStep: 3, hintSteps: [2] })).find(e => e.skill === 'verify');
    const after = judgeCall(call({ ownAppStep: 2, hintSteps: [3] })).find(e => e.skill === 'verify');
    expect(before!.guided).toBe(true);
    expect(after!.guided).toBe(false);
  });

  it('judges urgency only on urgency or fear calls, at the pressure step', () => {
    const urgent = call({ scenarioId: 'delivery', tactic: 'Urgency', replies: [reply(3, 'Probe', 'Why does it have to be today?')] });
    expect(judgeCall(urgent).find(e => e.skill === 'urgency')).toMatchObject({ outcome: 'success', evidence: 'Slowed down under pressure: “Why does it have to be today?”' });
    expect(judgeCall(call({ replies: [reply(3, 'Probe', 'Why today?')] })).find(e => e.skill === 'urgency')).toBeUndefined();
  });

  it('never marks a real caller as a missed exit', () => {
    const entries = judgeCall(call({ version: 'real', verdict: 'Real', replies: [reply(4, 'Comply', 'Sure, I will check the app later')] }));
    expect(entries.filter(e => e.outcome === 'miss')).toEqual([]);
  });
});

describe('Skill Log states', () => {
  it('starts every skill unseen', () => {
    const view = progressView([], NOW);
    expect(view.skills.map(skill => skill.state)).toEqual(Array(6).fill('Unseen'));
    expect(view.summary).toEqual({ demonstrated: 0, independent: 0, needsPractice: 0, calls: 0 });
  });

  it('shows one success as Demonstrated, never Independent', () => {
    const verify = progressView([call({ ownAppStep: 2 })], NOW).skills.find(s => s.id === 'verify')!;
    expect(verify).toMatchObject({ state: 'Demonstrated', successes: 1, scenarios: 1, guidance: 'No guidance needed' });
  });

  it('needs unguided successes in two different scenarios to become Independent', () => {
    const same = progressView([call({ ownAppStep: 2 }), call({ ownAppStep: 2 })], NOW).skills.find(s => s.id === 'verify')!;
    expect(same).toMatchObject({ state: 'Demonstrated', successes: 2, scenarios: 1 });
    const two = progressView([call({ ownAppStep: 2 }), call({ ownAppStep: 2, scenarioId: 'carrier', org: 'Bramblebell Mobile' })], NOW).skills.find(s => s.id === 'verify')!;
    expect(two).toMatchObject({ state: 'Independent', successes: 2, scenarios: 2 });
    const guided = progressView([call({ ownAppStep: 2 }), call({ ownAppStep: 2, hintSteps: [1], scenarioId: 'carrier' })], NOW).skills.find(s => s.id === 'verify')!;
    expect(guided).toMatchObject({ state: 'Demonstrated', guidance: 'Guidance used in 1 of 2 successes' });
  });

  it('records a guided success honestly as Practiced', () => {
    const verify = progressView([call({ ownAppStep: 2, hintSteps: [2] })], NOW).skills.find(s => s.id === 'verify')!;
    expect(verify.state).toBe('Practiced');
    expect(verify.history[0]).toMatchObject({ label: 'Practiced', note: 'Successful with guidance.' });
  });

  it('drops Independent back after a later miss and flags it for practice', () => {
    const calls = [call({ ownAppStep: 2 }), call({ ownAppStep: 2, scenarioId: 'carrier' }), call({ linkStep: 3, scenarioId: 'phishing' })];
    const verify = progressView(calls, NOW).skills.find(s => s.id === 'verify')!;
    expect(verify).toMatchObject({ state: 'Demonstrated', needsPractice: true });
  });

  it('lists history newest first, by day, linked to the transcript moment', () => {
    const calls = [
      call({ id: 'old', ownAppStep: 2, at: '2026-11-05T15:00:00Z' }),
      call({ id: 'yday', ownAppStep: 3, at: '2026-11-07T15:00:00Z', hintSteps: [1] }),
      call({ id: 'today', linkStep: 3, at: '2026-11-08T15:00:00Z' }),
    ];
    const history = progressView(calls, NOW).skills.find(s => s.id === 'verify')!.history;
    expect(history.map(h => `${h.day} · ${h.label}`)).toEqual(['Today · Needs practice', 'Yesterday · Practiced', 'Earlier · Demonstrated']);
    expect(history[0]!.href).toBe('/play/results/today#step-3');
    expect(history.map(h => h.scenario)).toEqual(Array(3).fill('Puffinvale Bank · Bank fraud alert'));
  });
});

describe('recommended next', () => {
  it('picks the skill that needs practice and explains it from the last call', () => {
    const last = call({ id: 'last', scenarioId: 'delivery', tactic: 'Urgency', org: 'Mossparcel',
      replies: [reply(3, 'Probe', 'Why so fast?'), reply(4, 'Leak', 'it is 8202', true)] });
    const view = progressView([call({ ownAppStep: 2 }), last], NOW);
    expect(view.recommended).toMatchObject({ skill: 'protect', title: 'Practice protecting codes' });
    expect(view.recommended!.reason).toBe('You recognized urgency, but the last caller’s code request caught you off guard.');
    expect(view.recommended!.scenarioId).not.toBe('delivery');
    expect(view.recommended!.href).toBe(`/play/${view.recommended!.scenarioId}?drill=protect`);
    expect(view.summary).toMatchObject({ needsPractice: 1 });
  });

  it('sends the drill to a story not yet used for that skill', () => {
    const view = progressView([call({ scenarioId: 'bank', replies: [reply(4, 'Leak', '8201', true)] })], NOW);
    expect(view.recommended!.scenarioId).not.toBe('bank');
  });
});

describe('skill update after a call', () => {
  it('reports a first unguided success as Demonstrated, in plain words', () => {
    const only = call({ ownAppStep: 2, linkOffered: true, org: 'Cloudpetal Club', scenarioId: 'phishing', tactic: 'Urgency' });
    expect(skillUpdate([only], only.id)).toMatchObject({
      skill: 'verify', label: 'Verify independently · Demonstrated', outcome: 'Demonstrated',
      why: 'You opened your own Cloudpetal Club app instead of using the caller’s link.',
    });
  });

  it('puts an unsafe choice first and names the next opportunity without blame', () => {
    const leak = call({ ownAppStep: 2, replies: [reply(4, 'Leak', '8201', true)] });
    const update = skillUpdate([leak], leak.id)!;
    expect(update).toMatchObject({ skill: 'protect', label: 'Protect codes · Needs practice', outcome: 'Needs practice' });
    expect(update.next).toBe('Next time a caller asks for a code, keep it and check through your own app.');
    expect(`${update.why} ${update.next}`).not.toMatch(/vulnerable|fail|bad|wrong/i);
  });

  it('calls a success after a miss Improved, and a second scenario Independent', () => {
    const miss = call({ linkStep: 3 });
    const fix = call({ ownAppStep: 2 });
    expect(skillUpdate([miss, fix], fix.id)).toMatchObject({ skill: 'verify', outcome: 'Improved' });
    const other = call({ ownAppStep: 2, scenarioId: 'carrier' });
    expect(skillUpdate([miss, fix, other], other.id)).toMatchObject({ skill: 'verify', outcome: 'Independent' });
  });

  it('records guidance honestly', () => {
    const guided = call({ ownAppStep: 3, hintSteps: [2] });
    expect(skillUpdate([guided], guided.id)).toMatchObject({ outcome: 'Practiced', note: 'Successful with guidance.' });
  });

  it('keeps a drill on its own skill', () => {
    const drill = call({ drill: 'exit', ownAppStep: 2, endedBy: 'player', replies: [reply(2, 'Disconnect', 'I am hanging up now')] });
    expect(skillUpdate([drill], drill.id)!.skill).toBe('exit');
  });
});
