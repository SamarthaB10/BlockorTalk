'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProgressView, SkillCard } from '../../lib/skills/log';
import type { SkillId } from '../../lib/skills/catalog';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function StateMark({ skill }: { skill: Pick<SkillCard, 'state' | 'needsPractice'> }) {
  return <span className="skill-state"><span className="skill-dot" data-state={skill.state} aria-hidden="true" />{skill.state}{skill.needsPractice && <span className="skill-flag"> · Needs practice</span>}</span>;
}

/** Presentational Progress screen: summary, one recommended drill, the Skill Log, and one skill's history. */
export function ProgressBoard({ progress, selected, onSelect }: { progress: ProgressView; selected: SkillId | null; onSelect: (skill: SkillId | null) => void }) {
  const open = progress.skills.find(skill => skill.id === selected) ?? null;
  const { summary, recommended } = progress;
  const opened = useRef(false);
  // A Player who opens a log is taken to it, so on a phone the panel never appears off-screen.
  useEffect(() => {
    if (!selected || !opened.current) return;
    opened.current = false;
    const panel = document.getElementById('skill-history');
    panel?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    panel?.focus({ preventScroll: true });
  }, [selected]);
  return <div className="hub-progress">
    <section className="hub-progress-summary" aria-labelledby="progress-summary-title">
      <h2 id="progress-summary-title" className="hub-progress-eyebrow">Your progress</h2>
      <ul>
        <li><strong>{summary.demonstrated}</strong> {summary.demonstrated === 1 ? 'skill' : 'skills'} demonstrated</li>
        <li><strong>{summary.independent}</strong> {summary.independent === 1 ? 'skill' : 'skills'} independent</li>
        <li><strong>{summary.needsPractice}</strong> {summary.needsPractice === 1 ? 'skill needs' : 'skills need'} practice</li>
      </ul>
      {summary.calls === 0 && <p>Your Skill Log fills in from your own decisions. Finish a call to see your first evidence.</p>}
    </section>

    {recommended && <section className="hub-card hub-recommend" aria-labelledby="recommended-title">
      <span className="hub-chip">Recommended next</span>
      <h2 id="recommended-title">{recommended.title}</h2>
      <blockquote>{recommended.reason}</blockquote>
      <p>A new story with the same skill: {recommended.scenario}. The caller may be real or a scam, so the drill also checks that you still help a real caller.</p>
      <a className="hub-primary" href={recommended.href}>Start 60-second drill <span>↗</span></a>
    </section>}

    <section aria-labelledby="skill-log-title">
      <h2 id="skill-log-title" className="hub-progress-eyebrow">Skill log</h2>
      <ul className="hub-skill-grid">
        {progress.skills.map(skill => <li key={skill.id}>
          <article className={`hub-card hub-skill${skill.id === selected ? ' is-open' : ''}`} aria-labelledby={`skill-${skill.id}`}>
            <h3 id={`skill-${skill.id}`}>{skill.name}</h3>
            <StateMark skill={skill} />
            <p className="hub-skill-count">{plural(skill.successes, 'successful decision')} · {plural(skill.scenarios, 'scenario')}</p>
            <p className="hub-skill-guidance">{skill.guidance}</p>
            <div><p className="hub-skill-label">Latest evidence</p><p>{skill.latest ?? 'Not seen in a call yet.'}</p></div>
            <div><p className="hub-skill-label">Next practice</p><p>{skill.next}</p></div>
            <button type="button" className="hub-link" aria-expanded={skill.id === selected} aria-controls="skill-history"
              disabled={!skill.history.length} onClick={() => { opened.current = skill.id !== selected; onSelect(skill.id === selected ? null : skill.id); }}>
              {!skill.history.length ? 'No evidence yet' : skill.id === selected ? 'Hide evidence log' : `Open evidence log (${skill.history.length})`}
            </button>
          </article>
        </li>)}
      </ul>
    </section>

    {open && <section id="skill-history" className="hub-card hub-skill-history" aria-labelledby="skill-history-title" tabIndex={-1}>
      <h2 id="skill-history-title">{open.name}</h2>
      <StateMark skill={open} />
      <ol>{open.history.map((entry, index) => <li key={`${entry.at}-${index}`}>
        <p className="hub-skill-when"><strong>{entry.day} · {entry.label}</strong></p>
        <p>{entry.evidence}</p>
        {entry.note && <p className="hub-skill-guidance">{entry.note}</p>}
        <a className="hub-link" href={entry.href}>{entry.scenario} · see the moment in the transcript</a>
      </li>)}</ol>
    </section>}
  </div>;
}

type Load = { state: 'loading' } | { state: 'signin' } | { state: 'down' } | { state: 'ready'; progress: ProgressView };

/** Loads the Player's Skill Log. Signed-out visitors are sent to the Profile view. */
export default function ProgressPanel({ initialSkill = null, onSignIn }: { initialSkill?: SkillId | null; onSignIn: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [selected, setSelected] = useState<SkillId | null>(initialSkill);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ state: 'loading' });
    fetch('/api/progress', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (response.status === 401) return setLoad({ state: 'signin' });
      if (!response.ok) return setLoad({ state: 'down' });
      setLoad({ state: 'ready', progress: (await response.json() as { progress: ProgressView }).progress });
    }).catch(() => { if (!controller.signal.aborted) setLoad({ state: 'down' }); });
    return () => controller.abort();
  }, [retry]);
  function select(skill: SkillId | null) {
    setSelected(skill);
    const url = new URL(location.href);
    if (skill) url.searchParams.set('skill', skill); else url.searchParams.delete('skill');
    history.replaceState(null, '', url);
  }
  if (load.state === 'loading') return <p className="hub-progress-note" role="status">Loading your Skill Log…</p>;
  if (load.state === 'signin') return <section className="hub-card hub-progress-note"><h2>Keep a Skill Log</h2><p>Sign in so each call adds evidence to your skills.</p><button type="button" className="hub-primary" onClick={onSignIn}>Sign in or sign up <span>↗</span></button></section>;
  if (load.state === 'down') return <section className="hub-card hub-progress-note" role="alert"><p>Your progress is not available right now.</p><button type="button" className="hub-link" onClick={() => setRetry(value => value + 1)}>Try again</button></section>;
  return <ProgressBoard progress={load.progress} selected={selected} onSelect={select} />;
}
