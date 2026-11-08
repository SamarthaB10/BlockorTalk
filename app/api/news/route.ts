import { FTC_ALERTS_PAGE } from '../../../lib/practice/news.ts';
import { latestNews } from '../../../lib/practice/newsapi.ts';

export const dynamic = 'force-dynamic';

/** Latest scam news: FTC consumer alerts, plus NewsAPI headlines when NEWSAPI_KEY is set. */
export async function GET() {
  try {
    const { items, fetchedAt } = await latestNews({ apiKey: process.env.NEWSAPI_KEY || undefined });
    return Response.json({ items, fetchedAt, source: FTC_ALERTS_PAGE }, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (err) {
    console.error('Scam news unavailable', err instanceof Error ? err.message : 'unknown');
    return Response.json({ items: [], error: 'unavailable', source: FTC_ALERTS_PAGE }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
