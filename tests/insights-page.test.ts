import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { InsightsView } from '../lib/insights/routes';

const view: InsightsView = {
  minPlayers: 5,
  groups: [
    { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'fell for', hidden: false, calls: 51, players: 40, avgSeconds: 151 },
    { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'caught', hidden: false, calls: 42, players: 35, avgSeconds: 88 },
    { category: 'Tech support', tactic: 'Fear', outcome: 'caught', hidden: false, calls: 30, players: 25, avgSeconds: 90 },
    { category: 'Tech support', tactic: 'Fear', outcome: 'false alarm', hidden: false, calls: 12, players: 11, avgSeconds: 47 },
    { category: 'Prize or sweepstakes', tactic: 'Reward', outcome: 'trusted real', hidden: true, note: 'Fewer than 5 Players' },
  ],
  summary: { text: 'Overview\nOf 123 scam calls, 51 fooled someone.\nWhat carriers can do\n- Warn customers.', generatedAt: '2026-11-08T12:00:00.000Z', stale: false },
};

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
let status = 200;
vi.mock('../lib/insights/server', () => ({
  insightsHandlers: () => ({ GET: async () => (status === 200 ? Response.json(view) : new Response(null, { status })) }),
}));

async function render(searchParams: Record<string, string> = {}) {
  const { default: InsightsPage } = await import('../app/insights/page');
  return renderToStaticMarkup(await InsightsPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('Carrier insights page', () => {
  it('names the charts as fail rates and adds the pie and call-time charts', async () => {
    status = 200;
    const html = await render();
    for (const text of ['Fail rate by Category', 'Fail rate by Tactic', 'How calls ended', 'Average time on call by outcome', 'Average time on call by Category', 'Average time on call']) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/Fell-for rate/);
    expect(html).toContain('55% fail rate'); // Bank fraud alert: 51 of 93 scam calls
    expect(html).toContain('2:31'); // 151 seconds
    expect(html).toContain('<svg');
  });

  it('never mentions synthetic or demo data and offers no dataset toggle', async () => {
    status = 200;
    const html = await render();
    expect(html).not.toMatch(/synthetic|demo data|Real Players/i);
    expect(html).not.toContain('?synthetic=');
  });

  it('prints every pie slice as text in the legend', async () => {
    status = 200;
    const html = await render();
    for (const label of ['Fell for', 'Caught', 'False alarm', 'Trusted real']) expect(html).toContain(label);
  });

  it('shows the password screen when locked, and the error after a wrong password', async () => {
    status = 401;
    expect(await render()).toContain('Open insights');
    expect(await render({ error: '1' })).toContain('didn’t work');
  });
});
