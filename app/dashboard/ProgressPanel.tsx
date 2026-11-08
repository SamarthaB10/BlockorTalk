'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgressView, SkillCard } from '../../lib/skills/log';
import type { SkillId } from '../../lib/skills/catalog';
import type { ResultsView } from '../../lib/season/results';
import CallResults from '../play/CallResults';
import BalanceBadge from '../components/BalanceBadge';
import '../play/play.css';
import '../play/results.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function StateMark({ skill }: { skill: Pick<SkillCard, 'state' | 'needsPractice'> }) {
  return <span className="skill-state"><span className="skill-dot" data-state={skill.state} aria-hidden="true" />{skill.state}{skill.needsPractice && <span className="skill-flag"> · Needs practice</span>}</span>;
}

/** Each scale uses saved evidence, without changing the skill state rules. */
function SkillScales({ skill }: { skill: SkillCard }) {
  const decisions = skill.history.length;
  const withoutHints = skill.successes - skill.guided;
  const scales = [
    { label: 'Successful decisions', value: skill.successes, total: decisions },
    { label: 'Success without hints', value: withoutHints, total: decisions },
    { label: 'Scenarios with success', value: skill.scenarios, total: skill.scenariosTried },
  ];
  return <dl className="hub-skill-scales">{scales.map(scale => <div key={scale.label}>
    <dt>{scale.label}</dt><dd><span>{scale.total ? `${scale.value} / ${scale.total}` : 'No evidence'}</span>
      <meter min={0} max={scale.total || 1} value={scale.value} aria-label={`${skill.name}: ${scale.label}`} aria-valuetext={scale.total ? `${scale.value} of ${scale.total}` : 'No evidence yet'} />
    </dd>
  </div>)}</dl>;
}

/** Presentational Progress screen: summary, the Skill Log, and one skill's history. */
export function ProgressBoard({ progress, selected, onSelect, onOpenEvidence }: {
  progress: ProgressView; selected: SkillId | null; onSelect: (skill: SkillId | null) => void;
  /** When set, evidence opens on this page instead of /play. */
  onOpenEvidence?: (href: string) => void;
}) {
  const open = progress.skills.find(skill => skill.id === selected) ?? null;
  const { summary } = progress;
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
      <div className="hub-progress-heading"><h1 id="progress-summary-title">Your progress</h1><BalanceBadge /></div>
      <ul>
        <li><strong>{summary.demonstrated}</strong> {summary.demonstrated === 1 ? 'skill' : 'skills'} demonstrated</li>
        <li><strong>{summary.independent}</strong> {summary.independent === 1 ? 'skill' : 'skills'} independent</li>
        <li><strong>{summary.needsPractice}</strong> {summary.needsPractice === 1 ? 'skill needs' : 'skills need'} practice</li>
      </ul>
      {summary.calls === 0 && <p>Your Skill Log fills in from your own decisions. Finish a call to see your first evidence.</p>}
    </section>

    <section aria-labelledby="skill-log-title">
      <h2 id="skill-log-title" className="hub-progress-eyebrow">Skill log</h2>
      <p className="hub-skill-key">Stages: Unseen → Practiced → Demonstrated → Independent. Independent means success without hints in at least two scenarios. Each scale shows your saved evidence.</p>
      <ul className="hub-skill-grid">
        {progress.skills.map(skill => <li key={skill.id}>
          <article className={`hub-card hub-skill${skill.id === selected ? ' is-open' : ''}`} aria-labelledby={`skill-${skill.id}`}>
            <h3 id={`skill-${skill.id}`}>{skill.name}</h3>
            <StateMark skill={skill} />
            <p className="hub-skill-count">{plural(skill.successes, 'successful decision')} · {plural(skill.scenarios, 'scenario')}</p>
            <SkillScales skill={skill} />
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
        {!entry.href ? <p className="hub-skill-guidance">{entry.scenario}</p>
          : onOpenEvidence ? <button type="button" className="hub-link" onClick={() => onOpenEvidence(entry.href)}>{entry.scenario} · see the moment in the transcript</button>
          : <a className="hub-link" href={entry.href}>{entry.scenario} · see the moment in the transcript</a>}
      </li>)}</ol>
    </section>}
  </div>;
}

type Load = { state: 'loading' } | { state: 'signin' } | { state: 'down' } | { state: 'ready'; progress: ProgressView };
type Mode =
  | { kind: 'board' }
  | { kind: 'results'; callId: string; anchor: string | null };

/** "/play/results/<id>#step-2" → the call id and the moment to scroll to. */
export function parseEvidence(href: string): { callId: string; anchor: string | null } | null {
  const match = href.match(/^\/play\/results\/([^#?]+)(?:#(.+))?$/);
  return match ? { callId: decodeURIComponent(match[1]!), anchor: match[2] ?? null } : null;
}

function bringIntoView(id: string) {
  const node = document.getElementById(id);
  node?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  node?.focus({ preventScroll: true });
}

/** A finished call's debrief, loaded from the results API and shown on the dashboard. */
function InlineResults({ callId, anchor, onDone }: {
  callId: string; anchor: string | null; onDone: () => void;
}) {
  const [state, setState] = useState<{ view: ResultsView } | { error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    fetch(`/api/play/results/${encodeURIComponent(callId)}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json() as { results?: ResultsView; error?: string };
      setState(response.ok && body.results ? { view: body.results } : { error: body.error ?? 'Your debrief is not available right now.' });
    }).catch(() => { if (!controller.signal.aborted) setState({ error: 'Your debrief is not available right now.' }); });
    return () => controller.abort();
  }, [callId, retry]);
  useEffect(() => {
    if (state && 'view' in state && anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'center' });
  }, [state, anchor]);
  if (!state) return <p className="hub-progress-note" role="status">Loading your debrief…</p>;
  if ('error' in state) return <div className="hub-progress-note" role="alert">
    <p>{state.error}</p>
    <button type="button" className="hub-link" onClick={() => setRetry(value => value + 1)}>Try again</button>
  </div>;
  return <CallResults view={state.view} onDone={onDone} />;
}

/**
 * Loads the Player's Skill Log and opens saved evidence on the dashboard.
 * Signed-out visitors go to Profile.
 */
export default function ProgressPanel({ initialSkill = null, onSignIn }: { initialSkill?: SkillId | null; onSignIn: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [selected, setSelected] = useState<SkillId | null>(initialSkill);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'board' });
  useEffect(() => {
    const controller = new AbortController();
    // Keep showing the current log while a refresh loads.
    setLoad(current => (current.state === 'ready' ? current : { state: 'loading' }));
    fetch('/api/progress', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (response.status === 401) return setLoad({ state: 'signin' });
      if (!response.ok) return setLoad({ state: 'down' });
      setLoad({ state: 'ready', progress: (await response.json() as { progress: ProgressView }).progress });
    }).catch(() => { if (!controller.signal.aborted) setLoad({ state: 'down' }); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => { if (mode.kind !== 'board') bringIntoView('progress-stage'); }, [mode]);
  function select(skill: SkillId | null) {
    setSelected(skill);
    const url = new URL(location.href);
    if (skill) url.searchParams.set('skill', skill); else url.searchParams.delete('skill');
    history.replaceState(null, '', url);
  }
  const backToLog = useCallback(() => { setMode({ kind: 'board' }); setRetry(value => value + 1); }, []);

  if (mode.kind === 'results') return <section id="progress-stage" className="hub-drill" tabIndex={-1} aria-label="Your debrief">
    <button type="button" className="hub-link" onClick={backToLog}>← Back to your progress</button>
    <InlineResults callId={mode.callId} anchor={mode.anchor} onDone={backToLog} />
  </section>;

  if (load.state === 'loading') return <p className="hub-progress-note" role="status">Loading your Skill Log…</p>;
  if (load.state === 'signin') return <section className="hub-card hub-progress-note"><h2>Keep a Skill Log</h2><p>Sign in so each call adds evidence to your skills.</p><button type="button" className="hub-primary" onClick={onSignIn}>Sign in or sign up <span>↗</span></button></section>;
  if (load.state === 'down') return <section className="hub-card hub-progress-note" role="alert"><p>Your progress is not available right now.</p><button type="button" className="hub-link" onClick={() => setRetry(value => value + 1)}>Try again</button></section>;
  return <ProgressBoard progress={load.progress} selected={selected} onSelect={select}
    onOpenEvidence={href => { const target = parseEvidence(href); if (target) setMode({ kind: 'results', ...target }); }} />;
}
