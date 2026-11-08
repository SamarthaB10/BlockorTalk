import { describe, expect, it } from 'vitest';
import { breakdown, overview, reportSections } from '../lib/insights/report';

const groups = [
  { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'fell for', calls: 30 },
  { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'caught', calls: 10 },
  { category: 'Tech support', tactic: 'Fear', outcome: 'fell for', calls: 5 },
  { category: 'Tech support', tactic: 'Fear', outcome: 'caught', calls: 15 },
  { category: 'Delivery or customs fee', tactic: 'Urgency', outcome: 'false alarm', calls: 6 },
  { category: 'Delivery or customs fee', tactic: 'Urgency', outcome: 'trusted real', calls: 14 },
];

describe('Carrier insights numbers', () => {
  it('computes the overview from code', () => {
    expect(overview(groups)).toEqual({
      calls: 80, scamCalls: 60, fellFor: 35, caught: 25, realCalls: 20, falseAlarms: 6, trustedReal: 14,
      fellForRate: 58, catchRate: 42, falseAlarmRate: 30,
    });
  });

  it('has no rate when there is nothing to divide by', () => {
    expect(overview([])).toMatchObject({ calls: 0, fellForRate: null, catchRate: null, falseAlarmRate: null });
  });

  it('ranks Categories and Tactics by fell-for rate', () => {
    expect(breakdown(groups, 'category').map(b => [b.key, b.fellForRate])).toEqual([
      ['Bank fraud alert', 75], ['Tech support', 25], ['Delivery or customs fee', null],
    ]);
    expect(breakdown(groups, 'tactic')[0]).toEqual({ key: 'Details as proof', scamCalls: 40, fellFor: 30, fellForRate: 75, realCalls: 0, falseAlarms: 0 });
    expect(breakdown(groups, 'category')[2]).toMatchObject({ realCalls: 20, falseAlarms: 6 });
  });
});

describe('analysis sections', () => {
  it('splits the analysis at its headings, in any common form', () => {
    const text = 'Overview\nPeople fell for 35 scam calls.\n\n## Scams people fall for most:\nBank fraud alerts lead.\nThey use details.\n\n**What carriers can do**\n- Send alerts.\n- Label calls.';
    expect(reportSections(text)).toEqual([
      { heading: 'Overview', paragraphs: ['People fell for 35 scam calls.'] },
      { heading: 'Scams people fall for most', paragraphs: ['Bank fraud alerts lead. They use details.'] },
      { heading: 'What carriers can do', paragraphs: ['Send alerts.', 'Label calls.'] },
    ]);
  });

  it('keeps an older one-paragraph summary as a single untitled section', () => {
    expect(reportSections('Bank fraud alerts lead, with 31 calls.')).toEqual([{ heading: null, paragraphs: ['Bank fraud alerts lead, with 31 calls.'] }]);
  });
});
