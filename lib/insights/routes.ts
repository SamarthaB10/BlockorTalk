/**
 * Carrier insights (docs/BLOKBUKS_SEASON.md, docs/adr/0002): anonymous Category × Tactic × outcome
 * totals for T-Mobile, built from the synthetic demo dataset only (real Player data is not shown here). Everything leaving this file is built from `insightTotals`, which returns
 * fresh objects with no Player id, scenario id, email, nickname or transcript, and hides any group
 * under five Players without a count. The store, analyst, clock and password are injected so tests
 * use fakes, as with the other route factories.
 */
import { insightTotals, MIN_PLAYERS, outcomeOf, type CallRow, type InsightGroup } from '../season/analysis.ts';
import type { ShownGroup } from './analyst.ts';
import { accessToken, isAuthorized, passwordMatches, sessionCookie } from './access.ts';

export { INSIGHTS_COOKIE } from './access.ts';

/** A summary older than this is rewritten the next time the page opens. */
export const SUMMARY_MAX_AGE_MS = 15 * 60 * 1000;
export const FIXED_SUMMARY = 'A written summary is not available right now. The totals below are current.';
const NO_GROUPS_SUMMARY = `No group has reached ${MIN_PLAYERS} Players yet, so there is nothing to summarise.`;
const HIDDEN_NOTE = `Fewer than ${MIN_PLAYERS} Players`;

export type StoredSummary = { text: string; source: 'model'; generatedAt: string; synthetic: boolean };
export type Dataset = 'real' | 'synthetic';

export interface InsightsStore {
  /** Finished calls of one dataset. Never returned to a browser; only `insightTotals` output is. */
  loadCalls(include: Dataset): Promise<CallRow[]>;
  latestSummary(synthetic: boolean): Promise<StoredSummary | null>;
  saveSummary(summary: StoredSummary): Promise<void>;
}

export interface InsightsDeps {
  /** The shared password (INSIGHTS_PASSWORD in production). Empty means nothing can unlock. */
  password: string | undefined;
  store: InsightsStore;
  /** Totals in, summary text out; null on any failure. */
  analyst(groups: ShownGroup[], synthetic: boolean): Promise<string | null>;
  now?: () => number;
}

export type ViewGroup =
  | { category: string; tactic: string; outcome: string; hidden: true; note: string }
  | { category: string; tactic: string; outcome: string; hidden: false; calls: number; players: number; avgSeconds: number | null };

export type InsightsView = {
  minPlayers: number;
  groups: ViewGroup[];
  summary: { text: string; generatedAt: string | null; stale: boolean };
};

/** The page shows the synthetic demo dataset only. */
const DATASET: Dataset = 'synthetic';
const SYNTHETIC = true;
const headers = { 'Cache-Control': 'no-store' };
const keyOf = (category: string, tactic: string, outcome: string) => JSON.stringify([category, tactic, outcome]);

/** Rebuilt field by field so nothing extra can ride along. */
function toViewGroup(group: InsightGroup, avgSeconds: number | null): ViewGroup {
  return group.hidden
    ? { category: group.category, tactic: group.tactic, outcome: group.outcome, hidden: true, note: HIDDEN_NOTE }
    : { category: group.category, tactic: group.tactic, outcome: group.outcome, hidden: false, calls: group.calls, players: group.players, avgSeconds };
}

/** Average call length per Category × Tactic × outcome, over calls with a known length. */
function averageSeconds(rows: readonly CallRow[]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const row of rows) {
    if (!row.verdict || !row.seconds) continue;
    const key = keyOf(row.category, row.tactic, outcomeOf(row.version, row.verdict, row.leaked));
    const sum = sums.get(key) ?? { total: 0, n: 0 };
    sum.total += row.seconds; sum.n += 1;
    sums.set(key, sum);
  }
  return new Map([...sums].map(([key, { total, n }]) => [key, Math.round(total / n)]));
}

/** Plain CSV. A leading = + - @ would run as a formula in a spreadsheet, so it is defused. */
function cell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function insightsCsv(view: InsightsView): string {
  const rows = view.groups.map(group => [
    group.category, group.tactic, group.outcome,
    group.hidden ? '' : group.calls, group.hidden ? '' : group.players,
    group.hidden || group.avgSeconds === null ? '' : group.avgSeconds, group.hidden ? group.note : '',
  ].map(cell).join(','));
  return ['Category,Tactic,Outcome,Calls,Players,Average seconds on call,Note', ...rows].join('\r\n') + '\r\n';
}

export function createInsightsHandlers(deps: InsightsDeps) {
  const now = deps.now ?? Date.now;

  async function summaryFor(groups: ViewGroup[]): Promise<InsightsView['summary']> {
    const shown = groups.flatMap((group): ShownGroup[] => group.hidden ? [] : [{
      category: group.category, tactic: group.tactic as ShownGroup['tactic'], outcome: group.outcome as ShownGroup['outcome'],
      calls: group.calls, players: group.players, avgSeconds: group.avgSeconds,
    }]);
    if (shown.length === 0) return { text: NO_GROUPS_SUMMARY, generatedAt: null, stale: false };

    const stored = await deps.store.latestSummary(SYNTHETIC).catch(() => null);
    if (stored && now() - Date.parse(stored.generatedAt) <= SUMMARY_MAX_AGE_MS) {
      return { text: stored.text, generatedAt: stored.generatedAt, stale: false };
    }
    const text = await deps.analyst(shown, SYNTHETIC).catch(() => null);
    if (text) {
      const generatedAt = new Date(now()).toISOString();
      await deps.store.saveSummary({ text, source: 'model', generatedAt, synthetic: SYNTHETIC }).catch(() => undefined);
      return { text, generatedAt, stale: false };
    }
    return stored
      ? { text: stored.text, generatedAt: stored.generatedAt, stale: true }
      : { text: FIXED_SUMMARY, generatedAt: null, stale: false };
  }

  async function view(): Promise<InsightsView> {
    const rows = await deps.store.loadCalls(DATASET);
    const averages = averageSeconds(rows);
    const groups = insightTotals(rows, { include: DATASET })
      .map(group => toViewGroup(group, averages.get(keyOf(group.category, group.tactic, group.outcome)) ?? null));
    return { minPlayers: MIN_PLAYERS, groups, summary: await summaryFor(groups) };
  }

  const locked = () => Response.json({ locked: true }, { status: 401, headers });
  const unavailable = () => Response.json({ error: 'Insights are not available right now. Please try again soon.' }, { status: 503, headers });

  return {
    async GET(request: Request) {
      if (!await isAuthorized(request, deps.password)) return locked();
      try { return Response.json(await view(), { headers }); } catch { return unavailable(); }
    },
    async CSV(request: Request) {
      if (!await isAuthorized(request, deps.password)) return locked();
      try {
        const data = await view();
        return new Response(insightsCsv(data), { headers: {
          ...headers,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="carrier-insights.csv"',
        } });
      } catch { return unavailable(); }
    },
    /** A plain form post, so the prompt works without JavaScript. Always answers with a redirect back to the page. */
    async unlock(request: Request) {
      const url = new URL(request.url);
      if (request.headers.get('origin') !== url.origin) return new Response('Use the Insights page.', { status: 403, headers });
      const raw = (await request.text()).slice(0, 2048);
      let submitted = '';
      try {
        submitted = request.headers.get('content-type')?.includes('json')
          ? String((JSON.parse(raw) as { password?: unknown }).password ?? '')
          : new URLSearchParams(raw).get('password') ?? '';
      } catch { /* treated as a wrong password */ }
      if (!await passwordMatches(submitted, deps.password)) {
        return new Response(null, { status: 303, headers: { ...headers, Location: new URL('/insights?error=1', url).toString() } });
      }
      return new Response(null, { status: 303, headers: {
        ...headers,
        Location: new URL('/insights', url).toString(),
        'Set-Cookie': sessionCookie(await accessToken(deps.password!), request),
      } });
    },
    view,
    /** Cookie check for the server-rendered page. */
    isAuthorized: (request: Request) => isAuthorized(request, deps.password),
  };
}
