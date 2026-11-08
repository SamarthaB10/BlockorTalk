import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProgressBoard, parseEvidence } from '../app/dashboard/ProgressPanel';
import CallResults from '../app/play/CallResults';
import { buildResults, type FinishedCallView } from '../lib/season/results';
import { withExamples } from '../lib/skills/examples';
import { progressView, type SkillCall } from '../lib/skills/log';

const NOW = new Date('2026-11-08T18:00:00Z');
const real: SkillCall = {
  id: 'real-1', scenarioId: 'bank', category: 'Bank fraud alert', org: 'Puffinvale Bank', tactic: 'Details as proof', version: 'scam',
  verdict: 'Scam', at: '2026-11-08T15:00:00Z', replies: [], ownAppStep: 2, linkStep: null, linkOffered: false,
  hintSteps: [], endedBy: 'replies', drill: null, secretLabel: 'Practice protection code',
};
const progress = progressView(withExamples('player-a', [real]), NOW);
const noop = () => {};

describe('evidence stays on the dashboard', () => {
  it('shows skill evidence without drill controls', () => {
    const html = renderToStaticMarkup(createElement(ProgressBoard, { progress, selected: null, onSelect: noop, onOpenEvidence: noop }));
    expect(html).not.toContain('60-second');
    expect(html).not.toContain('Recommended next');
    expect(html).not.toMatch(/href="\/play\//);
  });

  it('opens real evidence with a button and shows example evidence without a link', () => {
    const html = renderToStaticMarkup(createElement(ProgressBoard, { progress, selected: 'verify', onSelect: noop, onOpenEvidence: noop }));
    expect(html).toContain('see the moment in the transcript</button>');
    expect(html).not.toContain('href="/play/results/');
    expect(html).toMatch(/example quiz/);
  });

  it('still links out when no handlers are given (the /play pages)', () => {
    const html = renderToStaticMarkup(createElement(ProgressBoard, { progress, selected: 'verify', onSelect: noop }));
    expect(html).not.toContain('?drill=');
    expect(html).toContain('href="/play/results/real-1#step-2"');
  });

  it('reads the call and the moment from an evidence link', () => {
    expect(parseEvidence('/play/results/real-1#step-2')).toEqual({ callId: 'real-1', anchor: 'step-2' });
    expect(parseEvidence('/play/results/abc')).toEqual({ callId: 'abc', anchor: null });
    expect(parseEvidence('/elsewhere')).toBeNull();
  });
});

describe('the debrief on the dashboard', () => {
  const call: FinishedCallView = {
    id: 'real-1', playerId: 'p1', seasonId: 's1', scenario: { id: 'bank', category: 'Bank fraud alert', org: 'Puffinvale Bank' },
    version: 'scam', phase: 'complete', scored: false, callsLeft: 3, verdict: 'Scam', replies: [{ step: 2, text: 'Which branch?' }],
    result: { callId: 'real-1', right: 2, wrong: 0, delta: 0, scoredBy: 'agent', outcome: 'caught', total: null,
      moments: [{ n: 1, kind: 'reply', step: 2, right: true, why: 'Asking questions costs nothing.' }, { n: 2, kind: 'verdict', verdict: 'Scam', right: true, why: 'You spotted the scam.' }] },
  };
  const view = buildResults(call, null, true, { skill: null, next: progress.recommended });

  it('offers the way back without drill controls', () => {
    const html = renderToStaticMarkup(createElement(CallResults, { view, onDone: noop }));
    expect(html).not.toContain('60-second');
    expect(html).toContain('Back to your progress</button>');
    expect(html).not.toMatch(/href="\/(play|me|leaderboard)/);
  });

  it('keeps its links on /play/results', () => {
    const html = renderToStaticMarkup(createElement(CallResults, { view }));
    expect(html).toContain('href="/play"');
    expect(html).not.toContain('?drill=');
  });
});
