import { expect, test } from 'vitest';
import { createCallPlanner, fixedLines } from '../lib/season/calls/planner';
import { assertPlaybooksCover, playbookFor } from '../lib/season/scenarios/beats';
import { scenarioCatalog } from '../lib/season/scenarios/catalog';
import { scenarios } from '../lib/season/scenarios/server';

const scenario = scenarios[0]!;
const examples = Array.from({ length: 5 }, (_, i) => ({ id: String(i), dialogue: 'Untrusted example', label: 0 as const, source: 'fixture' }));
const safe = ['Hello from Puffinvale Bank about your practice notice.', 'A practice purchase is waiting for review.', 'Please review the notice through your own bank app using its saved contact.'];
function model(lines: unknown) { return { chat: async () => ({ message: { tool_calls: [{ function: { name: 'write_steps', arguments: JSON.stringify({ lines }) } }] } }) }; }

test('every catalog Category has a strong-agent playbook', () => {
  assertPlaybooksCover(scenarioCatalog.map(row => row.category));
  for (const row of scenarios) {
    const book = playbookFor(row.category)!;
    expect(book.fixed(row, 'scam')).toHaveLength(3);
    expect(book.fixed(row, 'real')[2]).toMatch(book.realMotif);
    expect(book.fixed(row, 'scam')[2]).toMatch(book.scamMotif);
    expect(row.versions.scam.ask_line).toBe(book.askLine);
  }
});

test('Nemotron receives five reference examples and produces only the first three spoken lines', async () => {
  let received: unknown;
  const plan = createCallPlanner({ examples: async (_category, version) => { expect(version).toBe('real'); return examples; },
    model: { chat: async request => { received = request; return model(safe).chat(); } } });
  expect(await plan(scenario, 'real')).toEqual({ lines: safe, path: 'nemotron' });
  expect(JSON.stringify(received)).toContain('Untrusted example');
  expect(JSON.stringify(received)).not.toContain(scenario.secrets[0]!.value);
});

test('missing dependencies, invalid model lines, contact data, secret values and giveaways fall back to spoken lines', async () => {
  for (const lines of [[], [...safe, 'fourth'], ['Introduce this caller', ...safe.slice(1)],
    ['This is a real call from Puffinvale Bank.', ...safe.slice(1)], ['I am a genuine caller from Puffinvale Bank.', ...safe.slice(1)], ['An authentic caller is speaking to you now.', ...safe.slice(1)], ['This is a scam caller.', ...safe.slice(1)], ['Use https://example.com now', ...safe.slice(1)],
    ['Your code is eight two oh one', ...safe.slice(1)], ['Please read your PIN now.', ...safe.slice(1)],
    ['Please send your gift card code.', ...safe.slice(1)], ['Please pay by wire transfer now.', ...safe.slice(1)], ['Meet at 124 Pecan Road.', ...safe.slice(1)], ['Email player@example.com', ...safe.slice(1)], ['Call 212-555-0123', ...safe.slice(1)]]) {
    const planned = await createCallPlanner({ examples: async () => examples, model: model(lines) })(scenario, 'real');
    expect(planned).toEqual({ lines: fixedLines(scenario, 'real'), path: 'fixed', fallbackReason: expect.any(String) });
  }
  expect(await createCallPlanner({ examples: async () => { throw new Error('offline'); }, model: model(safe) })(scenario, 'real')).toMatchObject({ path: 'fixed', lines: fixedLines(scenario, 'real') });
  expect(await createCallPlanner({ examples: async () => examples, model: null })(scenario, 'scam')).toMatchObject({ path: 'fixed', lines: fixedLines(scenario, 'scam') });
  expect(fixedLines(scenario, 'scam')[0]).toMatch(/^Hello/);
});

test('a missed tactic is named only as pressure, never as a past call or a score', async () => {
  let system = '';
  const plan = createCallPlanner({ examples: async () => examples, model: { chat: async request => { system = request.messages[0]!.content; return model(safe).chat(); } } });
  expect(await plan(scenario, 'real', { press: true })).toEqual({ lines: safe, path: 'nemotron' });
  expect(system).toContain('missed this assigned pressure lever');
  expect(system).not.toContain('score');
  expect(await plan(scenario, 'real')).toEqual({ lines: safe, path: 'nemotron' });
  expect(system).not.toContain('missed this assigned pressure lever');
});

test('neutral real-world facts do not disclose the assigned caller identity', async () => {
  const lines = ['This practice notice uses a real-world example.', ...safe.slice(1)] as [string, string, string];
  expect(await createCallPlanner({ examples: async () => examples, model: model(lines) })(scenario, 'real')).toEqual({ lines, path: 'nemotron' });
});

test('carrier drills use Magenta-pattern playbooks: transfer notice, OTP ask, own-app real path', async () => {
  const carrier = scenarios.find(row => row.id === 'carrier')!;
  expect(carrier.card.facts[0]).toMatch(/pending number transfer/i);
  expect(carrier.versions.scam.ask_line).toMatch(/verification code that was just texted/i);
  expect(carrier.versions.scam.steps[2]).toMatch(/transfer will finish soon|pending transfer/i);
  expect(carrier.versions.real.steps[2]).toMatch(/own carrier app|saved contact/i);
  expect(fixedLines(carrier, 'scam')[0]).toMatch(/account security|number transfer/i);
  expect(fixedLines(carrier, 'real')[2]).toMatch(/own carrier app|saved contact/i);
  let system = '';
  const scamExamples = examples.map(e => ({ ...e, label: 1 as const }));
  const safeCarrier = fixedLines(carrier, 'scam');
  const planned = await createCallPlanner({
    examples: async () => scamExamples,
    model: { chat: async request => { system = request.messages[0]!.content; return model(safeCarrier).chat(); } },
  })(carrier, 'scam');
  expect(planned).toEqual({ lines: safeCarrier, path: 'nemotron' });
  expect(system).toContain('Category playbook:');
  expect(system).toMatch(/pending number transfer|verification code|caller ID/i);
  expect(system).not.toMatch(/T-Mobile|Magenta/i);
});

test('weak motif lines fall back to the fixed playbook path', async () => {
  const carrier = scenarios.find(row => row.id === 'carrier')!;
  const weak = ['Hello from Bramblebell Mobile about your line.', carrier.card.facts[0]!, 'Thank you for your time today on this practice call.'];
  const planned = await createCallPlanner({
    examples: async () => examples.map(e => ({ ...e, label: 1 as const })),
    model: model(weak),
  })(carrier, 'scam');
  expect(planned.path).toBe('fixed');
  expect(planned.fallbackReason).toBe('motif');
  expect(planned.lines).toEqual(fixedLines(carrier, 'scam'));
});

test('FTC alert keywords map SIM swap and account-PIN language to the carrier drill', async () => {
  const { scenarioIdForAlert } = await import('../lib/practice/planner.ts');
  expect(scenarioIdForAlert({ title: 'SIM swap and eSIM port-out', summary: 'verification code and account pin' })).toBe('carrier');
  expect(scenarioIdForAlert({ title: 'Wireless account takeover', summary: 'Scam Shield tip' })).toBe('carrier');
});
