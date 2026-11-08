import { FTC_ALERTS_PAGE } from '../practice/news';
import type { NewsFeed } from './types';

export function createNewsHandlers({ load }: { load: () => Promise<NewsFeed> }) {
  return {
    async GET(_request: Request) {
      try {
        const feed = await load();
        const unavailable = !feed.items.length;
        const degraded = feed.sources.some(source => source.status === 'stale' || source.status === 'unavailable');
        return Response.json({ ...feed, source: FTC_ALERTS_PAGE, ...(unavailable ? { error: 'unavailable' } : {}) }, {
          status: unavailable ? 502 : 200,
          headers: { 'Cache-Control': unavailable || degraded ? 'no-store' : 'public, max-age=600' },
        });
      } catch {
        return Response.json({ items: [], sources: [], source: FTC_ALERTS_PAGE, error: 'unavailable' }, {
          status: 502, headers: { 'Cache-Control': 'no-store' },
        });
      }
    },
  };
}
