/**
 * SERVER-ONLY: scam headlines from NewsAPI.org, merged with the FTC feed.
 * One query per scenario theme (Jobs, Banking), cached for a few hours so the
 * free tier (100 requests a day) is never close to its limit. The API key goes in
 * a header, never in a URL. Themes come from code (keyword match), not a model.
 * NewsAPI's free plan is development-only and delayed ~24h; production needs a paid key.
 */
import { ftcAlerts, plain, shorten, type NewsItem } from "./news.ts";

export const NEWSAPI_URL = "https://newsapi.org/v2/everything";
const CACHE_MS = 3 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;

export type NewsTheme = NonNullable<NewsItem["theme"]>;

const QUERIES: Record<NewsTheme, string> = {
  Jobs: '("job scam" OR "fake recruiter" OR "employment scam" OR "gift card scam")',
  Banking: '("bank impersonation" OR "bank fraud" OR "fraud department" OR "verification code") AND scam',
};

const THEME_WORDS: Record<NewsTheme, RegExp> = {
  Jobs: /\b(jobs?|recruit\w*|employ\w*|hiring|hired|interview|onboarding|gift cards?)\b/gi,
  Banking: /\b(bank\w*|fraud\w*|one[- ]time|verification|passcode|zelle)\b/gi,
};

/** The scenario theme a headline matches most, or undefined if none. */
export function themeOf(item: { title: string; summary: string }): NewsTheme | undefined {
  const text = `${item.title} ${item.summary}`;
  let best: NewsTheme | undefined;
  let bestCount = 0;
  for (const theme of Object.keys(THEME_WORDS) as NewsTheme[]) {
    const count = text.match(THEME_WORDS[theme])?.length ?? 0;
    if (count > bestCount) { best = theme; bestCount = count; }
  }
  return best;
}

interface RawArticle { source?: { name?: unknown }; title?: unknown; description?: unknown; url?: unknown; publishedAt?: unknown }

/** Turns a NewsAPI `everything` response into news items. Unreadable entries are skipped. */
export function parseNewsApi(body: unknown, theme?: NewsTheme): NewsItem[] {
  const articles = (body as { articles?: RawArticle[] } | null)?.articles;
  if (!Array.isArray(articles)) return [];
  const items: NewsItem[] = [];
  for (const a of articles) {
    const title = typeof a.title === "string" ? plain(a.title) : "";
    const link = typeof a.url === "string" ? a.url : "";
    if (!title || title === "[Removed]" || !/^https:\/\//.test(link)) continue;
    const summary = shorten(typeof a.description === "string" && a.description !== "[Removed]" ? plain(a.description) : "");
    const parsed = typeof a.publishedAt === "string" ? new Date(a.publishedAt) : undefined;
    const matched = themeOf({ title, summary }) ?? theme;
    items.push({
      title,
      link,
      summary,
      source: typeof a.source?.name === "string" && a.source.name ? plain(a.source.name) : "News",
      ...(parsed && !Number.isNaN(parsed.getTime()) ? { date: parsed.toISOString() } : {}),
      ...(matched ? { theme: matched } : {}),
    });
  }
  return items;
}

let cache: { at: number; items: NewsItem[] } | undefined;
let failedAt: number | undefined;
const BACKOFF_MS = 30 * 60 * 1000;

/** Recent scam headlines for each scenario theme. Throws if every query fails and nothing is cached. */
export async function newsApiArticles(apiKey: string, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<NewsItem[]> {
  if (cache && now - cache.at < CACHE_MS) return cache.items;
  // After a failure, don't hammer the free-tier quota: serve what we have (or fail fast) for a while.
  if (failedAt !== undefined && now - failedAt < BACKOFF_MS) {
    if (cache) return cache.items;
    throw new Error("NewsAPI recently failed; backing off");
  }
  const from = new Date(now - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const results = await Promise.allSettled((Object.keys(QUERIES) as NewsTheme[]).map(async theme => {
    const params = new URLSearchParams({ q: QUERIES[theme], from, language: "en", sortBy: "publishedAt", pageSize: "10" });
    const res = await fetchFn(`${NEWSAPI_URL}?${params}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json", "User-Agent": "Tell scam-practice app (education)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`NewsAPI returned ${res.status}`);
    return parseNewsApi(await res.json(), theme);
  }));
  const lists = results.flatMap(r => (r.status === "fulfilled" ? [r.value] : []));
  if (!lists.length) {
    failedAt = now;
    if (cache) return cache.items;
    throw (results[0] as PromiseRejectedResult).reason;
  }
  failedAt = undefined;
  const seen = new Set<string>();
  const items = lists.flat().filter(i => !seen.has(i.link) && !!seen.add(i.link));
  cache = { at: now, items };
  return items;
}

const byNewest = (a: NewsItem, b: NewsItem) => (b.date ?? "").localeCompare(a.date ?? "");

/** FTC alerts plus NewsAPI headlines, newest first. Either source may fail; throws only if all do. */
export async function latestNews(opts: { fetchFn?: typeof fetch; apiKey?: string; now?: number } = {}): Promise<{ items: NewsItem[]; fetchedAt: string }> {
  const { fetchFn = fetch, apiKey, now = Date.now() } = opts;
  const [ftc, api] = await Promise.allSettled([
    ftcAlerts(fetchFn, now),
    apiKey ? newsApiArticles(apiKey, fetchFn, now) : Promise.reject(new Error("no NewsAPI key")),
  ]);
  if (ftc.status === "rejected" && api.status === "rejected") throw ftc.reason;
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  const add = (list: NewsItem[]) => { for (const i of list) if (!seen.has(i.link)) { seen.add(i.link); items.push(i); } };
  if (api.status === "rejected" && apiKey) console.error("NewsAPI unavailable", api.reason instanceof Error ? api.reason.message : "unknown");
  if (ftc.status === "fulfilled") {
    add(ftc.value.items.map(i => {
      const theme = themeOf(i);
      return { ...i, source: "FTC", ...(theme ? { theme } : {}) };
    }));
  }
  if (api.status === "fulfilled") add(api.value);
  return { items: items.sort(byNewest), fetchedAt: new Date(now).toISOString() };
}

/** Test hook. */
export function clearNewsApiCache() { cache = undefined; failedAt = undefined; }
