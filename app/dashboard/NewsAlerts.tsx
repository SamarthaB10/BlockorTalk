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
  return <section className="hub-library hub-newspapers" aria-label="Consumer alerts">
    {status && <p role="status">{status} <a href="https://consumer.ftc.gov/consumer-alerts">Read FTC alerts ↗</a></p>}
    {alerts.map((item, index) => <article className="hub-news-item" key={item.link}>
      <a className="hub-newspaper" href={item.link} target="_blank" rel="noreferrer" aria-labelledby={`news-title-${index}`}>
        <img src={index % 2 === 0 ? '/news/newspaper-pixel.png' : '/news/newspaper-stack.png'} alt="" width={index % 2 === 0 ? 980 : 415} height={index % 2 === 0 ? 980 : 739} loading="lazy" />
        <div className="hub-newspaper-headline">
          <h2 id={`news-title-${index}`}>{item.title}</h2>
          <span className="hub-newspaper-source">Read the source ↗<span className="ui-sr-only"> (opens in a new tab)</span></span>
        </div>
      </a>
      {planning === item.link && !note?.error && <p role="status">The Drill Planner is choosing a practice call…</p>}
      {note?.link === item.link && note.pick && <PickNote pick={note.pick} />}
      {note?.link === item.link && note.error && <p role="alert">{note.error}</p>}
      <button type="button" className="hub-primary" disabled={Boolean(planning)} onClick={() => onPractice(item.link)}>Practice this call ↗</button>
    </article>)}
  </section>;
}
