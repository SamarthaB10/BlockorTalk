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
  return <section className="hub-library">
    {status && <p role="status">{status} <a href="https://consumer.ftc.gov/consumer-alerts">Read FTC alerts ↗</a></p>}
    {alerts.map(item => <article className="hub-card" key={item.link}>
      <span className="hub-chip">FTC · Consumer alert</span>
      <h2>{item.title}</h2>
      <p>{item.summary}</p>
      {planning === item.link && !note?.error && <p role="status">The Drill Planner is choosing a practice call…</p>}
      {note?.link === item.link && note.pick && <PickNote pick={note.pick} />}
      {note?.link === item.link && note.error && <p role="alert">{note.error}</p>}
      <button type="button" className="hub-primary" disabled={Boolean(planning)} onClick={() => onPractice(item.link)}>Practice this call ↗</button>
      <a className="hub-link" href={item.link} target="_blank" rel="noreferrer">Read the source ↗</a>
    </article>)}
  </section>;
}
