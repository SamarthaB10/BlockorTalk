import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CallResults from '../app/play/CallResults';
import type { FinishedCallView } from '../lib/season/results';
import { createResultsHandlers, type ResultsStore } from '../lib/season/resultsRoutes';
import type { CallRecord } from '../lib/season/calls/store';
import { scenarios } from '../lib/season/scenarios/server';
import { createProgressHandlers, toSkillCall } from '../lib/skills/server';
import type { SkillCall } from '../lib/skills/log';

const phishing = scenarios.find(row => row.id === 'phishing')!;
const record = (over: Partial<CallRecord> = {}): CallRecord => ({
  id: 'call-1', playerId: 'p1', seasonId: 's1', scenario: phishing, version: 'scam',
  lines: ['Hi', 'Your renewal is due.', 'Renew now at this link.', 'Please read me your code.'],
  startedAt: '2026-11-08T15:00:00Z', endedAt: '2026-11-08T15:02:00Z', scored: false, callsLeft: 3, phase: 'complete',
  turns: [
    { role: 'caller', text: 'Hi', step: 1 }, { role: 'player', text: 'Who is this?', step: 1 },
    { role: 'caller', text: 'Your renewal is due.', step: 2 }, { role: 'player', text: 'Which club?', step: 2 },
    { role: 'caller', text: 'Renew now at this link.', step: 3 }, { role: 'player', text: 'I will check my own app.', step: 3 },
  ],
  replies: [{ step: 1, text: 'Who is this?', leaks: [] }, { step: 2, text: 'Which club?', leaks: [] }, { step: 3, text: 'I will check my own app.', leaks: [] }],
  verifyEvents: [{ at: '2026-11-08T15:01:00Z', step: 3 }], leaks: [], verdict: 'Scam', endedBy: 'player',
  hintEvents: [], linkEvents: [],
  result: { callId: 'call-1', right: 3, wrong: 0, delta: 0, scoredBy: 'agent', outcome: 'caught', total: null, moments: [
    { n: 1, kind: 'reply', step: 2, move: 'Probe', right: true, blokbuks: 0, why: 'Asking costs nothing.', quote: 'Which club?' },
    { n: 2, kind: 'reply', step: 3, move: 'Verify', right: true, blokbuks: 0, why: 'Checking is safest.', quote: 'I will check my own app' },
    { n: 3, kind: 'verdict', verdict: 'Scam', right: true, blokbuks: 0, why: 'You spotted the scam.' },
  ] },
  ...over,
});

describe('stored calls as Skill Log evidence', () => {
  it('reads Moves, own-app checks, the caller link and hints from the call record', () => {
    const call = toSkillCall(record({ linkEvents: [{ at: 'x', step: 3 }], hintEvents: [{ at: 'y', step: 2 }] }))!;
    expect(call).toMatchObject({ scenarioId: 'phishing', tactic: 'Urgency', ownAppStep: 3, linkStep: 3, linkOffered: true, hintSteps: [2], endedBy: 'player', at: '2026-11-08T15:02:00Z' });
    expect(call.replies.map(reply => reply.move)).toEqual(['Probe', 'Probe', 'Verify']);
    expect(toSkillCall(record({ phase: 'verdict', verdict: undefined }))).toBeNull();
  });
});

describe('progress route', () => {
  it('asks a signed-out visitor to sign in and never fails open', async () => {
    const signedOut = createProgressHandlers({ authenticate: async () => null, calls: async () => [] });
    expect((await signedOut.GET(new Request('https://tell.test/api/progress'))).status).toBe(401);
    const down = createProgressHandlers({ authenticate: async () => 'p1', calls: async () => { throw new Error('db'); } });
    expect((await down.GET(new Request('https://tell.test/api/progress'))).status).toBe(503);
  });

  it('returns the Skill Log built from the Player’s calls', async () => {
    const handlers = createProgressHandlers({ authenticate: async () => 'p1', calls: async () => [toSkillCall(record())!], now: () => new Date('2026-11-08T18:00:00Z') });
    const response = await handlers.GET(new Request('https://tell.test/api/progress'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const { progress } = await response.json() as { progress: { skills: { id: string; state: string; latest: string }[] } };
    expect(progress.skills.find(skill => skill.id === 'verify')).toMatchObject({ state: 'Demonstrated', latest: 'Opened your own Cloudpetal Club app instead of using the caller’s link.' });
  });
});

const view = (state: CallRecord): FinishedCallView => ({
  id: state.id, playerId: state.playerId, seasonId: state.seasonId, scenario: { id: state.scenario.id, category: state.scenario.category, org: state.scenario.org },
  version: state.version, phase: state.phase, scored: state.scored, callsLeft: state.callsLeft, verdict: state.verdict,
  replies: state.replies.map(({ step, text }) => ({ step, text })), turns: state.turns,
  result: state.result as FinishedCallView['result'],
});

function resultsFor(calls: () => Promise<SkillCall[]>) {
  const state = record();
  const store: ResultsStore = { call: async () => view(state), scores: async () => [], finishedCalls: async () => 1, skillCalls: calls };
  return createResultsHandlers({ authenticate: async () => 'p1', store }).GET(new Request('https://tell.test/api/play/results/call-1'), 'call-1');
}

describe('debrief skill update', () => {
  it('adds one skill update, a recommended drill and transcript anchors to the results', async () => {
    const response = await resultsFor(async () => [toSkillCall(record())!]);
    const { results } = await response.json() as { results: Parameters<typeof CallResults>[0]['view'] };
    expect(results.skill).toMatchObject({ label: 'Verify independently · Demonstrated', why: 'You opened your own Cloudpetal Club app instead of using the caller’s link.' });
    expect(results.next).toMatchObject({ title: expect.stringMatching(/^Practice /), href: expect.stringMatching(/^\/play\/[^/?]+\?drill=/) });
    const html = renderToStaticMarkup(createElement(CallResults, { view: results }));
    expect(html).toContain('Skill updated');
    expect(html).toContain('Verify independently · Demonstrated');
    expect(html).toContain('Start 60-second drill');
    expect(html).toContain('id="step-3"');
    expect(html).toContain('id="verdict"');
    expect(html).toContain('href="/dashboard?view=Progress"');
  });

  it('still shows the results when the Skill Log cannot be read', async () => {
    const response = await resultsFor(async () => { throw new Error('db'); });
    expect(response.status).toBe(200);
    const { results } = await response.json() as { results: { skill: unknown; next: unknown } };
    expect(results.skill).toBeNull();
    expect(results.next).toBeNull();
  });
});
