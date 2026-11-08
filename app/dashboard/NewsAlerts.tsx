export type Alert = { title: string; link: string; summary: string; date?: string };
/** The Drill Planner's choice for one alert. Only code-checked fields: never a call type. */
export type PlannerPick = { link: string; id: string; category: string; reason: string; path: 'agent' | 'fixed' };
export type AlertNote = { link: string; pick?: PlannerPick; error?: string };

export function PickNote({ pick }: { pick: PlannerPick }) {
  return <div className="hub-pick" role="status">
    <strong>Drill Planner picked: {pick.category}</strong>
    <p>{pick.reason}</p>
    <small>{pick.path === 'agent' ? 'Chosen by the Nemotron agent.' : 'Chosen by the fixed plan while the agent was unavailable.'}</small>
  </div>;
}

export default function NewsAlerts({ alerts, status, planning, note, onPractice }: {
  alerts: Alert[];
  status: string;
  /** Link of the alert the Drill Planner is choosing a call for. */
  planning: string | null;
  note: AlertNote | null;
  onPractice(link: string): void;
}) {
  return <section className="hub-dailytell" aria-labelledby="dailytell-title">
    <header className="hub-dailytell-head">
      <div>
        <p className="hub-dailytell-kicker">THE DAILY TELL</p>
        <h2 id="dailytell-title">Today’s alerts.</h2>
      </div>
      <p>Straight from the FTC’s consumer alerts. Pick one and the Drill Planner builds a practice call around it.</p>
    </header>
    {status && <p className="hub-dailytell-status" role="status">{status} <a href="https://consumer.ftc.gov/consumer-alerts">Read FTC alerts ↗</a></p>}
    <div className="hub-dailytell-grid">
      {alerts.map((item, index) => <article className="hub-news-item" key={item.link}>
        <a className="hub-paper" href={item.link} target="_blank" rel="noreferrer" aria-labelledby={`news-title-${index}`}>
          <span className="hub-paper-sheet hub-paper-sheet--back" aria-hidden="true" />
          <span className="hub-paper-sheet hub-paper-sheet--mid" aria-hidden="true" />
          <span className="hub-paper-front">
            <span className="hub-paper-page">
              <span className="hub-paper-masthead" aria-hidden="true"><span>THE DAILY TELL</span><small>No. {String(index + 1).padStart(2, '0')}</small></span>
              <span className="hub-paper-rule" aria-hidden="true"><i /><i /></span>
              <span className="hub-paper-meta" aria-hidden="true"><span>CONSUMER ALERT</span><span>FTC.GOV</span></span>
              <h3 className="hub-paper-title" id={`news-title-${index}`}>{item.title}</h3>
              <span className="hub-paper-body" aria-hidden="true">
                <span className="hub-paper-photo"><i /></span>
                <span className="hub-paper-lines"><i /><i /><i /><i /><i /></span>
              </span>
              <span className="hub-paper-foot">
                <span className="hub-paper-source">Read the source ↗</span>
                <span className="hub-paper-opens">opens FTC<span className="ui-sr-only"> (opens in a new tab)</span></span>
              </span>
              <span className="hub-paper-stamp" aria-hidden="true">EXTRA!</span>
            </span>
          </span>
        </a>
        {planning === item.link && !note?.error && <p role="status">The Drill Planner is choosing a practice call…</p>}
        {note?.link === item.link && note.pick && <PickNote pick={note.pick} />}
        {note?.link === item.link && note.error && <p role="alert">{note.error}</p>}
        <div className="hub-news-actions">
          <button type="button" className="hub-news-practice" disabled={Boolean(planning)} onClick={() => onPractice(item.link)}>Practice this call →</button>
          <span>The Drill Planner picks a matching scenario.</span>
        </div>
      </article>)}
    </div>
  </section>;
}
