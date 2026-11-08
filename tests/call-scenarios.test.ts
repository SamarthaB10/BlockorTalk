import { expect, test } from 'vitest';
import { scenarioCatalog } from '../lib/season/scenarios/catalog';

test('browser catalog offers the ten agreed Categories without caller answers', () => {
  expect(scenarioCatalog.map(row => row.category)).toEqual([
    'Bank fraud alert', 'Delivery or customs fee', 'Holiday gift card or travel deal',
    'Business invoice or CEO wire', 'Phishing link texted mid-call', 'Tech support',
    'Government (IRS or SSN)', 'Prize or sweepstakes', 'Crypto or investment', 'Phone carrier port-out',
  ]);
  for (const row of scenarioCatalog) expect(Object.keys(row).sort()).toEqual(['card', 'category', 'id', 'org', 'secrets']);
});

import { scenarios } from '../lib/season/scenarios/server';
import { redact } from '../lib/policy/redact';
import { leakedSecrets } from '../lib/practice/leaks';

test('each stored Version has four outlines ending with its approved action', () => {
  expect(scenarios).toHaveLength(10);
  for (const row of scenarios) {
    expect(row.versions.real.steps).toHaveLength(4);
    expect(row.versions.scam.steps).toHaveLength(4);
    expect(row.versions.real.steps[3]).toBe(row.versions.real.next_step);
    expect(row.versions.scam.steps[3]).toBe(row.versions.scam.ask_line);
    expect(row.versions.scam.ask_line).toContain('Practice protection code');
  }
  const phishing = scenarios.find(row => row.id === 'phishing')!;
  expect(phishing.versions.scam.steps[2]).toContain('Send the caller link');
  expect(phishing.versions.scam.link?.href).toBe('https://cloudpetal-check.invalid/renew');
  expect(phishing.versions.scam.link?.sheet).not.toEqual(phishing.card.ownApp);
});

test('fictional secrets survive redaction and spoken normalization', () => {
  const words: Record<string, string> = { '0': 'oh', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' };
  for (const row of scenarioCatalog) for (const secret of row.secrets) {
    expect(redact(secret.value)).toBe(secret.value);
    expect(leakedSecrets(redact(secret.value), row.secrets)).toEqual(['Practice protection code']);
    expect(leakedSecrets(redact([...secret.value].map(d => words[d]).join(' ')), row.secrets)).toEqual(['Practice protection code']);
  }
});
