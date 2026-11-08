'use client';

import { useEffect, useRef, useState } from 'react';
import type { Action, PracticeView, Theme } from '../../lib/practice/types';
import { PRACTICE_CARD } from '../../lib/practice/card';
import { practiceSourceUrl } from '../../lib/practice/sources';
import SpeechControls from './SpeechControls';
import './practice.css';

export default function PracticeBoard() {
  const [day, setDay] = useState<PracticeView | null>(null);
  const [theme, setTheme] = useState<Theme>('finance');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(180);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/practice/generated', { signal: controller.signal }).then(async response => {
      const result = await response.json() as { practice: PracticeView | null; error?: string };
      if (!response.ok) throw new Error(result.error);
      setDay(result.practice);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function act(action: Action | { type: 'start'; theme: Theme }) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/practice/generated', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
      const result = await response.json() as { practice: PracticeView | null; error?: string };
      if (!response.ok) throw new Error(result.error);
      if (action.type === 'start') setSeconds(180);
      setDay(result.practice); setText('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const active = day?.phase === 'call';
  useEffect(() => {
    if (!active || !day) return;
    const update = () => setSeconds(Math.max(0, 180 - Math.floor((Date.now() - Date.parse(day.startedAt)) / 1000)));
    update(); const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [active, day?.startedAt]);
  useEffect(() => { if (active && seconds === 0 && !busy) { setDay(current => current ? { ...current, phase: 'verdict' } : current); void act({ type: 'end' }); } }, [active, seconds, busy, error]);
  useEffect(() => {
    if (day?.phase === 'verdict' || day?.phase === 'complete') heading.current?.focus();
    else if (active && !busy) input.current?.focus();
  }, [day?.phase, active, busy]);
  useEffect(() => { transcript.current?.scrollTo(0, transcript.current.scrollHeight); }, [day?.turns.length]);

  return <main className="practice">
    <header><a href="/">TELL</a><span className="ui-pill">PRACTICE · NEMOTRON + ELEVENLABS</span><a href="/challenge">Challenge day</a></header>
    <h1>Hear the pattern.<br />Choose your next move.</h1>
    <p className="practice-intro">A fictional call built from labelled examples. You can type or record each reply.</p>
    {error && <p className="practice-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading your saved practice…</p> : <>
      {(!day || day.phase === 'complete') && <section className="practice-start" aria-label="Choose a practice theme">
        <label htmlFor="theme">Practice theme</label><select id="theme" value={theme} disabled={busy} onChange={e => setTheme(e.target.value as Theme)}><option value="finance">Finance</option><option value="seasonal_packages">Seasonal packages</option></select>
        <button className="ui-button ui-button--primary" disabled={busy} onClick={() => void act({ type: 'start', theme })}>{busy ? 'Creating your scenario…' : day ? 'Start another scenario' : 'Start practice'}</button>
      </section>}
      {day && <div className="practice-layout">
        <section className="practice-call ui-card ui-card--strong" aria-label="Practice call">
          <div className="practice-meta"><span className="ui-pill">AI practice caller</span><span>{active ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Call ended'}</span></div>
          <h2>{day.theme === 'finance' ? 'Corvanta Bank' : 'ParcelKite'}</h2>
          <p>This is a safe simulation. All details below are fictional.</p>
          <p className="practice-note">4 replies or 3 minutes · {day.replies}/4 replies · You can end at any time.</p>
          <div ref={transcript} className="practice-transcript" role="log" aria-label="Call transcript" tabIndex={0}>
            <p className="practice-note">This is a Tell practice call from an AI caller. Your text is saved for the result. Say or type “stop drill” at any time.</p>
            {day.turns.map((turn, i) => <div className={`practice-turn ${turn.role}`} key={i}><strong>{turn.role === 'user' ? 'You' : 'Caller'}</strong><p>{turn.text}</p></div>)}
          </div>
          {active && <>
            <SpeechControls key={day.id} active={!busy} revision={day.turns.length} onText={setText} onError={setError} />
            <form onSubmit={e => { e.preventDefault(); void act({ type: 'reply', text }); }}><label htmlFor="practice-reply">Your reply</label><div className="practice-reply"><input ref={input} id="practice-reply" value={text} onChange={e => setText(e.target.value)} disabled={busy} maxLength={1000} autoComplete="off" /><button disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Send'}</button></div></form>
            <button className="practice-end" disabled={busy} onClick={() => void act({ type: 'end' })}>End call</button>
          </>}
          {day.phase === 'verdict' && <section><h3 ref={heading} tabIndex={-1}>Could you tell?</h3><p>What do you think about this caller?</p><div className="practice-verdict">{([['legit', 'Real'], ['scam', 'Scam'], ['unverified', 'Unverified']] as const).map(([verdict, label]) => <button className="ui-button ui-button--large" disabled={busy} key={verdict} onClick={() => void act({ type: 'verdict', verdict })}>{label}</button>)}</div></section>}
          {day.result && <section aria-label="Practice result"><h3 ref={heading} tabIndex={-1}>Your practice result</h3><p><strong>Planned caller: {day.result.label === 'scam' ? 'Scam' : 'Real'}</strong></p><p>{day.result.correct === null ? 'You chose to check another way. Use a number in your saved app.' : day.result.correct ? 'Your verdict matched the scenario plan.' : 'Your verdict did not match the scenario plan.'}</p><p>{day.result.explanation}</p><p>{day.result.leaked.length ? 'A fictional secret appeared in your replies. Keep codes and identity details private.' : 'No fictional secrets appeared in your replies.'}</p><details><summary>Source examples for this scenario</summary><p>This is a generated scenario, not a held-out accuracy test. Its planned label follows five examples with the same dataset label.</p><ul>{day.result.examples.map(e => <li key={e.id}>{e.source} · {e.id.slice(0, 12)} · {e.label === 1 ? 'scam' : 'non-scam'}</li>)}</ul></details></section>}
        </section>
        <aside className="practice-context"><section className="ui-card"><h2>Your fictional card</h2><p>Name: {PRACTICE_CARD.name}</p><p>{PRACTICE_CARD[day.theme]}</p><p>One-time code: <strong>{PRACTICE_CARD.secrets.live_code}</strong></p><p>PIN: <strong>{PRACTICE_CARD.secrets.account_pin}</strong></p><p>Gift-card code: <strong>{PRACTICE_CARD.secrets.gift_card_code}</strong></p><p>Do not use real personal details.</p></section><section className="ui-card"><h2>Where the examples come from</h2><p><a href={practiceSourceUrl(day.dataset.source)}>{day.dataset.source}</a></p><p>{day.dataset.prompt_count.toLocaleString()} examples eligible for prompts. {day.dataset.held_out_count.toLocaleString()} held out for evaluation.</p><p className="practice-note">Nemotron generates the caller’s questions. The code request follows a fixed line. ElevenLabs speaks and transcribes. This does not train Nemotron’s model weights.</p></section></aside>
      </div>}
    </>}
  </main>;
}
