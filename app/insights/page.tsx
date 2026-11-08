import { headers } from 'next/headers';
import { insightsHandlers } from '../../lib/insights/server';
import type { InsightsView } from '../../lib/insights/routes';
import { breakdown, callTime, minutes, overview, reportSections, type Breakdown, type ReportGroup } from '../../lib/insights/report';
import './insights.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carrier insights · Block or Talk', robots: { index: false, follow: false } };

/** Outcome names and their fixed pie colours (validated as adjacent slices on the dark card surface). */
const OUTCOMES = [
  { key: 'fell for', label: 'Fell for', color: 'var(--series-1)' },
  { key: 'caught', label: 'Caught', color: 'var(--series-2)' },
  { key: 'false alarm', label: 'False alarm', color: 'var(--series-3)' },
  { key: 'trusted real', label: 'Trusted real', color: 'var(--series-4)' },
] as const;
const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(OUTCOMES.map(o => [o.key, o.label]));
const OUTCOME_COLOR: Record<string, string> = Object.fromEntries(OUTCOMES.map(o => [o.key, o.color]));

async function load(): Promise<InsightsView | 'locked' | 'down'> {
  try {
    const response = await insightsHandlers().GET(new Request('https://tell.local/api/insights', { headers: await headers() }));
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

/** Ranked horizontal bars, one hue, value printed beside each bar. */
function FailBars({ title, rows }: { title: string; rows: Breakdown[] }) {
  const scam = rows.filter(row => row.fellForRate !== null);
  return (
    <section className="ins-card">
      <h2>{title}</h2>
      {scam.length === 0 ? <p className="ins-muted">No scam calls to show yet.</p> : (
        <ul className="ins-bars">
          {scam.map(row => (
            <li key={row.key} title={`${row.key}: ${row.fellForRate}% fail rate (${row.fellFor} of ${row.scamCalls} scam calls)`}>
              <div className="ins-bar-label"><span>{row.key}</span><strong>{percent(row.fellForRate)} fail rate</strong></div>
              <div className="ins-bar" aria-hidden="true"><span style={{ width: `${row.fellForRate}%`, background: 'var(--series-1)' }} /></div>
              <p className="ins-muted">{row.fellFor} of {row.scamCalls} scam calls</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Call-length bars on one 0–3 minute scale (the call cap), so lengths compare across both charts. */
function TimeBars({ title, rows, colorOf, labelOf }: { title: string; rows: { key: string; avgSeconds: number }[]; colorOf: (key: string) => string; labelOf: (key: string) => string }) {
  return (
    <section className="ins-card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="ins-muted">No call lengths recorded yet.</p> : (
        <ul className="ins-bars">
          {rows.map(row => (
            <li key={row.key} title={`${labelOf(row.key)}: ${minutes(row.avgSeconds)} on average`}>
              <div className="ins-bar-label"><span>{labelOf(row.key)}</span><strong>{minutes(row.avgSeconds)}</strong></div>
              <div className="ins-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (row.avgSeconds / 180) * 100)}%`, background: colorOf(row.key) }} /></div>
            </li>
          ))}
        </ul>
      )}
      <p className="ins-muted ins-scale">Scale: 0 to 3:00, the longest a practice call can run.</p>
    </section>
  );
}

/** How calls ended: a pie with a 2px surface gap between slices, plus a legend with names, counts and shares. */
function OutcomePie({ slices, total }: { slices: { key: string; label: string; color: string; calls: number }[]; total: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const shown = slices.filter(slice => slice.calls > 0);
  let offset = 0;
  return (
    <section className="ins-card ins-pie-card">
      <h2>How calls ended</h2>
      {total === 0 ? <p className="ins-muted">No finished calls to show yet.</p> : (
        <div className="ins-pie">
          <svg viewBox="0 0 200 200" role="img" aria-label={`How calls ended: ${shown.map(s => `${s.label} ${Math.round((s.calls * 100) / total)}%`).join(', ')}`}>
            <g transform="rotate(-90 100 100)">
              {shown.map(slice => {
                const length = (slice.calls / total) * circumference;
                const gap = shown.length > 1 ? 2 : 0;
                const dash = `${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`;
                const circle = (
                  <circle key={slice.key} cx="100" cy="100" r={radius} fill="none" stroke={slice.color} strokeWidth="56"
                    strokeDasharray={dash} strokeDashoffset={-offset}>
                    <title>{`${slice.label}: ${slice.calls} calls (${Math.round((slice.calls * 100) / total)}%)`}</title>
                  </circle>
                );
                offset += length;
                return circle;
              })}
            </g>
          </svg>
          <ul className="ins-legend">
            {slices.map(slice => (
              <li key={slice.key}>
                <span className="ins-swatch" style={{ background: slice.color }} aria-hidden="true" />
                <span>{slice.label}</span>
                <strong>{slice.calls}</strong>
                <span className="ins-muted">{total ? Math.round((slice.calls * 100) / total) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const view = await load();

  if (view === 'locked') return <Lock error={Boolean(query.error)} />;
  if (view === 'down') {
    return <main className="ins"><Brand /><section className="ins-intro"><h1>Carrier insights</h1><p>Insights aren’t available right now. Please try again soon.</p></section></main>;
  }

  const visible: ReportGroup[] = view.groups.flatMap(group => (group.hidden ? [] : [group]));
  const totals = overview(visible);
  const time = callTime(visible);
  const sections = reportSections(view.summary.text);
  const slices = OUTCOMES.map(o => ({ ...o, calls: { 'fell for': totals.fellFor, caught: totals.caught, 'false alarm': totals.falseAlarms, 'trusted real': totals.trustedReal }[o.key] }));

  return (
    <main className="ins">
      <Brand />
      <section className="ins-intro">
        <p className="ins-eyebrow">Carrier insights</p>
        <h1>Which scam calls people fall for.</h1>
        <p>Anonymous totals from practice calls, by Category, pressure Tactic and outcome, with an analysis by NVIDIA Nemotron. Any group with fewer than {view.minPlayers} Players is hidden.</p>
      </section>

      <div className="ins-toolbar">
        <a className="ins-primary ins-download" href="/api/insights/csv" download>Download CSV <span aria-hidden="true">↓</span></a>
      </div>

      <section className="ins-stats" aria-label="Key numbers">
        <article className="ins-stat"><span>Calls analysed</span><strong>{totals.calls}</strong><p>In groups of {view.minPlayers}+ Players</p></article>
        <article className="ins-stat is-accent"><span>Fail rate</span><strong>{percent(totals.fellForRate)}</strong><p>{totals.fellFor} of {totals.scamCalls} scam calls</p></article>
        <article className="ins-stat"><span>Catch rate</span><strong>{percent(totals.catchRate)}</strong><p>{totals.caught} of {totals.scamCalls} scam calls</p></article>
        <article className="ins-stat"><span>Doubted a real caller</span><strong>{percent(totals.falseAlarmRate)}</strong><p>{totals.falseAlarms} of {totals.realCalls} real calls</p></article>
        <article className="ins-stat"><span>Average time on call</span><strong>{minutes(time.overall)}</strong><p>Minutes:seconds, out of a 3:00 cap</p></article>
      </section>

      <section className="ins-card ins-analysis" aria-labelledby="ins-analysis-title">
        <div className="ins-card-head">
          <span className="ins-chip">NVIDIA Nemotron analysis</span>
          <p className="ins-muted">
            {view.summary.generatedAt ? `Written ${when(view.summary.generatedAt)}${view.summary.stale ? ' · the latest analysis; a new one could not be written just now' : ''}` : 'No written analysis yet'}
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
        <OutcomePie slices={slices} total={totals.calls} />
        <TimeBars title="Average time on call by outcome" rows={time.byOutcome}
          colorOf={key => OUTCOME_COLOR[key] ?? 'var(--neutral-bar)'} labelOf={key => OUTCOME_LABEL[key] ?? key} />
      </div>

      <div className="ins-split">
        <FailBars title="Fail rate by Category" rows={breakdown(visible, 'category')} />
        <FailBars title="Fail rate by Tactic" rows={breakdown(visible, 'tactic')} />
      </div>

      <TimeBars title="Average time on call by Category" rows={time.byCategory} colorOf={() => 'var(--neutral-bar)'} labelOf={key => key} />

      <section className="ins-card" aria-labelledby="ins-totals-title">
        <h2 id="ins-totals-title">All totals</h2>
        <p className="ins-muted">Hidden groups have fewer than {view.minPlayers} Players.</p>
        {view.groups.length === 0 ? <p className="ins-muted">No finished calls yet.</p> : (
          <div className="ins-scroll">
            <table className="ins-table">
              <caption className="ui-sr-only">Calls by Category, Tactic and outcome, with average time on call.</caption>
              <thead><tr><th scope="col">Category</th><th scope="col">Tactic</th><th scope="col">Outcome</th><th scope="col">Calls</th><th scope="col">Players</th><th scope="col">Avg time</th></tr></thead>
              <tbody>
                {view.groups.map(group => (
                  <tr key={`${group.category}|${group.tactic}|${group.outcome}`}>
                    <th scope="row">{group.category}</th>
                    <td>{group.tactic}</td>
                    <td><span className="ins-outcome"><span className="ins-swatch" style={{ background: OUTCOME_COLOR[group.outcome] }} aria-hidden="true" />{OUTCOME_LABEL[group.outcome] ?? group.outcome}</span></td>
                    {group.hidden ? <td colSpan={3} className="ins-hidden">{group.note}</td> : <><td>{group.calls}</td><td>{group.players}</td><td>{minutes(group.avgSeconds)}</td></>}
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
