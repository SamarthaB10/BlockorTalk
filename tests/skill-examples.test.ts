import { describe, expect, it } from 'vitest';
import { exampleCalls, isExampleCall, withExamples } from '../lib/skills/examples';
import { evidenceHref, progressView, type SkillCall } from '../lib/skills/log';
import { createProgressHandlers } from '../lib/skills/server';

const NOW = new Date('2026-11-08T18:00:00Z');

describe('example quizzes', () => {
  it('gives every account six example quizzes, the same on every read', () => {
    const first = exampleCalls('player-a');
    expect(first).toHaveLength(6);
    expect(exampleCalls('player-a')).toEqual(first);
    expect(first.every(call => isExampleCall(call.id))).toBe(true);
  });

  it('gives different accounts different mixes', () => {
    const shape = (id: string) => exampleCalls(id).map(call => `${call.scenarioId}:${call.verdict}`).join('|');
    const shapes = new Set(['a', 'b', 'c', 'd', 'e'].map(id => shape(`player-${id}`)));
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('are dated before the Season, oldest first, and marked as examples', () => {
    const calls = exampleCalls('player-a');
    const times = calls.map(call => Date.parse(call.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(Math.max(...times)).toBeLessThanOrEqual(Date.parse('2026-11-07T22:00:00Z'));
    for (const call of calls) expect(call.category).toMatch(/\(example quiz\)$/);
  });

  it('fill in a Skill Log with real evidence and a recommended drill', () => {
    const view = progressView(exampleCalls('player-a'), NOW);
    expect(view.summary.calls).toBe(6);
    expect(view.skills.some(skill => skill.history.length > 0)).toBe(true);
    expect(view.recommended).not.toBeNull();
    for (const skill of view.skills) for (const entry of skill.history) {
      expect(entry.href).toBe('');
      expect(entry.scenario).toMatch(/example quiz/);
    }
  });

  it('keep real calls on top, so new calls add to the log', () => {
    const real: SkillCall = {
      ...exampleCalls('player-a')[0]!, id: 'real-call-1', category: 'Bank fraud alert', at: '2026-11-08T15:00:00.000Z',
      version: 'scam', verdict: 'Scam', ownAppStep: 2, linkStep: null, hintSteps: [],
      replies: [{ step: 2, move: 'Verify', text: 'I will check my app.', quote: 'I will check my app.', leaked: false }],
    };
    const before = progressView(withExamples('player-a', []), NOW);
    const after = progressView(withExamples('player-a', [real]), NOW);
    expect(after.summary.calls).toBe(before.summary.calls + 1);
    const verify = after.skills.find(skill => skill.id === 'verify')!;
    expect(verify.history[0]).toMatchObject({ day: 'Today', href: evidenceHref({ callId: 'real-call-1', step: 2 }) });
    expect(verify.history[0]!.href).toMatch(/^\/play\/results\/real-call-1/);
  });

  it('reach a signed-in Player through /api/progress', async () => {
    const handlers = createProgressHandlers({ authenticate: async () => 'player-a', calls: async id => withExamples(id, []), now: () => NOW });
    const body = await (await handlers.GET(new Request('https://tell.test/api/progress'))).json() as { progress: ReturnType<typeof progressView> };
    expect(body.progress.summary.calls).toBe(6);
  });
});
