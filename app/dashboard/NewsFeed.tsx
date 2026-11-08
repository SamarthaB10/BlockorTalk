'use client';

import { useState } from 'react';
import type { NewsFeed as Feed } from '../../lib/news/types';
import './news.css';

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default function NewsFeed({ feed, loading, error, onRetry }: {
  feed: Feed; loading: boolean; error: string; onRetry: () => void;
}) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [kind, setKind] = useState('all');
  const availableSources = feed.sources.filter(item => item.count > 0);
  const publishers = new Set(feed.items.map(item => item.source));
  const search = query.trim().toLocaleLowerCase();
  const visible = feed.items.filter(item =>
    (source === 'all' || item.sourceId === source) &&
    (kind === 'all' || item.kind === kind) &&
    (!search || `${item.title} ${item.summary} ${item.source}`.toLocaleLowerCase().includes(search)),
  );
  const kinds = [...new Set(feed.items.map(item => item.kind))];
  const degraded = feed.sources.some(item => item.status === 'stale' || item.status === 'unavailable');

  return <section className="news-feed" aria-label="Scam and consumer protection news" aria-busy={loading}>
    <div className="news-heading">
      <div><p className="news-eyebrow">THE LATEST</p><h2>A clearer view of what’s happening.</h2><p>Official consumer alerts, enforcement updates, and reporting to help you stay informed.</p></div>
      <div className="news-coverage"><strong>{feed.items.length}</strong><span>articles · {publishers.size} {publishers.size === 1 ? 'publisher' : 'publishers'}</span>{feed.fetchedAt && <small>Checked {dateFormat.format(new Date(feed.fetchedAt))}</small>}</div>
    </div>

    <div className="news-toolbar">
      <label className="news-search"><span>Search news</span><input type="search" placeholder="Search scams, calls, identity theft…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="news-source"><span>Source</span><select value={source} onChange={event => setSource(event.target.value)}><option value="all">All sources</option>{availableSources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button className="news-refresh" onClick={onRetry} disabled={loading}>{loading ? 'Checking…' : 'Refresh'} <span aria-hidden="true">↻</span></button>
    </div>

    <div className="news-categories" role="group" aria-label="Filter by news type">
      <button aria-pressed={kind === 'all'} onClick={() => setKind('all')}>All updates</button>
      {kinds.map(item => <button key={item} aria-pressed={kind === item} onClick={() => setKind(item)}>{item === 'Consumer alert' ? 'Consumer alerts' : item}</button>)}
    </div>

    {error && <div className="news-notice" role="status"><strong>We couldn’t load the latest news.</strong><p>{error} <a href="https://consumer.ftc.gov/consumer-alerts" target="_blank" rel="noreferrer">Read FTC alerts ↗</a></p><button className="hub-link" onClick={onRetry} disabled={loading}>Try again</button></div>}
    {!error && degraded && <p className="news-notice" role="status">Some sources couldn’t update. Available articles are shown below; saved results are marked on each article.</p>}
    <p className="news-result-count" role="status">{loading && !feed.items.length ? 'Loading the latest articles…' : `${visible.length} ${visible.length === 1 ? 'article' : 'articles'}${query.trim() ? ` matching “${query.trim()}”` : ' · newest first'}`}</p>

    <div className="news-grid">
      {visible.map((item, index) => <article key={item.link} className={`news-article${index === 0 && !query && source === 'all' && kind === 'all' ? ' news-featured' : ''}`}>
        <div className="news-article-meta"><span className="news-type">{item.kind}</span>{item.date && <time dateTime={item.date}>{dateFormat.format(new Date(item.date))}</time>}</div>
        <h3><a href={item.link} target="_blank" rel="noreferrer">{item.title}<span className="news-arrow" aria-hidden="true">↗</span></a></h3>
        {item.summary && <p>{item.summary}</p>}
        <div className="news-article-footer"><div><span className="news-publisher">{item.source}</span>{item.author && <small>{item.author}</small>}{feed.sources.find(source => source.id === item.sourceId)?.status === 'stale' && <small>Saved result · update pending</small>}</div><a href={item.link} target="_blank" rel="noreferrer" aria-label={`Read article: ${item.title}`}>Read article <span aria-hidden="true">↗</span></a></div>
      </article>)}
    </div>

    {!loading && !error && !visible.length && <div className="news-empty"><h3>No articles match those filters.</h3><p>Try another search or browse all updates.</p><button className="hub-link" onClick={() => { setQuery(''); setSource('all'); setKind('all'); }}>Clear filters</button></div>}
    <p className="news-sources-note">Sources: {availableSources.length ? availableSources.map((item, index) => <span key={item.id}>{index > 0 && ' · '}<a href={item.link} target="_blank" rel="noreferrer">{item.name} ↗</a></span>) : <a href="https://consumer.ftc.gov/consumer-alerts">FTC consumer alerts ↗</a>}. Publication dates come from the source. Read the original article for full details.</p>
  </section>;
}
