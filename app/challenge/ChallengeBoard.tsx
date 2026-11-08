'use client';

import { useEffect, useRef, useState } from 'react';
import type { Action, Challenge } from '../../lib/challenge/types';
import { CALLERS, CALL_ORDER, CALLBACK_LINES, FAKE_SECRETS } from '../../lib/challenge/scenarios';
import { Sheet, Toast, Stamp } from '../components/ui';
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
  const [bankOpen, setBankOpen] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(1000);
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
      if (action.type === 'bank') setBankOpen(true);
      setClock(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const caller = CALLERS[day?.callerId ?? 'recruiter'];
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
  useEffect(() => {
    if (!day) return;
    const target = day.balance;
    if (day.phase === 'call' || matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplayBalance(target); return; }
    const from = displayBalance;
    const start = performance.now();
    let frame: number;
    const tick = (time: number) => {
      const progress = Math.min((time - start) / 260, 1);
      setDisplayBalance(Math.round(from + (target - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [day?.balance, day?.phase]);
  useEffect(() => { if (portal) portalDialog.current?.showModal(); }, [portal]);

  return <main className="challenge">
    <header className="running-head"><a href="/">TELL</a><span className="pill">CHALLENGE · TEXT</span>{day && <><span className="pill">CALL {CALL_ORDER.indexOf(day.callerId) + 1} OF 3</span><span className="pill">{caller.org.toUpperCase()}</span></>}</header>
    {error && <p role="alert" className="error">{error} <button onClick={() => location.reload()}>Reload saved day</button></p>}
    {loading ? <p role="status">Loading your saved day…</p> : !day ? <section className="intro">
      <p className="eyebrow">THREE CALLS. TWO STORIES.</p><h1>Keep your $1,000.<br />Finish both tasks.</h1>
      <p>Who gets your trust?</p><button className="primary" disabled={busy} onClick={() => void act({ type: 'start' })}>{busy ? 'Starting…' : 'Start challenge'}</button>
    </section> : <>
      <h1 className="sr-only">Your Challenge day</h1>
      <div className={`board ${active ? 'on-call' : ''}`}>
        <aside className="account dim"><p className="eyebrow">YOUR BALANCE</p><p className="balance">${displayBalance.toLocaleString('en-US')}</p><p>Fictional money. Real decisions.</p>
          <h2>Day ledger</h2><ol className="ledger">{CALL_ORDER.map(id => { const result = day.calls?.find(call => call.callerId === id); return <li key={id}>{CALLERS[id].name} · {CALLERS[id].org}<strong>{result ? <Stamp>{result.verdict} · {result.cost ? `−$${result.cost}` : '$0 lost'}</Stamp> : day.callerId === id ? 'IN PROGRESS' : 'UP NEXT'}</strong></li>; })}</ol>
        </aside>
        <section className="caller" aria-label={`${caller.name} call`}>
          <div className="call-meta"><span className="pill">AI practice caller</span><span className="timer">{active ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Call ended'}</span></div>
          <p className="call-state"><span aria-hidden="true">● </span>{active ? 'Call active' : 'Call ended'}</p><h2>{caller.name}</h2><p>{caller.org}</p><p className="scenario">{caller.scenario}</p><p className="limits">Fictional details only · Date of birth: {FAKE_SECRETS.date_of_birth} · Address: {FAKE_SECRETS.home_address} · PIN: {FAKE_SECRETS.account_pin}</p>
          {active && day.codeVisible && <Toast><strong>Corvanta · One-time code</strong><p className="bank-code">{FAKE_SECRETS.live_code}</p><p>Do not share this code with a caller.</p></Toast>}
          <p className="limits">12 replies or 3 minutes · {day.replies}/12 replies</p>
          <div className="transcript" ref={transcript} role="log" aria-label="Call transcript" aria-live="polite" tabIndex={0}>
            {day.turns.map((turn, i) => <div className={`turn ${turn.role}`} key={i}><strong>{turn.role === 'system' ? 'Tell' : turn.role === 'user' ? 'You' : caller.name}</strong><p>{turn.text}</p>{turn.role === 'assistant' && <span className="source">{turn.source === 'nemotron' ? 'Nemotron · approved script line' : 'Script'}</span>}</div>)}
          </div>
          <p className="source">Each reply shows whether it used Nemotron or the script.</p>
          {active && <form onSubmit={event => { event.preventDefault(); void act({ type: 'reply', text }); }}>
            <label htmlFor="reply">Your reply · use no real personal details</label><div className="reply-row"><input ref={replyInput} id="reply" maxLength={1000} value={text} onChange={event => setText(event.target.value)} disabled={busy} autoComplete="off" /><button disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Send'}</button></div>
            <p className="hint">Type “stop drill” to end at any time.</p>
          </form>}
          {day.phase === 'verdict' && <section className="verdict"><h3 ref={verdictHeading} tabIndex={-1}>Could you tell?</h3><p>Choose one verdict.</p>{([['Real', 'I trust this caller.'], ['Scam', 'I do not trust this caller.'], ['Unverified', 'I will check another way.']] as const).map(([verdict, description]) => <button key={verdict} disabled={busy} onClick={() => void act({ type: 'verdict', verdict })}><strong>{verdict}</strong><span>{description}</span></button>)}</section>}
          {day.phase === 'between' && <section role="status" className="between"><h3>Verdict saved: {day.verdict}</h3><p>Balance and tasks saved.</p><button className="primary" disabled={busy} onClick={() => void act({ type: 'next' })}>Next call</button></section>}
          {day.phase === 'complete' && <section className="day-result" aria-label="Day result"><h3>Your day result</h3><p className="balance">${day.balance.toLocaleString('en-US')}</p><p>{day.balance === 1000 && day.interview === 'BOOKED' && day.bank === 'RESOLVED' ? 'Both tasks done. You kept your $1,000.' : 'Your money and tasks show the outcome of your choices.'}</p><p>Interview: {day.interview === 'BOOKED' ? 'Done · Tuesday at 10 AM' : 'Not completed'}</p><p>Bank alert: {day.bank === 'RESOLVED' ? 'Done' : day.bank === 'FAILED' ? 'Failed · Code shared' : 'Not completed · Call Corvanta to check'}</p><ul>{day.calls.map(call => <li key={call.callerId}>{CALLERS[call.callerId].name}: {call.verdict} · ${call.cost} lost</li>)}</ul><button disabled={busy} onClick={() => void act({ type: 'start' })}>Play again</button></section>}
        </section>
        <aside className="tasks dim"><h2>Your two tasks</h2><div className="task"><span className="pill">{!active && day.interview === 'BOOKED' ? <Stamp>{day.interview}</Stamp> : day.interview}</span><h3>Book your Bluebonnet Labs interview</h3></div><div className="task"><span className="pill">{!active && day.bank !== 'OPEN' ? <Stamp key={day.bank}>{day.bank}</Stamp> : day.bank}</span><h3>Sort out the Corvanta Bank alert</h3></div>
          <button className="app-tile" disabled={busy} onClick={() => void act({ type: 'portal' })}>Bluebonnet portal <span>Open candidate portal ↗</span></button><button className="app-tile" disabled={busy} onClick={() => void act({ type: 'bank' })}>Corvanta Bank <span>Open your bank app ↗</span></button>
        </aside>
      </div>
    </>}
    <nav className="moves" aria-label="Your four moves">{moves.map(([move, hint]) => <button key={move} disabled={busy || !active} onClick={() => {
      if (move === 'Disconnect') void act({ type: 'end' });
      else if (move === 'Verify') void act({ type: day?.callerId === 'fraud_team' ? 'bank' : 'portal' });
      else { setText(move === 'Probe' ? 'How can I check this through a number I already have?' : 'I do not share personal details on a call.'); replyInput.current?.focus(); }
    }}><strong>{move}</strong><span>{hint}</span></button>)}</nav>
    <Sheet open={bankOpen} onClose={() => setBankOpen(false)} label="Fictional Corvanta bank app">
      <p className="eyebrow">FICTIONAL BANK APP</p><h2>Corvanta Bank</h2><p>Alex · Card ending 4417</p><p>Recent charge: $23.40 at a restaurant yesterday.</p>
      {!day?.callbackStep ? <><p>Use the number saved in this app to check an alert.</p><button disabled={busy || !day || day.callerId !== 'fraud_team' || active} onClick={() => void act({ type: 'callback_start' })}>Call Corvanta</button>{active && <p>End the current call before you call back.</p>}</> : <section aria-label="Corvanta callback"><h3>Aki · AI practice agent</h3><div role="log" aria-live="polite">{CALLBACK_LINES.slice(0, day.callbackStep).map(line => <p key={line}>{line}</p>)}</div>{day.callbackStep < 3 ? <button disabled={busy} onClick={() => void act({ type: 'callback_next' })}>{day.callbackStep === 1 ? 'Yes, this is Alex. Was there an alert?' : 'Thank you. Finish callback'}</button> : <p role="status">Callback saved as a Verify event. {day.bank === 'FAILED' || day.leaked.includes('live_code') ? 'The code was already shared. The bank task remains failed.' : 'Bank task complete.'}</p>}</section>}
      <button onClick={() => setBankOpen(false)}>Back to your day</button>
    </Sheet>
    <dialog ref={portalDialog} className="portal" onClose={() => setPortal(false)}><p className="eyebrow">FICTIONAL COMPANY PORTAL</p><h2>Bluebonnet Labs</h2><h3>Alex · Operations analyst interview</h3><p>Booked · Tuesday at 10 AM</p><p>Bluebonnet never charges for equipment.</p><p>Portal check saved as a Verify event.</p><button onClick={() => portalDialog.current?.close()}>Back to your day</button></dialog>
  </main>;
}
