import { headers } from 'next/headers';
import { insightsHandlers } from '../../lib/insights/server';
import type { InsightsView } from '../../lib/insights/routes';
import { breakdown, overview, reportSections, type Breakdown, type ReportGroup } from '../../lib/insights/report';
import './insights.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carrier insights · Block or Talk', robots: { index: false, follow: false } };

const OUTCOME_LABEL: Record<string, string> = { 'fell for': 'Fell for', caught: 'Caught', 'false alarm': 'False alarm', 'trusted real': 'Trusted real' };

async function load(synthetic: boolean): Promise<InsightsView | 'locked' | 'down'> {
  try {
    const response = await insightsHandlers().GET(new Request(`https://tell.local/api/insights${synthetic ? '?synthetic=1' : ''}`, { headers: await headers() }));
    if (response.status === 401) return 'locked';
    return response.ok ? await response.json() as InsightsView : 'down';
  } catch { return 'down'; }
}

const when = (iso: string) => `${iso.slice(0, 10)} at ${iso.slice(11, 16)} UTC`;
const percent = (value: number | null) => (value === null ? '—' : `${value}%`);

function Brand() {
  return <header className="ins-nav"><a href="/dashboard">Block or Talk<span>Carrier insights</span></a><span className="ins-chip">For carriers · Anonymous totals</span></header>;
}

function Lock({ error }: { error: boolean }) {
  return (
    <main className="ins ins-locked">
      <Brand />
      <section className="ins-lock" aria-labelledby="ins-lock-title">
        <span className="ins-lock-mark" aria-hidden="true">B</span>
        <span className="ins-chip">For carriers</span>
        <h1 id="ins-lock-title">Carrier insights</h1>
        <p>See which scam calls people fall for, with a full analysis by NVIDIA Nemotron. Anonymous totals only.</p>
        <form method="post" action="/api/insights/unlock">
          <label htmlFor="insights-password">Password</label>
          <input id="insights-password" name="password" type="password" autoComplete="current-password" required autoFocus
            aria-invalid={error || undefined} aria-describedby={error ? 'insights-password-error' : undefined} />
          {error && <p id="insights-password-error" className="ins-error" role="alert">That password didn’t work. Please try again.</p>}
          <button className="ins-primary" type="submit">Open insights <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>
  );
}

function Bars({ title, rows }: { title: string; rows: Breakdown[] }) {
  const scam = rows.filter(row => row.fellForRate !== null);
  return (
    <section className="ins-card">
      <h2>{title}</h2>
      {scam.length === 0 ? <p className="ins-muted">No scam calls in the visible groups yet.</p> : (
        <ul className="ins-bars">
          {scam.map(row => (
            <li key={row.key}>
              <div className="ins-bar-label"><span>{row.key}</span><strong>{percent(row.fellForRate)} fell for</strong></div>
              <div className="ins-bar" aria-hidden="true"><span style={{ width: `${row.fellForRate}%` }} /></div>
              <p className="ins-muted">{row.fellFor} of {row.scamCalls} scam calls</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ synthetic?: string; error?: string }> }) {
  const query = await searchParams;
  const synthetic = query.synthetic === '1';
  const view = await load(synthetic);

  if (view === 'locked') return <Lock error={Boolean(query.error)} />;
  if (view === 'down') {
    return <main className="ins"><Brand /><section className="ins-intro"><h1>Carrier insights</h1><p>Insights aren’t available right now. Please try again soon.</p></section></main>;
  }

  const visible: ReportGroup[] = view.groups.flatMap(group => (group.hidden ? [] : [group]));
  const totals = overview(visible);
  const sections = reportSections(view.summary.text);
  const csvHref = `/api/insights/csv${view.synthetic ? '?synthetic=1' : ''}`;

  return (
    <main className="ins">
      <Brand />
      <section className="ins-intro">
        <p className="ins-eyebrow">Carrier insights</p>
        <h1>Which scam calls people fall for.</h1>
        <p>Anonymous totals from practice calls, by Category, pressure Tactic and outcome, with an analysis by NVIDIA Nemotron. Any group with fewer than {view.minPlayers} Players is hidden.</p>
      </section>

      <div className="ins-toolbar">
        <nav className="ins-toggle" aria-label="Data shown">
          <a href="/insights" aria-current={!view.synthetic ? 'page' : undefined}>Real Players</a>
          <a href="/insights?synthetic=1" aria-current={view.synthetic ? 'page' : undefined}>Synthetic demo data</a>
        </nav>
        <a className="ins-primary ins-download" href={csvHref} download>Download CSV <span aria-hidden="true">↓</span></a>
      </div>
      {view.synthetic && <p className="ins-banner" role="status"><strong>Synthetic demo data.</strong> Made-up Players for the demo, not real people.</p>}

      <section className="ins-stats" aria-label="Key numbers">
        <article className="ins-stat"><span>Calls analysed</span><strong>{totals.calls}</strong><p>In groups of {view.minPlayers}+ Players</p></article>
        <article className="ins-stat is-dark"><span>Fell for a scam</span><strong>{percent(totals.fellForRate)}</strong><p>{totals.fellFor} of {totals.scamCalls} scam calls</p></article>
        <article className="ins-stat"><span>Caught the scam</span><strong>{percent(totals.catchRate)}</strong><p>{totals.caught} of {totals.scamCalls} scam calls</p></article>
        <article className="ins-stat"><span>Doubted a real caller</span><strong>{percent(totals.falseAlarmRate)}</strong><p>{totals.falseAlarms} of {totals.realCalls} real calls</p></article>
      </section>

      <section className="ins-card ins-analysis" aria-labelledby="ins-analysis-title">
        <div className="ins-card-head">
          <span className="ins-chip">NVIDIA Nemotron analysis</span>
          <p className="ins-muted">
            {view.summary.generatedAt ? `Written ${when(view.summary.generatedAt)}${view.summary.stale ? ' · the latest analysis; a new one could not be written just now' : ''}` : 'No written analysis yet'}
            {view.summary.synthetic && ' · based on synthetic demo data'}
          </p>
        </div>
        <h2 id="ins-analysis-title">What the data says</h2>
        <div className="ins-report">
          {sections.map((section, index) => (
            <div key={index} className="ins-report-section">
              {section.heading && <h3>{section.heading}</h3>}
              {section.heading === 'What carriers can do'
                ? <ul>{section.paragraphs.map((paragraph, i) => <li key={i}>{paragraph}</li>)}</ul>
                : section.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </div>
          ))}
        </div>
      </section>

      <div className="ins-split">
        <Bars title="Fell-for rate by Category" rows={breakdown(visible, 'category')} />
        <Bars title="Fell-for rate by Tactic" rows={breakdown(visible, 'tactic')} />
      </div>

      <section className="ins-card" aria-labelledby="ins-totals-title">
        <h2 id="ins-totals-title">All totals</h2>
        <p className="ins-muted">{view.label}. Hidden groups have fewer than {view.minPlayers} Players.</p>
        {view.groups.length === 0 ? <p className="ins-muted">No finished calls yet.</p> : (
          <div className="ins-scroll">
            <table className="ins-table">
              <caption className="ui-sr-only">Calls by Category, Tactic and outcome. {view.label}.</caption>
              <thead><tr><th scope="col">Category</th><th scope="col">Tactic</th><th scope="col">Outcome</th><th scope="col">Calls</th><th scope="col">Players</th></tr></thead>
              <tbody>
                {view.groups.map(group => (
                  <tr key={`${group.category}|${group.tactic}|${group.outcome}`}>
                    <th scope="row">{group.category}</th>
                    <td>{group.tactic}</td>
                    <td><span className={`ins-outcome is-${group.outcome.replace(' ', '-')}`}>{OUTCOME_LABEL[group.outcome] ?? group.outcome}</span></td>
                    {group.hidden ? <td colSpan={2} className="ins-hidden">{group.note}</td> : <><td>{group.calls}</td><td>{group.players}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="ins-footer">Block or Talk · Anonymous totals only. No Player, call or transcript is ever shared.</footer>
    </main>
  );
}
