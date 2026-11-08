import type { NewsItem } from '../practice/news';

export interface NewsArticle extends NewsItem {
  source: string;
  sourceId: string;
  kind: 'Consumer alert' | 'Enforcement news' | 'News coverage';
  author?: string;
}

export interface NewsSource {
  id: string;
  name: string;
  link: string;
  status: 'available' | 'stale' | 'unavailable' | 'not-configured';
  count: number;
  fetchedAt?: string;
}

export interface NewsFeed {
  items: NewsArticle[];
  sources: NewsSource[];
  fetchedAt?: string;
}
