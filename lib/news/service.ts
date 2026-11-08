import { FTC_ALERTS_PAGE, FTC_FEED_URL, parseFeed } from '../practice/news';
import type { NewsArticle, NewsFeed, NewsSource } from './types';

const SOURCES = [
  { id: 'ftc-alerts', name: 'FTC consumer alerts', link: FTC_ALERTS_PAGE, feed: FTC_FEED_URL, kind: 'Consumer alert' },
  { id: 'ftc-news', name: 'FTC consumer protection', link: 'https://www.ftc.gov/news-events', feed: 'https://www.ftc.gov/feeds/press-release-consumer-protection.xml', kind: 'Enforcement news' },
] as const;

interface NewsOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
  apiKey?: () => string | undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function parseNewsApi(value: unknown): NewsArticle[] {
  const data = record(value);
  if (data.status !== 'ok' || !Array.isArray(data.articles)) throw new Error('NewsAPI unavailable');
  return data.articles.flatMap(value => {
    const article = record(value);
    const title = clean(article.title);
    const link = clean(article.url);
    if (!title || title === '[Removed]' || !/^https:\/\//i.test(link)) return [];
    let parsedUrl: URL;
    try { parsedUrl = new URL(link); }
    catch { return []; }
    const date = typeof article.publishedAt === 'string' ? new Date(article.publishedAt) : undefined;
    return [{
      title, link, summary: clean(article.description).slice(0, 500),
      source: clean(record(article.source).name) || parsedUrl.hostname,
      sourceId: 'newsapi', kind: 'News coverage' as const,
      ...(date && !Number.isNaN(date.getTime()) ? { date: date.toISOString() } : {}),
      ...(clean(article.author) ? { author: clean(article.author) } : {}),
    }];
  });
}

/** Server-only aggregation. Each provider fails independently. */
export function createNewsService({ fetchFn = fetch, now = Date.now, apiKey = () => undefined }: NewsOptions = {}) {
  type Result = { items: NewsArticle[]; source: NewsSource };
  const cache = new Map<string, { result: Result; checkedAt: number }>();
  const pending = new Map<string, Promise<Result>>();
  return async (): Promise<NewsFeed> => {
    const key = apiKey()?.trim();
    const newsApi = { id: 'newsapi', name: 'NewsAPI', link: 'https://newsapi.org' };
    const url = new URL('https://newsapi.org/v2/everything');
    url.search = new URLSearchParams({ q: '(scam OR fraud OR phishing OR robocall) AND (consumer OR phone OR identity)', language: 'en', sortBy: 'publishedAt', pageSize: '40', searchIn: 'title,description' }).toString();
    const providers = [
      ...SOURCES.map(source => ({ ...source, load: async () => {
        const response = await fetchFn(source.feed, { headers: { Accept: 'application/rss+xml, application/xml;q=0.9' }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Feed unavailable');
        return parseFeed(await response.text(), 30).map(item => ({ ...item, source: 'Federal Trade Commission', sourceId: source.id, kind: source.kind }));
      } })),
      ...(key ? [{ ...newsApi, load: async () => {
        const response = await fetchFn(url, { headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('NewsAPI unavailable');
        return parseNewsApi(await response.json());
      } }] : []),
    ];
    const results = await Promise.all(providers.map(async source => {
      const previous = cache.get(source.id);
      const ttl = previous?.result.source.status === 'available' ? 3 * 60 * 60 * 1000 : 5 * 60 * 1000;
      if (previous && now() - previous.checkedAt < ttl) return previous.result;
      if (pending.has(source.id)) return pending.get(source.id)!;
      const request = (async (): Promise<Result> => {
        let result: Result;
        try {
          const items = await source.load();
          if (!items.length) throw new Error('Empty feed');
          result = { items, source: { id: source.id, name: source.name, link: source.link, count: items.length, status: 'available', fetchedAt: new Date(now()).toISOString() } };
        } catch {
          result = previous?.result.items.length
            ? { items: previous.result.items, source: { ...previous.result.source, status: 'stale' } }
            : { items: [], source: { id: source.id, name: source.name, link: source.link, count: 0, status: 'unavailable' } };
        }
        cache.set(source.id, { result, checkedAt: now() });
        return result;
      })();
      pending.set(source.id, request);
      try { return await request; }
      finally { pending.delete(source.id); }
    }));
    const seen = new Set<string>();
    const items = results.flatMap(result => result.items).filter(item => {
      try {
        const url = new URL(item.link);
        url.hash = '';
        if (url.protocol !== 'https:' || url.username || url.password || seen.has(url.href)) return false;
        seen.add(url.href);
        return true;
      } catch { return false; }
    }).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    return {
      items,
      sources: [...results.map(result => result.source), ...(!key ? [{ ...newsApi, status: 'not-configured' as const, count: 0 }] : [])],
      fetchedAt: results.flatMap(result => result.source.fetchedAt ? [result.source.fetchedAt] : []).sort().at(-1),
    };
  };
}
