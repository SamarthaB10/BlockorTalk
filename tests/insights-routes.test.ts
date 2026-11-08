import { describe, expect, it } from 'vitest';
import type { CallRow, Tactic, Verdict, Version } from '../lib/season/analysis';
import { createInsightsHandlers, INSIGHTS_COOKIE, type InsightsStore, type StoredSummary } from '../lib/insights/routes';
import { insightsHandlers } from '../lib/insights/server';
import { INSIGHTS_PASSWORD } from '../lib/insights/access';

const PASSWORD = 'correct horse battery staple';
const NOW = Date.parse('2026-11-08T12:00:00Z');
const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString();

type Spec = { players: number; category: string; tactic: Tactic; version: Version; verdict: Verdict; leaked?: boolean; synthetic?: boolean; seconds?: number | null };
/** `players` distinct Players, one finished call each. Ids and scenario ids are recognisable so a leak is findable. */
function calls(spec: Spec): CallRow[] {
  return Array.from({ length: spec.players }, (_, i) => ({
    playerId: `player-secret-${spec.category}-${spec.synthetic ? 's' : 'r'}-${i}`,
    scenarioId: `scenario-secret-${spec.category}`,
    category: spec.category, tactic: spec.tactic, version: spec.version, verdict: spec.verdict,
    leaked: spec.leaked ?? false, synthetic: spec.synthetic ?? false, seconds: spec.seconds ?? null,
  }));
}

const realRows = [
  ...calls({ players: 6, category: 'Bank fraud alert', tactic: 'Details as proof', version: 'scam', verdict: 'Real' }), // fell for, shown
  ...calls({ players: 2, category: 'Tech support', tactic: 'Fear', version: 'scam', verdict: 'Scam' }),                // caught, hidden
];
const syntheticRows = [
  ...calls({ players: 8, category: 'Bank fraud alert', tactic: 'Details as proof', version: 'scam', verdict: 'Real', synthetic: true, seconds: 150 }),
  ...calls({ players: 1, category: 'Bank fraud alert', tactic: 'Details as proof', version: 'scam', verdict: 'Real', synthetic: true, seconds: null }).map(c => ({ ...c, playerId: 'player-secret-untimed' })),
  ...calls({ players: 7, category: 'Tech support', tactic: 'Fear', version: 'scam', verdict: 'Scam', synthetic: true, seconds: 61 }),
  ...calls({ players: 3, category: 'Prize or sweepstakes', tactic: 'Reward', version: 'real', verdict: 'Scam', synthetic: true }), // hidden
];

function fixture(options: { password?: string | undefined; summary?: StoredSummary | null; llm?: () => Promise<string | null>; now?: number; storeFails?: boolean } = {}) {
  let stored: StoredSummary | null = options.summary ?? null;
  const saved: StoredSummary[] = [];
  const analystCalls: unknown[] = [];
  const datasets: string[] = [];
  const summaryBuckets: boolean[] = [];
  const store: InsightsStore = {
    async loadCalls(include) {
      datasets.push(include);
      if (options.storeFails) throw new Error('database down');
      return include === 'synthetic' ? syntheticRows : realRows;
    },
    async latestSummary(synthetic) { summaryBuckets.push(synthetic); return stored; },
    async saveSummary(summary) { stored = summary; saved.push(summary); },
  };
  const handlers = createInsightsHandlers({
    password: 'password' in options ? options.password : PASSWORD,
    store,
    analyst: async (groups, synthetic) => { analystCalls.push({ groups, synthetic }); return options.llm ? options.llm() : 'Bank fraud alerts that lean on details as proof are the most common fall.'.replace(/\n/g, ' '); },
    now: () => options.now ?? NOW,
  });
  const request = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const { cookie, ...rest } = init;
    return new Request(`https://tell.test${path}`, { ...rest, headers: { ...(cookie ? { cookie } : {}), ...(rest.headers as Record<string, string> | undefined) } });
  };
  /** Sign in the way a browser does and return the cookie header to send back. */
  async function signIn(password = PASSWORD) {
    const response = await handlers.unlock(request('/api/insights/unlock', {
      method: 'POST', headers: { origin: 'https://tell.test', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password }).toString(),
    }));
    const setCookie = response.headers.get('set-cookie');
    return { response, setCookie, cookie: setCookie ? setCookie.split(';')[0]! : undefined };
  }
  return { handlers, request, signIn, saved, analystCalls, datasets, summaryBuckets, stored: () => stored };
}

describe('access', () => {
  it('blocks every route without the cookie', async () => {
    const { handlers, request, analystCalls } = fixture();
    const json = await handlers.GET(request('/api/insights'));
    const csv = await handlers.CSV(request('/api/insights/csv'));
    expect(json.status).toBe(401);
    expect(csv.status).toBe(401);
    expect(await json.json()).toEqual({ locked: true });
    expect(analystCalls).toEqual([]);
  });

  it('a wrong password sets no cookie and sends the Player back to the prompt', async () => {
    const { signIn } = fixture();
    const { response, setCookie } = await signIn('guess');
    expect(setCookie).toBeNull();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://tell.test/insights?error=1');
  });

  it('the right password sets an HttpOnly cookie that does not contain the password', async () => {
    const { signIn } = fixture();
    const { response, setCookie } = await signIn();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://tell.test/insights');
    expect(setCookie).toMatch(new RegExp(`^${INSIGHTS_COOKIE}=[a-f0-9]{64};`));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).not.toContain(PASSWORD);
    expect(setCookie).not.toContain(encodeURIComponent(PASSWORD));
  });

  it('the cookie opens the totals; a tampered cookie does not', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    expect((await handlers.GET(request('/api/insights', { cookie }))).status).toBe(200);
    expect((await handlers.GET(request('/api/insights', { cookie: `${INSIGHTS_COOKIE}=${'0'.repeat(64)}` }))).status).toBe(401);
    expect((await handlers.GET(request('/api/insights', { cookie: `${INSIGHTS_COOKIE}=${PASSWORD}` }))).status).toBe(401);
  });

  it('refuses a sign-in from another origin', async () => {
    const { handlers, request } = fixture();
    const response = await handlers.unlock(request('/api/insights/unlock', {
      method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/x-www-form-urlencoded' }, body: `password=${encodeURIComponent(PASSWORD)}`,
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('fails closed with an empty password, even for an empty submission or a cookie made from an empty password', async () => {
    for (const password of [undefined, '']) {
      const { handlers, request, signIn } = fixture({ password });
      const { setCookie } = await signIn('');
      expect(setCookie).toBeNull();
      const forged = `${INSIGHTS_COOKIE}=${'a'.repeat(64)}`;
      expect((await handlers.GET(request('/api/insights', { cookie: forged }))).status).toBe(401);
    }
  });

  it('does not set a Secure cookie on plain http (local dev)', async () => {
    const { handlers } = fixture();
    const response = await handlers.unlock(new Request('http://localhost:5173/api/insights/unlock', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/x-www-form-urlencoded' }, body: `password=${encodeURIComponent(PASSWORD)}`,
    }));
    expect(response.headers.get('set-cookie')).not.toMatch(/Secure/i);
  });
});

describe('totals', () => {
  it('shows the synthetic dataset only, never real rows, and hides small groups without counts', async () => {
    const { handlers, request, signIn, datasets } = fixture();
    const { cookie } = await signIn();
    const response = await handlers.GET(request('/api/insights', { cookie }));
    const body = await response.json() as any;
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(datasets).toEqual(['synthetic']);
    expect(body.groups).toEqual([
      { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'fell for', hidden: false, calls: 9, players: 9, avgSeconds: 150 },
      { category: 'Prize or sweepstakes', tactic: 'Reward', outcome: 'false alarm', hidden: true, note: 'Fewer than 5 Players' },
      { category: 'Tech support', tactic: 'Fear', outcome: 'caught', hidden: false, calls: 7, players: 7, avgSeconds: 61 },
    ]);
  });

  it('ignores any request for the real dataset', async () => {
    const { handlers, request, signIn, datasets } = fixture();
    const { cookie } = await signIn();
    await handlers.GET(request('/api/insights?synthetic=0&dataset=real', { cookie }));
    expect(datasets).toEqual(['synthetic']);
  });

  it('never labels the data as synthetic or demo', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    const json = await (await handlers.GET(request('/api/insights', { cookie }))).text();
    const csv = await (await handlers.CSV(request('/api/insights/csv', { cookie }))).text();
    for (const text of [json, csv]) expect(text).not.toMatch(/synthetic|demo|real players/i);
  });

  it('averages call time only over calls with a known length', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    // Eight timed calls of 150 s and one with no length: the average is 150, not 133.
    expect(body.groups[0].avgSeconds).toBe(150);
  });

  it('reports a store failure without a stack or details', async () => {
    const { handlers, request, signIn } = fixture({ storeFails: true });
    const { cookie } = await signIn();
    const response = await handlers.GET(request('/api/insights', { cookie }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('database down');
  });
});

describe('nothing identifying leaves the server', () => {
  const forbidden = [/player-secret/, /scenario-secret/, /email/i, /nickname/i, /playerId/, /player_id/, /transcript/i, /@/, /[0-9a-f]{8}-[0-9a-f]{4}-/];

  it('JSON and CSV carry no Player, scenario, email, nickname or transcript field', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    const json = await (await handlers.GET(request('/api/insights', { cookie }))).text();
    const csv = await (await handlers.CSV(request('/api/insights/csv', { cookie }))).text();
    for (const pattern of forbidden) {
      expect(json, `json ${pattern}`).not.toMatch(pattern);
      expect(csv, `csv ${pattern}`).not.toMatch(pattern);
    }
  });

  it('only whitelisted keys appear on a group', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    expect(Object.keys(body).sort()).toEqual(['groups', 'minPlayers', 'summary']);
    for (const group of body.groups) {
      expect(Object.keys(group).sort()).toEqual(group.hidden
        ? ['category', 'hidden', 'note', 'outcome', 'tactic']
        : ['avgSeconds', 'calls', 'category', 'hidden', 'outcome', 'players', 'tactic']);
    }
  });
});

describe('the summary', () => {
  const fresh = (minutesAgo: number): StoredSummary => ({ text: 'Stored summary.', source: 'model', generatedAt: minutes(minutesAgo), synthetic: true });

  it('is written from visible totals only, with call times, and stored with its time', async () => {
    const { handlers, request, signIn, saved, analystCalls, summaryBuckets } = fixture();
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    expect(analystCalls).toHaveLength(1);
    const seen = analystCalls[0] as { groups: any[]; synthetic: boolean };
    expect(seen.groups).toEqual([
      { category: 'Bank fraud alert', tactic: 'Details as proof', outcome: 'fell for', calls: 9, players: 9, avgSeconds: 150 },
      { category: 'Tech support', tactic: 'Fear', outcome: 'caught', calls: 7, players: 7, avgSeconds: 61 },
    ]);
    expect(summaryBuckets).toEqual([true]);
    expect(saved).toEqual([{ text: expect.any(String), source: 'model', generatedAt: new Date(NOW).toISOString(), synthetic: true }]);
    expect(body.summary).toEqual({ text: saved[0]!.text, generatedAt: new Date(NOW).toISOString(), stale: false });
  });

  it('is not regenerated while it is 15 minutes old or newer', async () => {
    const { handlers, request, signIn, analystCalls } = fixture({ summary: fresh(15) });
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    expect(analystCalls).toEqual([]);
    expect(body.summary).toMatchObject({ text: 'Stored summary.', stale: false });
  });

  it('is regenerated on open once it is older than 15 minutes', async () => {
    const { handlers, request, signIn, analystCalls, saved } = fixture({ summary: fresh(16) });
    const { cookie } = await signIn();
    await handlers.GET(request('/api/insights', { cookie }));
    expect(analystCalls).toHaveLength(1);
    expect(saved).toHaveLength(1);
  });

  it('on model failure shows the last summary, marked as older', async () => {
    const { handlers, request, signIn, saved } = fixture({ summary: fresh(60), llm: async () => null });
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    expect(body.summary).toMatchObject({ text: 'Stored summary.', generatedAt: minutes(60), stale: true });
    expect(saved).toEqual([]);
  });

  it('on model failure with no earlier summary shows a fixed sentence', async () => {
    const { handlers, request, signIn, saved } = fixture({ llm: async () => null });
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    expect(body.summary.text).toBe('A written summary is not available right now. The totals below are current.');
    expect(body.summary.generatedAt).toBeNull();
    expect(saved).toEqual([]);
  });

  it('a model that throws is treated like a failure', async () => {
    const { handlers, request, signIn } = fixture({ llm: async () => { throw new Error('boom'); } });
    const { cookie } = await signIn();
    const response = await handlers.GET(request('/api/insights', { cookie }));
    expect(response.status).toBe(200);
    expect((await response.json() as any).summary.generatedAt).toBeNull();
  });

  it('does not call the model when no group is visible', async () => {
    const hiddenOnly = createInsightsHandlers({
      password: PASSWORD,
      store: { async loadCalls() { return calls({ players: 2, category: 'Tech support', tactic: 'Fear', version: 'scam', verdict: 'Scam', synthetic: true }); }, async latestSummary() { return fresh(60); }, async saveSummary() { throw new Error('should not save'); } },
      analyst: async () => { throw new Error('should not be called'); },
      now: () => NOW,
    });
    const unlock = await hiddenOnly.unlock(new Request('https://tell.test/api/insights/unlock', { method: 'POST', headers: { origin: 'https://tell.test', 'content-type': 'application/x-www-form-urlencoded' }, body: `password=${encodeURIComponent(PASSWORD)}` }));
    const cookie = unlock.headers.get('set-cookie')!.split(';')[0]!;
    const body = await (await hiddenOnly.GET(new Request('https://tell.test/api/insights', { headers: { cookie } }))).json() as any;
    expect(body.summary.text).toMatch(/no group/i);
    expect(body.groups).toEqual([{ category: 'Tech support', tactic: 'Fear', outcome: 'caught', hidden: true, note: 'Fewer than 5 Players' }]);
  });
});

describe('CSV', () => {
  it('is exactly the totals on screen, with call time and hidden groups shown as hidden', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    const response = await handlers.CSV(request('/api/insights/csv', { cookie }));
    expect(response.headers.get('content-type')).toMatch(/text\/csv/);
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="carrier-insights.csv"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.text()).trimEnd().split('\r\n')).toEqual([
      'Category,Tactic,Outcome,Calls,Players,Average seconds on call,Note',
      'Bank fraud alert,Details as proof,fell for,9,9,150,',
      'Prize or sweepstakes,Reward,false alarm,,,,Fewer than 5 Players',
      'Tech support,Fear,caught,7,7,61,',
    ]);
  });

  it('matches the JSON groups one for one', async () => {
    const { handlers, request, signIn } = fixture();
    const { cookie } = await signIn();
    const body = await (await handlers.GET(request('/api/insights', { cookie }))).json() as any;
    const rows = (await (await handlers.CSV(request('/api/insights/csv', { cookie }))).text()).trimEnd().split('\r\n').slice(1);
    expect(rows.map(r => r.split(',').slice(0, 3).join(','))).toEqual(body.groups.map((g: any) => `${g.category},${g.tactic},${g.outcome}`));
  });
});

describe('production password', () => {
  const unlock = (password: string) => insightsHandlers({} as NodeJS.ProcessEnv).unlock(new Request('https://tell.test/api/insights/unlock', {
    method: 'POST', headers: { origin: 'https://tell.test', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password }).toString(),
  }));

  it('opens with "tmobile" and needs no Worker secret', async () => {
    expect(INSIGHTS_PASSWORD).toBe('tmobile');
    const response = await unlock('tmobile');
    expect(response.headers.get('location')).toBe('https://tell.test/insights');
    expect(response.headers.get('set-cookie')).toMatch(/^tell_insights=[a-f0-9]{64};.*HttpOnly/);
  });

  it('rejects anything else', async () => {
    for (const wrong of ['', 'TMobile', 'tmobile ', 'secret']) {
      const response = await unlock(wrong);
      expect(response.headers.get('location'), wrong).toBe('https://tell.test/insights?error=1');
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });
});
