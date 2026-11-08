import { describe, expect, it } from 'vitest';
import { createNewsService } from '../lib/news/service';
import { createNewsHandlers } from '../lib/news/routes';

const rss = (title: string, link: string, date: string) => `<rss><channel><item><title>${title}</title><link>${link}</link><description>Test summary.</description><pubDate>${date}</pubDate></item></channel></rss>`;
const consumer = rss('Consumer alert', 'https://consumer.ftc.gov/alert', '2026-11-06T12:00:00Z');
const enforcement = rss('Fraud enforcement', 'https://www.ftc.gov/action', '2026-11-07T12:00:00Z');

describe('news delivery', () => {
  it('combines official alerts and enforcement news, newest first, without requiring a key', async () => {
    const fetchFn: typeof fetch = async input => new Response(String(input).includes('gd-rss') ? consumer : enforcement);
    const result = await createNewsService({ fetchFn, now: () => 0 })();
    expect(result.items.map(item => item.title)).toEqual(['Fraud enforcement', 'Consumer alert']);
    expect(result.items[1]).toMatchObject({ source: 'Federal Trade Commission', sourceId: 'ftc-alerts', kind: 'Consumer alert' });
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'newsapi', status: 'not-configured' }),
      expect.objectContaining({ id: 'ftc-alerts', status: 'available', count: 1 }),
    ]));
  });

  it('adds NewsAPI reporting with publisher attribution and skips unsafe and duplicate articles', async () => {
    const fetchFn: typeof fetch = async (input, init) => {
      if (String(input).startsWith('https://newsapi.org/')) {
        expect(new Headers(init?.headers).get('X-Api-Key')).toBe('test-key');
        expect(String(input)).not.toContain('test-key');
        return Response.json({ status: 'ok', articles: [
          { title: 'Phone scam reporting', url: 'https://example.com/scam', description: 'A reported scam.', publishedAt: '2026-11-08T10:00:00Z', source: { name: 'Example News' }, author: 'Reporter' },
          { title: 'Duplicate', url: 'https://example.com/scam#top', source: { name: 'Example News' } },
          { title: 'Unsafe', url: 'javascript:alert(1)' },
          { title: 'Malformed URL', url: 'https://' },
          { title: '[Removed]', url: 'https://example.com/removed' },
        ] });
      }
      return new Response(consumer);
    };
    const result = await createNewsService({ fetchFn, apiKey: () => 'test-key', now: () => 0 })();
    expect(result.items.filter(item => item.sourceId === 'newsapi')).toEqual([
      expect.objectContaining({ title: 'Phone scam reporting', source: 'Example News', author: 'Reporter', kind: 'News coverage' }),
    ]);
    expect(result.sources.find(source => source.id === 'newsapi')).toMatchObject({ status: 'available' });
  });

  it('keeps cached articles when one provider fails and recovers without discarding the other sources', async () => {
    let time = 0;
    let offline = false;
    let calls = 0;
    const fetchFn: typeof fetch = async input => {
      calls++;
      if (offline && String(input).includes('gd-rss')) throw new Error('Offline');
      return new Response(String(input).includes('gd-rss') ? consumer : enforcement);
    };
    const load = createNewsService({ fetchFn, now: () => time });
    await load();
    await load();
    expect(calls).toBe(2);
    time = 4 * 60 * 60 * 1000;
    offline = true;
    const stale = await load();
    expect(stale.items).toHaveLength(2);
    expect(stale.sources.find(source => source.id === 'ftc-alerts')).toMatchObject({ status: 'stale', fetchedAt: '1970-01-01T00:00:00.000Z' });
    expect(stale.sources.find(source => source.id === 'ftc-news')).toMatchObject({ status: 'available' });
    offline = false;
    time += 6 * 60 * 1000;
    expect((await load()).sources.find(source => source.id === 'ftc-alerts')).toMatchObject({ status: 'available' });
  });
});

describe('GET /api/news', () => {
  it('delivers available articles and reports failed providers without failing the entire feed', async () => {
    const fetchFn: typeof fetch = async input => String(input).includes('gd-rss') ? new Response(consumer) : new Response('', { status: 503 });
    const handlers = createNewsHandlers({ load: createNewsService({ fetchFn, now: () => 0 }) });
    const response = await handlers.GET(new Request('https://tell.test/api/news'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ title: 'Consumer alert' }],
      sources: expect.arrayContaining([expect.objectContaining({ id: 'ftc-news', status: 'unavailable' })]),
    });
  });

  it('returns a retryable, uncached error when all providers are unavailable', async () => {
    const fetchFn: typeof fetch = async () => new Response('Down', { status: 503 });
    const handlers = createNewsHandlers({ load: createNewsService({ fetchFn }) });
    const response = await handlers.GET(new Request('https://tell.test/api/news'));
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ items: [], error: 'unavailable' });
  });
});
