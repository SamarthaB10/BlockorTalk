import type { CSSProperties } from 'react';
import { headers } from 'next/headers';
import { insightsHandlers } from '../../lib/insights/server';
import type { InsightsView } from '../../lib/insights/routes';
import { breakdown, callTime, executiveSummary, minutes, outcomeMix, overview, reportSections, type Breakdown, type OutcomeMix, type ReportGroup } from '../../lib/insights/report';
import './insights.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carrier Insights · Block or Talk', robots: { index: false, follow: false } };

/** Outcome names and their fixed series colours (validated on the black surface). Colour is for data only. */
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
/** Custom properties for the stagger index and animated values. */
const vars = (values: Record<string, number | string>) => Object.fromEntries(Object.entries(values).map(([k, v]) => [`--${k}`, v])) as CSSProperties;

function Brand({ download = false }: { download?: boolean }) {
  return <header className="ins-nav">
    <a href="/dashboard" className="ins-brand">Block or Talk</a>
    {download && <a className="ins-download" href="/api/insights/csv" download>Download CSV <span aria-hidden="true">↓</span></a>}
  </header>;
}

/** A number that counts up from zero on load (CSS only). Screen readers and no-CSS get the real text. */
function Count({ value, suffix = '' }: { value: number; suffix?: string }) {
  return <><span className="ui-sr-only">{value}{suffix}</span><span aria-hidden="true"><span className="ins-count" style={vars({ n: value })} />{suffix}</span></>;
}
function CountTime({ seconds }: { seconds: number | null }) {
  if (seconds === null) return <>—</>;
  return <><span className="ui-sr-only">{minutes(seconds)}</span><span aria-hidden="true" className="ins-count-time" style={vars({ m: Math.floor(seconds / 60), s: seconds % 60 })} /></>;
}
function CountPercent({ value }: { value: number | null }) {
  return value === null ? <>—</> : <Count value={value} suffix="%" />;
}

function Lock({ error }: { error: boolean }) {
  return (
    <main className="ins ins-locked">
      <Brand />
      <section className="ins-lock" aria-labelledby="ins-lock-title">
        <h1 id="ins-lock-title">Carrier Insights</h1>
        <p>Anonymous totals from practice calls. Enter the password to continue.</p>
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

function Legend({ only }: { only?: readonly string[] }) {
  return <ul className="ins-legend-row" aria-label="Legend">
    {OUTCOMES.filter(o => !only || only.includes(o.key)).map(o => <li key={o.key}><span className="ins-swatch" style={{ background: o.color }} aria-hidden="true" />{o.label}</li>)}
  </ul>;
}

/** Fail rate per Category or Tactic: each scam-call bar split into fell for and caught, highest fail rate first. */
function FailBars({ title, rows }: { title: string; rows: Breakdown[] }) {
  const scam = rows.filter(row => row.fellForRate !== null);
  return (
    <section className="ins-panel">
      <div className="ins-panel-head"><h2>{title}</h2><Legend only={['fell for', 'caught']} /></div>
      {scam.length === 0 ? <p className="ins-muted">No scam calls to show yet.</p> : (
        <ul className="ins-bars">
          {scam.map((row, index) => (
            <li key={row.key} title={`${row.key}: ${row.fellForRate}% fail rate (${row.fellFor} of ${row.scamCalls} scam calls)`}>
              <div className="ins-bar-label"><span>{row.key}</span><strong>{percent(row.fellForRate)} fail rate</strong></div>
              <div className="ins-bar ins-stack" aria-hidden="true">
                <span className="ins-fill" style={{ ...vars({ i: index }), width: `${row.fellForRate}%`, background: 'var(--series-1)' }} />
                <span className="ins-fill" style={{ ...vars({ i: index }), flex: 1, background: 'var(--series-2)' }} />
              </div>
              <p className="ins-muted">{row.fellFor} of {row.scamCalls} scam calls</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Call-length bars on one 0–3 minute scale (the call cap), so lengths compare across charts. */
function TimeBars({ title, rows, colorOf, labelOf }: { title: string; rows: { key: string; avgSeconds: number }[]; colorOf: (key: string) => string; labelOf: (key: string) => string }) {
  return (
    <section className="ins-panel">
      <div className="ins-panel-head"><h2>{title}</h2></div>
      {rows.length === 0 ? <p className="ins-muted">No call lengths recorded yet.</p> : (
        <>
          <ul className="ins-bars">
            {rows.map((row, index) => (
              <li key={row.key} title={`${labelOf(row.key)}: ${minutes(row.avgSeconds)} on average`}>
                <div className="ins-bar-label"><span>{labelOf(row.key)}</span><strong>{minutes(row.avgSeconds)}</strong></div>
                <div className="ins-bar ins-grid" aria-hidden="true"><span className="ins-fill" style={{ ...vars({ i: index }), width: `${Math.min(100, (row.avgSeconds / 180) * 100)}%`, background: colorOf(row.key) }} /></div>
              </li>
            ))}
          </ul>
          <div className="ins-axis" aria-hidden="true"><span>0:00</span><span>1:00</span><span>2:00</span><span>3:00</span></div>
          <p className="ins-muted ins-scale">Scale runs to 3:00, the longest a practice call can last.</p>
        </>
      )}
    </section>
  );
}

/** Every Category as one 100% bar, split by how its calls ended. */
function MixBars({ rows }: { rows: OutcomeMix[] }) {
  return (
    <section className="ins-panel ins-wide">
      <div className="ins-panel-head"><h2>Outcome mix by Category</h2><Legend /></div>
      {rows.length === 0 ? <p className="ins-muted">No finished calls to show yet.</p> : (
        <ul className="ins-mix">
          {rows.map((row, index) => (
            <li key={row.key}>
              <span className="ins-mix-label">{row.key}</span>
              <span className="ins-bar ins-stack ins-mix-bar">
                {row.parts.filter(part => part.calls > 0).map(part => (
                  <span key={part.outcome} className="ins-fill" title={`${row.key} · ${OUTCOME_LABEL[part.outcome]}: ${part.calls} calls (${Math.round((part.calls * 100) / row.total)}%)`}
                    style={{ ...vars({ i: index }), flexGrow: part.calls, background: OUTCOME_COLOR[part.outcome] }} />
                ))}
              </span>
              <span className="ins-mix-total"><strong>{row.total}</strong> calls</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** How calls ended: a donut that sweeps in, a 2px surface gap between slices, plus a legend with counts and shares. */
function OutcomePie({ slices, total }: { slices: { key: string; label: string; color: string; calls: number }[]; total: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const shown = slices.filter(slice => slice.calls > 0);
  let offset = 0;
  return (
    <section className="ins-panel">
      <div className="ins-panel-head"><h2>How calls ended</h2></div>
      {total === 0 ? <p className="ins-muted">No finished calls to show yet.</p> : (
        <div className="ins-pie">
          <svg viewBox="0 0 200 200" role="img" aria-label={`How calls ended: ${shown.map(s => `${s.label} ${Math.round((s.calls * 100) / total)}%`).join(', ')}`}>
            <defs>
              <mask id="ins-sweep" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
                <circle className="ins-sweep" cx="100" cy="100" r={radius} fill="none" stroke="#fff" strokeWidth="60" pathLength="100" strokeDasharray="100 100" transform="rotate(-90 100 100)" />
              </mask>
            </defs>
            <g mask="url(#ins-sweep)">
              <g transform="rotate(-90 100 100)">
                {shown.map(slice => {
                  const length = (slice.calls / total) * circumference;
                  const gap = shown.length > 1 ? 2 : 0;
                  const dash = `${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`;
                  const circle = (
                    <circle key={slice.key} cx="100" cy="100" r={radius} fill="none" stroke={slice.color} strokeWidth="44"
                      strokeDasharray={dash} strokeDashoffset={-offset}>
                      <title>{`${slice.label}: ${slice.calls} calls (${Math.round((slice.calls * 100) / total)}%)`}</title>
                    </circle>
                  );
                  offset += length;
                  return circle;
                })}
              </g>
            </g>
            <text x="100" y="98" textAnchor="middle" className="ins-pie-total">{total}</text>
            <text x="100" y="120" textAnchor="middle" className="ins-pie-caption">calls</text>
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
    return <main className="ins"><Brand /><section className="ins-head"><h1>Carrier Insights</h1><p className="ins-meta">Insights aren’t available right now. Please try again soon.</p></section></main>;
  }

  const visible: ReportGroup[] = view.groups.flatMap(group => (group.hidden ? [] : [group]));
  const totals = overview(visible);
  const time = callTime(visible);
  const findings = executiveSummary(visible);
  const actions = reportSections(view.summary.text).find(section => section.heading === 'What carriers can do')?.paragraphs ?? [];
  const slices = OUTCOMES.map(o => ({ ...o, calls: { 'fell for': totals.fellFor, caught: totals.caught, 'false alarm': totals.falseAlarms, 'trusted real': totals.trustedReal }[o.key] }));

  return (
    <main className="ins">
      <Brand download />
      <section className="ins-head">
        <h1>Carrier Insights</h1>
        <p className="ins-meta">Anonymous totals from practice calls · groups under {view.minPlayers} Players are hidden</p>
      </section>

      <section className="ins-stats" aria-label="Key numbers">
        <div className="ins-stat" style={vars({ i: 0 })}><span>Calls analysed</span><strong><Count value={totals.calls} /></strong><p>In groups of {view.minPlayers}+ Players</p></div>
        <div className="ins-stat" style={vars({ i: 1 })}><span><i className="ins-swatch" style={{ background: 'var(--series-1)' }} aria-hidden="true" />Fail rate</span><strong><CountPercent value={totals.fellForRate} /></strong><p>{totals.fellFor} of {totals.scamCalls} scam calls</p></div>
        <div className="ins-stat" style={vars({ i: 2 })}><span><i className="ins-swatch" style={{ background: 'var(--series-2)' }} aria-hidden="true" />Catch rate</span><strong><CountPercent value={totals.catchRate} /></strong><p>{totals.caught} of {totals.scamCalls} scam calls</p></div>
        <div className="ins-stat" style={vars({ i: 3 })}><span><i className="ins-swatch" style={{ background: 'var(--series-3)' }} aria-hidden="true" />Doubted a real caller</span><strong><CountPercent value={totals.falseAlarmRate} /></strong><p>{totals.falseAlarms} of {totals.realCalls} real calls</p></div>
        <div className="ins-stat" style={vars({ i: 4 })}><span>Average time on call</span><strong><CountTime seconds={time.overall} /></strong><p>Out of a 3:00 cap</p></div>
      </section>

      <div className="ins-charts">
        <OutcomePie slices={slices} total={totals.calls} />
        <TimeBars title="Average time on call by outcome" rows={time.byOutcome}
          colorOf={key => OUTCOME_COLOR[key] ?? 'var(--neutral-bar)'} labelOf={key => OUTCOME_LABEL[key] ?? key} />
        <MixBars rows={outcomeMix(visible, 'category')} />
        <FailBars title="Fail rate by Category" rows={breakdown(visible, 'category')} />
        <FailBars title="Fail rate by Tactic" rows={breakdown(visible, 'tactic')} />
        <div className="ins-wide"><TimeBars title="Average time on call by Category" rows={time.byCategory} colorOf={() => 'var(--neutral-bar)'} labelOf={key => key} /></div>
      </div>

      <section className="ins-panel ins-totals" aria-labelledby="ins-totals-title">
        <div className="ins-panel-head"><h2 id="ins-totals-title">All totals</h2><p className="ins-muted">Hidden groups have fewer than {view.minPlayers} Players.</p></div>
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

      <section className="ins-summary" aria-labelledby="ins-summary-title">
        <h2 id="ins-summary-title">Executive summary</h2>
        {findings.length === 0 ? <p className="ins-muted">No finished calls to summarise yet.</p> : (
          <ol className="ins-findings">{findings.map((line, index) => <li key={index}>{line}</li>)}</ol>
        )}
        {actions.length > 0 && <>
          <h3>Recommended actions</h3>
          <ul className="ins-actions">{actions.map((line, index) => <li key={index}>{line}</li>)}</ul>
          <p className="ins-muted ins-credit">
            Actions drafted by NVIDIA Nemotron from the totals above{view.summary.generatedAt ? ` · ${when(view.summary.generatedAt)}` : ''}{view.summary.stale ? ' · latest available' : ''}
          </p>
        </>}
      </section>

      <footer className="ins-footer">Block or Talk · Anonymous totals only. No Player, call or transcript is ever shared.</footer>
    </main>
  );
}
