'use client';

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Challenge } from '../../lib/challenge/types';
import type { RevealCall, RevealPayload } from '../../lib/challenge/reveal';
import { CALLERS, CALL_ORDER } from '../../lib/challenge/scenarios';
import SpritePlayer from '../components/SpritePlayer';
import { Flip, Stamp } from '../components/ui';
import './reveal.css';

type State = { status: 'loading' | 'ready' | 'error'; reveal: RevealPayload | null; error: string };
type Flag = RevealCall['result']['red_flags'][number];

const TACTIC_LABEL: Record<string, string> = {
  authority: 'authority', urgency: 'urgency', fear: 'fear', reward: 'reward',
  'details-as-proof': 'details as proof', 'odd-payment': 'odd payment', 'asks-for-secret': 'asks for a secret',
};
const RULE_STATUS = { kept: 'Kept', broken: 'Broken', not_tested: 'Not tested' } as const;

/** Wraps each red-flag span in a mark that also names the tactic in words (never colour alone). */
function highlight(text: string, flags: Flag[]): ReactNode {
  const sorted = [...flags].sort((a, b) => a.span.start - b.span.start);
  const nodes: ReactNode[] = [];
  let at = 0;
  sorted.forEach((flag, i) => {
    const { start, end } = flag.span;
    if (start < at || end <= start || end > text.length) return; // overlapping or stale span: skip it
    if (start > at) nodes.push(text.slice(at, start));
    nodes.push(<mark className="flag" key={i}>{text.slice(start, end)}<span className="flag-tag">{TACTIC_LABEL[flag.tactic] ?? flag.tactic}</span></mark>);
    at = end;
  });
  nodes.push(text.slice(at));
  return nodes;
}

function useRevealData(day: Challenge) {
  const [state, setState] = useState<State>({ status: 'loading', reveal: null, error: '' });
  const load = useCallback(async (mode?: 'fixed') => {
    setState(s => ({ ...s, status: s.reveal && !mode ? s.status : 'loading', error: '' }));
    try {
      const response = await fetch(`/api/challenge/reveal${mode ? `?mode=${mode}` : ''}`, { cache: 'no-store' });
      const result = await response.json() as { reveal?: RevealPayload; error?: string };
      if (!response.ok || !result.reveal) throw new Error(result.error || 'The reveal could not be built.');
      setState({ status: 'ready', reveal: result.reveal, error: '' });
    } catch (e) {
      setState(s => ({ status: 'error', reveal: s.reveal, error: e instanceof Error ? e.message : 'The reveal could not be built.' }));
    }
  }, []);
  // The bank callback or a portal check can land after the last verdict, so the day's outcome is part of the key.
  const outcome = `${day.balance}|${day.interview}|${day.bank}|${day.events.length}`;
  useEffect(() => { void load(); }, [day.id, outcome, load]);
  return { ...state, load };
}

/** The Debrief cat follows what the agent is really doing: thinking while it works, typing, then presenting. */
function useCatPose(status: State['status'], goodDay: boolean) {
  const [stage, setStage] = useState<'working' | 'writing' | 'presenting' | 'done'>('working');
  useEffect(() => {
    if (status !== 'ready') { setStage('working'); return; }
    setStage('writing');
    const present = window.setTimeout(() => setStage('presenting'), 1400);
    const done = window.setTimeout(() => setStage('done'), 4600);
    return () => { window.clearTimeout(present); window.clearTimeout(done); };
  }, [status]);
  if (stage === 'working') return { animation: 'thinking' as const, active: true, caption: 'Reading the three calls…' };
  if (stage === 'writing') return { animation: 'typing' as const, active: true, caption: 'Writing it up…' };
  const animation = goodDay ? 'excited' as const : 'talking' as const;
  return { animation, active: stage === 'presenting', caption: 'Debrief agent' };
}

function CallCard({ call, index }: { call: RevealCall; index: number }) {
  const who = call.identity; // the wording comes from the server, only after the third verdict
  const flagged = call.result.red_flags;
  return <Flip index={index}>
    <article className="reveal-card" aria-label={`${call.persona.name}, revealed`}>
      <p className="eyebrow">CALL {index + 1} OF 3</p>
      <h3>{call.persona.name}</h3>
      <p className="claimed">Said they were: {call.persona.claimed_org}</p>
      <p className="identity"><span className={`pill tone-${who.tone}`}>{who.label}</span></p>
      <p>{who.line}</p>
      <p className="limits">Verdict you gave: {call.result.verdict ?? 'none'} · {call.result.outcome.money_lost ? `−$${call.result.outcome.money_lost}` : '$0 lost'}{call.result.outcome.task ? ` · task ${call.result.outcome.task.status}` : ''}</p>
      <ul className="decisions">
        {call.result.decisions.map(decision => <li key={decision.id}>
          <Stamp>{decision.result === 'worked' ? 'Worked' : 'Cost you'}</Stamp>
          <p>{decision.sentence}{decision.result === 'cost_you' && <span className="cost"> ({decision.cost_label})</span>}</p>
        </li>)}
      </ul>
      <details className="transcript-box" open={call.result.decisions.some(d => d.result === 'cost_you')}>
        <summary>Transcript · {flagged.length} red-flag {flagged.length === 1 ? 'line' : 'lines'} marked</summary>
        <ol className="lines">
          {call.turns.map(turn => <li key={turn.turn} className={turn.speaker}>
            <strong>{turn.speaker === 'player' ? 'You' : call.persona.name}</strong>
            <p>{turn.speaker === 'caller' ? highlight(turn.text, flagged.filter(flag => flag.turn === turn.turn)) : turn.text}</p>
          </li>)}
        </ol>
      </details>
    </article>
  </Flip>;
}

function PlaceholderCard({ id, index }: { id: typeof CALL_ORDER[number]; index: number }) {
  return <article className="reveal-card pending" aria-label={`${CALLERS[id].name}, not yet revealed`}>
    <p className="eyebrow">CALL {index + 1} OF 3</p>
    <h3>{CALLERS[id].name}</h3>
    <p className="claimed">{CALLERS[id].org}</p>
    <p className="pill">AI practice caller</p>
  </article>;
}

function Steps({ reveal }: { reveal: RevealPayload }) {
  return <section className="steps" aria-label="Debrief agent steps">
    <h3>Agent steps</h3>
    {reveal.calls.map(call => {
      const { result } = call;
      return <div className="step-group" key={call.callerId}>
        <h4>{call.persona.name} · {result.path === 'agent' ? 'Nemotron tool loop' : 'Fixed sequence'}{result.model ? ` · ${result.model}` : ''}</h4>
        {result.path === 'fixed' && result.fallback_reason && <p className="limits">Why: {result.fallback_reason}</p>}
        <ol>
          {result.steps.map(step => <li key={step.n + step.tool}>
            <code>{step.tool}</code><span className="by">{step.by === 'nemotron' ? 'chosen by Nemotron' : 'run by code'}</span>
            <p>{step.result_summary}</p>
          </li>)}
        </ol>
        {result.mismatches.length > 0 && <p className="limits">Where the model disagreed with the code, the code’s answer is shown: {result.mismatches.map(m => m.field).join(', ')}.</p>}
      </div>;
    })}
  </section>;
}

function Rules({ reveal }: { reveal: RevealPayload }) {
  const titles = reveal.calls[0].result.rules;
  return <section className="rules" aria-label="The four rules">
    <h3>The four rules</h3>
    {titles.map((rule, i) => <article key={rule.rule}>
      <h4>Rule {rule.rule}</h4><p>{rule.title}</p>
      <ul>
        {reveal.calls.map(call => {
          const r = call.result.rules[i];
          return <li key={call.callerId} className={`rule-${r.status}`}><strong>{call.persona.name} · {RULE_STATUS[r.status]}</strong><span>{r.evidence}</span></li>;
        })}
      </ul>
    </article>)}
  </section>;
}

function Rewind({ reveal }: { reveal: RevealPayload }) {
  const { rewind } = reveal;
  if (!rewind) return null;
  const call = reveal.calls[rewind.call];
  const decision = call.result.decisions.find(d => d.id === rewind.decision_id);
  return <section className="rewind" aria-label="Your one rewind">
    <p className="eyebrow">YOUR ONE REWIND</p>
    <h3>{call.persona.name}, turn {rewind.turn}</h3>
    {decision && <p>{decision.sentence}</p>}
    <p className="limits">{rewind.reason}</p>
  </section>;
}

export default function Reveal({ day }: { day: Challenge }) {
  const { status, reveal, error, load } = useRevealData(day);
  const goodDay = !!reveal && reveal.summary.balance === 1000 && reveal.summary.interview === 'BOOKED' && reveal.summary.bank === 'RESOLVED';
  const cat = useCatPose(status, goodDay);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (status === 'ready') heading.current?.focus({ preventScroll: true }); }, [status === 'ready']);

  return <section className="reveal" aria-labelledby="reveal-heading">
    <header className="reveal-head">
      <div>
        <p className="eyebrow">DETECTIVE REVEAL</p>
        <h2 id="reveal-heading" ref={heading} tabIndex={-1}>Who was really calling</h2>
        {status === 'loading' && !reveal && <p role="status">The Debrief agent is reading your three calls.</p>}
        {reveal && <p className="limits">{reveal.calls.every(c => c.result.path === 'agent') ? 'Explained by Nemotron’s tool loop. Code decided every score.' : 'Some or all of this ran on the fixed sequence of the same tools, labelled below. Code decided every score.'}</p>}
      </div>
      <figure className="debrief-cat"><SpritePlayer personality="debrief" animation={cat.animation} active={cat.active} scale={2} /><figcaption>{cat.caption}</figcaption></figure>
    </header>
    {status === 'error' && <div className="error" role="alert"><p>{error}</p><div className="voice-actions"><button className="primary" onClick={() => void load()}>Try again</button><button onClick={() => void load('fixed')}>Use the fixed sequence</button></div></div>}
    <div className="reveal-cards">
      {reveal
        ? reveal.calls.map((call, i) => <CallCard key={call.callerId} call={call} index={i} />)
        : CALL_ORDER.map((id, i) => <PlaceholderCard key={id} id={id} index={i} />)}
    </div>
    {reveal && <Fragment>
      <div className="reveal-lower">
        <Steps reveal={reveal} />
        <div><Rules reveal={reveal} /><Rewind reveal={reveal} /></div>
      </div>
    </Fragment>}
  </section>;
}
