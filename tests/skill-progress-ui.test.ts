import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import { ProgressBoard } from '../app/dashboard/ProgressPanel';
import { profileLocation } from '../app/dashboard/view';
import { CallScreen } from '../app/play/[id]/CallScreen';
import type { PublicCall } from '../lib/season/calls/types';
import { progressView, type SkillCall } from '../lib/skills/log';

const base = (over: Partial<SkillCall>): SkillCall => ({
  id: 'c1', scenarioId: 'bank', category: 'Bank fraud alert', org: 'Puffinvale Bank', tactic: 'Details as proof', version: 'scam',
  verdict: 'Scam', at: '2026-11-08T15:00:00Z', replies: [], ownAppStep: null, linkStep: null, linkOffered: false,
  hintSteps: [], endedBy: 'replies', drill: null, secretLabel: 'Practice protection code', ...over,
});
const progress = progressView([
  base({ id: 'a', ownAppStep: 2, at: '2026-11-07T15:00:00Z' }),
  base({ id: 'b', scenarioId: 'carrier', org: 'Bramblebell Mobile', category: 'Phone carrier port-out', ownAppStep: 2 }),
  base({ id: 'c', scenarioId: 'delivery', tactic: 'Urgency', org: 'Mossparcel', category: 'Delivery or customs fee', at: '2026-11-08T16:00:00Z',
    replies: [{ step: 3, move: 'Probe', text: 'Why today?', quote: 'Why today?', leaked: false }, { step: 4, move: 'Leak', text: '8202', quote: '8202', leaked: true }] }),
], new Date('2026-11-08T18:00:00Z'));

describe('Progress screen', () => {
  it('leads with the summary and six skill cards without a drill recommendation', () => {
    const html = renderToStaticMarkup(createElement(ProgressBoard, { progress, selected: null, onSelect: () => {} }));
    expect(html).toContain('Your progress');
    expect(html).toMatch(/<strong>\d<\/strong> skills? demonstrated/);
    expect(html).toContain('<strong>1</strong> skill needs practice');
    expect(html).not.toContain('Recommended next');
    expect(html).not.toContain('60-second');
    for (const name of ['Verify independently', 'Protect codes and secrets', 'Resist urgency', 'Challenge authority', 'Inspect payment requests', 'Exit safely']) expect(html).toContain(name);
    expect(html).toContain('2 successful decisions · 2 scenarios');
    expect(html).toContain('Independent');
    expect(html).toContain('Latest evidence');
    expect(html).toContain('Next practice');
    expect(html).not.toContain('8202');
    expect(html).not.toMatch(/\bXP\b|badge|safety score|vulnerable/i);
  });

  it('opens one skill’s evidence log, newest first, linked to each transcript moment', () => {
    const html = renderToStaticMarkup(createElement(ProgressBoard, { progress, selected: 'verify', onSelect: () => {} }));
    expect(html).toContain('id="skill-history"');
    expect(html.indexOf('Today · Demonstrated')).toBeLessThan(html.indexOf('Yesterday · Demonstrated'));
    expect(html).toContain('href="/play/results/b#step-2"');
    expect(html).toContain('aria-expanded="true"');
  });
});

describe('dashboard views', () => {
  it('adds Progress and Profile, and keeps the profile inside the dashboard', () => {
    const progressHtml = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Progress' }));
    expect(progressHtml).toContain('Loading your Skill Log');
    expect(progressHtml).toContain('<button aria-current="page">Progress</button>');
    const profileHtml = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Profile' }));
    expect(profileHtml).toContain('Create your Player profile');
    expect(profileHtml).toContain('id="profile-analysis"');
    for (const html of [progressHtml, profileHtml]) expect(html).not.toMatch(/href="\/profile|href="\/me"/);
    expect(profileLocation('/play/business')).not.toContain('/profile?');
  });
});

describe('drill call screen', () => {
  const call: PublicCall = { id: 'd1', label: 'AI practice caller', scenario: { id: 'delivery', category: 'Delivery or customs fee', org: 'Mossparcel', card: { name: 'Player Fern', facts: ['Parcel MOSS-7'], ownApp: { title: 'Mossparcel', facts: [] } }, secrets: [{ label: 'Practice protection code', value: '8202' }] },
    turns: [{ role: 'caller', text: 'Hello', step: 1 }], phase: 'call', replies: 0, startedAt: '2026-11-08T18:00:00Z', serverNow: '2026-11-08T18:00:00Z',
    scored: false, callsLeft: 3, limitSeconds: 60, hint: 'Ask who is calling and how you could check that yourself.', drill: { skill: 'protect', name: 'Protect codes and secrets' } };
  it('shows the drill, the one-minute cap and an honest hint', () => {
    const html = renderToStaticMarkup(createElement(CallScreen, { scenarioId: 'delivery', initialCall: call }));
    expect(html).toContain('60-second drill · Protect codes and secrets');
    expect(html).toContain('The caller may be real or a scam.');
    expect(html).toContain('Need a hint?');
    expect(html).toContain('Hints are noted in your Skill Log.');
    expect(html).toContain('one minute');
    expect(html).toContain('1:00 remaining');
  });
  it('links a finished call to its debrief', () => {
    const html = renderToStaticMarkup(createElement(CallScreen, { scenarioId: 'delivery', initialCall: { ...call, phase: 'complete', result: {} } }));
    expect(html).toContain('href="/play/results/d1"');
  });
});
