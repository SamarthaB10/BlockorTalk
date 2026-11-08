import type { ResultsView } from '../../lib/season/results';
import type { Recommendation } from '../../lib/skills/log';

/**
 * The results screen after each call (BS-11). Presentational only: the server builds the view.
 * Order: Call type, Scored moments, skill update and next drill, right/wrong, Blokbuks and rank,
 * Scored calls left, then the transcript. Every right/wrong carries a text label, never colour alone.
 */
/**
 * Inside the dashboard, pass `onNextDrill` and `onDone` so the next drill and the way back stay on that
 * page; on /play/results the links work as before.
 */
export default function CallResults({ view, onNextDrill, onDone }: {
  view: ResultsView;
  onNextDrill?: (next: Recommendation) => void;
  onDone?: () => void;
}) {
  return (
    <section className="call-results" aria-labelledby="call-results-headline">
      <p className="call-results-eyebrow">{view.heading}</p>
      <h1 id="call-results-headline" className="call-results-headline">{view.headline}</h1>

      <ol className="call-results-moments" aria-label="Scored moments">
        {view.moments.map(moment => (
          <li key={moment.n} id={moment.label === 'Your Verdict' ? 'verdict' : undefined} className={`call-results-moment ${moment.right ? 'is-right' : 'is-wrong'}`}>
            <p className="call-results-moment-head">
              <span className="call-results-mark" aria-hidden="true">{moment.mark}</span>
              <strong>{moment.status}</strong>
              <span className="call-results-moment-label">{moment.label}</span>
            </p>
            {moment.words && <blockquote className="call-results-words">{moment.words}</blockquote>}
            <p className="call-results-why">{moment.why}</p>
          </li>
        ))}
      </ol>

      {view.skill && <section className="call-results-skill" aria-labelledby="skill-update-title">
        <p id="skill-update-title" className="call-results-eyebrow">Skill updated</p>
        <p className="call-results-skill-label"><span className="skill-dot" data-state={view.skill.outcome === 'Needs practice' ? 'needs' : view.skill.state} aria-hidden="true" />{view.skill.label}</p>
        <blockquote className="call-results-words">{view.skill.why}</blockquote>
        {view.skill.note && <p className="call-results-note">{view.skill.note}</p>}
        <p className="call-results-why">{view.skill.next}</p>
      </section>}

      {view.next && <section className="call-results-skill" aria-labelledby="next-drill-title">
        <p id="next-drill-title" className="call-results-eyebrow">Recommended next</p>
        <p className="call-results-skill-label">{view.next.title}</p>
        <p className="call-results-why">{view.next.reason}</p>
        <p className="call-results-note">A new story: {view.next.scenario}. The caller may be real or a scam.</p>
        {onNextDrill
          ? <button type="button" className="call-results-link is-primary" onClick={() => onNextDrill(view.next!)}>Start 60-second drill</button>
          : <a className="call-results-link is-primary" href={view.next.href}>Start 60-second drill</a>}
      </section>}

      <div className="call-results-score" role="status">
        <p className="call-results-summary">{view.summary}</p>
        <p className="call-results-blokbuks">
          <strong>{view.blokbuks.text}</strong>
          {view.blokbuks.total !== null && <span> · Total ₿ {view.blokbuks.total.toLocaleString('en-US')}</span>}
        </p>
        {view.rank && <p className="call-results-rank">Rank {view.rank}</p>}
        {view.scoredByRules && <p className="call-results-note">Scored by rules</p>}
      </div>

      <p className="call-results-left">{view.callsLeft}</p>

      {onDone ? <nav className="call-results-actions" aria-label="What next">
        <button type="button" className="call-results-link is-primary" onClick={onDone}>Back to your progress</button>
      </nav> : <nav className="call-results-actions" aria-label="What next">
        <a className="call-results-link is-primary" href="/play">Play another</a>
        <a className="call-results-link" href="/dashboard?view=Progress">Your progress</a>
        {view.analysisUnlocked
          ? <a className="call-results-link" href="/me">See my analysis</a>
          : <span className="call-results-locked">Play one more call to unlock your analysis</span>}
        <a className="call-results-link" href="/leaderboard">Leaderboard</a>
      </nav>}

      {view.transcript.length > 0 && <details className="call-results-transcript" open>
        <summary>The call</summary>
        <ol>{view.transcript.map((turn, index) => <li key={index} id={turn.id} data-who={turn.who}><strong>{turn.who}</strong> {turn.text}</li>)}</ol>
      </details>}
    </section>
  );
}
