'use client';

import { useEffect, useRef, useState } from 'react';
import type { Action, Challenge } from '../../lib/challenge/types';
import './challenge.css';

const moves = [
  ['Probe', 'Ask a question'], ['Protect', 'Refuse a secret'],
  ['Verify', 'Check a source you have'], ['Disconnect', 'End the call'],
] as const;

export default function ChallengeBoard() {
  const [day, setDay] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [portal, setPortal] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const replyInput = useRef<HTMLInputElement>(null);
  const verdictHeading = useRef<HTMLHeadingElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const portalDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    fetch('/api/challenge').then(async response => {
      const result = await response.json() as { day: Challenge | null; error?: string };
      if (!response.ok) throw new Error(result.error);
      setDay(result.day);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  async function act(action: Action | { type: 'start' }) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
      const result = await response.json() as { day: Challenge | null; error?: string };
      if (!response.ok) throw new Error(result.error);
      setDay(result.day);
      if (action.type === 'reply') setText('');
      if (action.type === 'portal') setPortal(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const active = day?.phase === 'call';
  const seconds = day ? Math.max(0, 180 - Math.floor((clock - Date.parse(day.startedAt)) / 1000)) : 180;
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);
  useEffect(() => {
    if (active && seconds === 0 && !busy) {
      setDay(current => current ? { ...current, phase: 'verdict' } : current);
      void act({ type: 'end' });
    }
  }, [active, seconds, busy, error]); // The server also enforces the deadline after reload.
  useEffect(() => {
    if (day?.phase === 'verdict') verdictHeading.current?.focus();
    else if (active && !busy) replyInput.current?.focus();
  }, [day?.phase, busy, active]);
  useEffect(() => { transcript.current?.scrollTo(0, transcript.current.scrollHeight); }, [day?.turns.length]);
  useEffect(() => { if (portal) portalDialog.current?.showModal(); }, [portal]);

  return <main className="challenge">
    <header className="running-head"><a href="/">TELL</a><span className="pill">CHALLENGE · TEXT</span>{day && <><span className="pill">CALL 1 OF 3</span><span className="pill">BLUEBONNET RECRUITING</span></>}</header>
    {error && <p role="alert" className="error">{error} <button onClick={() => location.reload()}>Reload saved day</button></p>}
    {loading ? <p role="status">Loading your saved day…</p> : !day ? <section className="intro">
      <p className="eyebrow">THREE CALLS. TWO STORIES.</p><h1>Keep your $1,000.<br />Finish both tasks.</h1>
      <p>Who gets your trust?</p><button className="primary" disabled={busy} onClick={() => void act({ type: 'start' })}>{busy ? 'Starting…' : 'Start challenge'}</button>
    </section> : <>
      <h1 className="sr-only">Your Challenge day</h1>
      <div className={`board ${active ? 'on-call' : ''}`}>
        <aside className="account dim"><p className="eyebrow">YOUR BALANCE</p><p className="balance">${day.balance.toLocaleString('en-US')}</p><p>Fictional money. Real decisions.</p>
          <h2>Day ledger</h2><ol className="ledger"><li>Yui · Recruiting <strong>{day.verdict ?? 'IN PROGRESS'}</strong></li><li>Onboarding <span>UP NEXT</span></li><li>Bank alert <span>UP NEXT</span></li></ol>
        </aside>
        <section className="caller" aria-label="Recruiter call">
          <div className="call-meta"><span className="pill">AI practice caller</span><span className="timer">{active ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Call ended'}</span></div>
          <p className="call-state"><span aria-hidden="true">● </span>{active ? 'Call active' : 'Call ended'}</p><h2>Yui</h2><p>Bluebonnet Labs recruiting</p><p className="scenario">You applied for the operations analyst role. Your candidate name is Alex. Interview slot: Tuesday at 10 AM.</p>
          <p className="limits">12 replies or 3 minutes · {day.replies}/12 replies</p>
          <div className="transcript" ref={transcript} role="log" aria-label="Call transcript" aria-live="polite" tabIndex={0}>
            {day.turns.map((turn, i) => <div className={`turn ${turn.role}`} key={i}><strong>{turn.role === 'system' ? 'Tell' : turn.role === 'user' ? 'You' : 'Yui'}</strong><p>{turn.text}</p>{turn.role === 'assistant' && <span className="source">{turn.source === 'nemotron' ? 'Nemotron · approved script line' : 'Script'}</span>}</div>)}
          </div>
          <p className="source">Each reply shows whether it used Nemotron or the script.</p>
          {active && <form onSubmit={event => { event.preventDefault(); void act({ type: 'reply', text }); }}>
            <label htmlFor="reply">Your reply · use no real personal details</label><div className="reply-row"><input ref={replyInput} id="reply" maxLength={1000} value={text} onChange={event => setText(event.target.value)} disabled={busy} autoComplete="off" /><button disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Send'}</button></div>
            <p className="hint">Type “stop drill” to end at any time.</p>
          </form>}
          {day.phase === 'verdict' && <section className="verdict"><h3 ref={verdictHeading} tabIndex={-1}>Could you tell?</h3><p>Choose one verdict.</p>{([['Real', 'I trust this caller.'], ['Scam', 'I do not trust this caller.'], ['Unverified', 'I will check another way.']] as const).map(([verdict, description]) => <button key={verdict} disabled={busy} onClick={() => void act({ type: 'verdict', verdict })}><strong>{verdict}</strong><span>{description}</span></button>)}</section>}
          {day.phase === 'complete' && <div role="status"><h3>Verdict saved: {day.verdict}</h3><p>Interview: {day.interview === 'BOOKED' ? 'Booked for Tuesday at 10 AM.' : 'Open.'}</p>{day.verdict === 'Unverified' && day.interview === 'OPEN' && <p>Open the Bluebonnet portal to check your interview.</p>}<p>This first slice ends after Yui. The next two calls are not available yet.</p><button disabled={busy} onClick={() => void act({ type: 'start' })}>Play again</button></div>}
        </section>
        <aside className="tasks dim"><h2>Your two tasks</h2><div className="task"><span className="pill">{day.interview}</span><h3>Book your Bluebonnet Labs interview</h3></div><div className="task"><span className="pill">{day.bank}</span><h3>Sort out the Corvanta Bank alert</h3></div>
          <button className="app-tile" disabled={busy} onClick={() => void act({ type: 'portal' })}>Bluebonnet portal <span>Open candidate portal ↗</span></button><button className="app-tile" disabled>Corvanta Bank <span>Available with the bank call</span></button>
        </aside>
      </div>
    </>}
    <nav className="moves" aria-label="Your four moves">{moves.map(([move, hint]) => <button key={move} disabled={busy || !active} onClick={() => {
      if (move === 'Disconnect') void act({ type: 'end' });
      else if (move === 'Verify') void act({ type: 'portal' });
      else { setText(move === 'Probe' ? 'How can I check the interview details?' : 'I do not share personal details on a call.'); replyInput.current?.focus(); }
    }}><strong>{move}</strong><span>{hint}</span></button>)}</nav>
    <dialog ref={portalDialog} className="portal" onClose={() => setPortal(false)}><p className="eyebrow">FICTIONAL COMPANY PORTAL</p><h2>Bluebonnet Labs</h2><h3>Alex · Operations analyst interview</h3><p>Booked · Tuesday at 10 AM</p><p>Bluebonnet never charges for equipment.</p><p>Portal check saved as a Verify event.</p><button onClick={() => portalDialog.current?.close()}>Back to your day</button></dialog>
  </main>;
}
