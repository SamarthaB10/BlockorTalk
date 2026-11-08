import { describe, expect, it } from 'vitest';
import { breakdown, callTime, executiveSummary, minutes, outcomeMix, overview, reportSections } from '../lib/insights/report';

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

describe('time on call', () => {
  const timed = [
    { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'fell for', calls: 30, avgSeconds: 150 },
    { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'caught', calls: 10, avgSeconds: 90 },
    { category: 'Tech support', tactic: 'Fear', outcome: 'caught', calls: 15, avgSeconds: 70 },
    { category: 'Delivery or customs fee', tactic: 'Urgency', outcome: 'false alarm', calls: 6, avgSeconds: null },
  ];

  it('weights averages by calls and skips groups with no known length', () => {
    expect(callTime(timed)).toEqual({
      overall: 117, // (30×150 + 10×90 + 15×70) ÷ 55
      byOutcome: [{ key: 'fell for', avgSeconds: 150 }, { key: 'caught', avgSeconds: 78 }],
      byCategory: [{ key: 'Bank fraud alert', avgSeconds: 135 }, { key: 'Tech support', avgSeconds: 70 }],
    });
  });

  it('has no average when nothing has a length', () => {
    expect(callTime([])).toEqual({ overall: null, byOutcome: [], byCategory: [] });
  });

  it('formats seconds as minutes:seconds', () => {
    expect([minutes(95), minutes(180), minutes(7), minutes(null)]).toEqual(['1:35', '3:00', '0:07', '—']);
  });
});

describe('outcome mix and executive summary', () => {
  const rows = [
    { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'fell for', calls: 51, avgSeconds: 151 },
    { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'caught', calls: 42, avgSeconds: 88 },
    { category: 'Tech support', tactic: 'Fear', outcome: 'caught', calls: 30, avgSeconds: 90 },
    { category: 'Tech support', tactic: 'Fear', outcome: 'false alarm', calls: 12, avgSeconds: 47 },
    { category: 'Tech support', tactic: 'Fear', outcome: 'trusted real', calls: 20, avgSeconds: 60 },
  ];

  it('splits each Category into the four outcomes in fixed order, busiest first', () => {
    const mix = outcomeMix(rows, 'category');
    expect(mix.map(row => [row.key, row.total])).toEqual([['Bank fraud alert', 93], ['Tech support', 62]]);
    expect(mix[1]!.parts.map(part => [part.outcome, part.calls])).toEqual([['fell for', 0], ['caught', 30], ['false alarm', 12], ['trusted real', 20]]);
  });

  it('writes plain findings from the same numbers the charts show', () => {
    const lines = executiveSummary(rows);
    expect(lines).toEqual([
      '155 practice calls analysed: 123 scam calls and 32 real ones.',
      'Scam calls fooled people 41% of the time (51 of 123). The other 59% were caught.',
      'Bank fraud alert is the riskiest Category: a 55% fail rate across 93 scam calls.',
      'Details as proof is the Tactic that works best for scammers, with a 55% fail rate.',
      '38% of real callers were wrongly treated as scams (12 of 32).',
      'Calls that fooled people lasted 2:31 on average; calls people caught lasted 1:29. Longer calls favour the scammer.',
    ]);
  });

  it('says nothing when there are no calls', () => {
    expect(executiveSummary([])).toEqual([]);
  });
});
