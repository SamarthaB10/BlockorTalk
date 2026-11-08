'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, Challenge } from '../../lib/challenge/types';
import { CALLERS, CALL_ORDER, CALLBACK_LINES, FAKE_SECRETS } from '../../lib/challenge/scenarios';
import { Sheet, Toast, Stamp } from '../components/ui';
// Browser-safe voice modules only: never personas.ts, adapter.ts or agentConfig.ts (they hold the prompts).
import { startBrowserCall, type BrowserCallHandle, type TurnRole } from '../../lib/voice/browserCall';
import { BROWSER_VOICE_VARIABLES } from '../../lib/voice/scenarioCards';
import SpritePlayer from '../components/SpritePlayer';
import './challenge.css';

const moves = [
  ['Probe', 'Ask a question'], ['Protect', 'Refuse a secret'],
  ['Verify', 'Check a source you have'], ['Disconnect', 'End the call'],
] as const;

type Mode = 'text' | 'voice';
/** connecting → live → ended, or failed / mic-denied. Never a spinner: every state is a still line of text. */
type VoiceState = 'connecting' | 'live' | 'ended' | 'failed' | 'mic-denied';
type VoiceTurn = { role: TurnRole; message: string };
const REPLY_CAP = 12;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * The real waveform: Yui's output level in white, the player's microphone in grey,
 * travelling right to left. With reduced motion it is one still level bar instead.
 */
function Waveform({ handle }: { handle: BrowserCallHandle }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const bars: { level: number; caller: boolean }[] = [];
    let frame = 0; let last = 0; let smooth = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < (reduced ? 250 : 50)) return;
      last = now;
      const width = el.clientWidth; const height = el.clientHeight;
      if (el.width !== Math.round(width * ratio)) { el.width = Math.round(width * ratio); el.height = Math.round(height * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const output = Math.min(1, handle.outputLevel()); const input = Math.min(1, handle.inputLevel());
      const caller = output >= input; const raw = Math.max(output, input);
      // Fast attack, slow release: speech reads as a voice, not as jitter.
      smooth += (raw - smooth) * (raw > smooth ? 0.6 : 0.18);
      const level = smooth;
      if (reduced) {
        ctx.fillStyle = '#575757'; ctx.fillRect(0, height / 2 - 1, width, 2);
        ctx.fillStyle = caller ? '#fff' : '#b9b9b9'; ctx.fillRect(0, height / 2 - 4, Math.max(4, width * level), 8);
        return;
      }
      ctx.fillStyle = '#575757'; ctx.fillRect(0, height / 2 - 0.5, width, 1);
      const step = 6; const count = Math.floor(width / step);
      bars.push({ level, caller });
      while (bars.length > count) bars.shift();
      bars.forEach((bar, i) => {
        const h = Math.max(2, bar.level * (height - 4));
        const x = width - (bars.length - i) * step;
        ctx.globalAlpha = Math.min(1, 0.15 + x / (width * 0.35)); // older speech fades at the trailing edge
        ctx.fillStyle = bar.caller ? '#fff' : '#b9b9b9';
        ctx.beginPath(); ctx.roundRect(x, (height - h) / 2, 3, h, 1.5); ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [handle, reduced]);
  return <div className="waveform"><canvas ref={canvas} aria-hidden="true" /><p className="legend"><span className="yui">Yui</span><span>You</span></p></div>;
}

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
  const [mode, setMode] = useState<Mode>('text');
  const [voice, setVoiceState] = useState<VoiceState>('connecting');
  const voiceRef = useRef<VoiceState>('connecting');
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [callHandle, setCallHandle] = useState<BrowserCallHandle | null>(null);
  const handleRef = useRef<BrowserCallHandle | null>(null);
  const voiceStatus = useRef<HTMLParagraphElement>(null);
  const repliesRef = useRef(0);
  const setVoice = (next: VoiceState) => { voiceRef.current = next; setVoiceState(next); };
  const spokenReplies = voiceTurns.filter(turn => turn.role === 'user').length;

  useEffect(() => {
    fetch('/api/challenge').then(async response => {
      const result = await response.json() as { day: Challenge | null; error?: string };
      if (!response.ok) throw new Error(result.error);
      setDay(result.day);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  async function act(action: Action | { type: 'start' }): Promise<boolean> {
    if (busy) return false;
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
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); return false; }
    finally { setBusy(false); }
  }

  const hangUp = useCallback(() => { const live = handleRef.current; handleRef.current = null; setCallHandle(null); return live?.end().catch(() => {}); }, []);
  useEffect(() => () => { void hangUp(); }, [hangUp]);
  /** Hang-up by the player (Disconnect, "stop drill", the reply cap): end the session, then the call. */
  function endVoiceCall() {
    if (voiceRef.current === 'live') { setVoice('ended'); void act({ type: 'end' }); }
    void hangUp();
  }

  /** Starts Yui's call by browser voice (voice uses the recruiter agent only). `fresh` creates a new stored day first. */
  async function startVoice(fresh: boolean) {
    setMode('voice'); setVoice('connecting'); setVoiceTurns([]); setError(''); repliesRef.current = 0;
    if (fresh && !(await act({ type: 'start' }))) { setVoice('failed'); return; }
    let token: string | undefined;
    try {
      const response = await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callerId: 'recruiter' }) });
      if (response.ok) token = (await response.json() as { conversationToken?: string }).conversationToken;
    } catch { /* shown as the failure state below */ }
    if (!token) { setVoice('failed'); return; }
    try {
      const handle = await startBrowserCall({
        callerId: 'recruiter', conversationToken: token, variables: BROWSER_VOICE_VARIABLES.recruiter,
        onTurn: turn => {
          setVoiceTurns(turns => [...turns, turn]);
          if (turn.role !== 'user') return;
          repliesRef.current += 1;
          if (/\bstop\s+drill\b/i.test(turn.message) || repliesRef.current >= REPLY_CAP) endVoiceCall();
        },
        onEnded: () => {
          handleRef.current = null; setCallHandle(null);
          if (voiceRef.current === 'live') { setVoice('ended'); void act({ type: 'end' }); }
          else if (voiceRef.current === 'connecting') setVoice('failed');
        },
        onMicDenied: () => setVoice('mic-denied'),
      });
      if (!handle) { if (voiceRef.current === 'connecting') setVoice('failed'); return; }
      handleRef.current = handle; setCallHandle(handle); setVoice('live');
    } catch { setVoice('failed'); }
  }
  const caller = CALLERS[day?.callerId ?? 'recruiter'];
  const active = day?.phase === 'call';
  // Voice covers Yui's call; the calls after it stay in text.
  const voiceMode = mode === 'voice' && day?.callerId === 'recruiter';
  const voiceLive = voiceMode && voice === 'live';
  const voiceBlocked = voiceMode && (voice === 'failed' || voice === 'mic-denied');
  function playInText() { void hangUp(); setMode('text'); if (day?.phase !== 'call') void act({ type: 'start' }); }
  function callAgain() { void startVoice(day?.phase !== 'call'); }
  const seconds = day ? Math.min(180, Math.max(0, 180 - Math.floor((clock - Date.parse(day.startedAt)) / 1000))) : 180;
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
  // The day left the call (time cap, reload, verdict): the voice session ends with it.
  useEffect(() => { if (!active && handleRef.current) { setVoice('ended'); void hangUp(); } }, [active, hangUp]);
  useEffect(() => {
    if (day?.phase === 'verdict') verdictHeading.current?.focus();
    else if (active && !busy && !voiceMode) replyInput.current?.focus();
  }, [day?.phase, busy, active, voiceMode]);
  useEffect(() => { if (voiceBlocked) voiceStatus.current?.focus(); }, [voiceBlocked]);
  useEffect(() => { transcript.current?.scrollTo(0, transcript.current.scrollHeight); }, [day?.turns.length, voiceTurns.length]);
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
    <header className="running-head"><a href="/">TELL</a><span className="pill">{voiceMode ? 'CHALLENGE · VOICE' : 'CHALLENGE · TEXT'}</span>{day && <><span className="pill">CALL {CALL_ORDER.indexOf(day.callerId) + 1} OF 3</span><span className="pill">{caller.org.toUpperCase()}</span></>}</header>
    {error && <p role="alert" className="error">{error} <button onClick={() => location.reload()}>Reload saved day</button></p>}
    {loading ? <p role="status">Loading your saved day…</p> : !day ? <section className="intro">
      <div className="intro-copy"><p className="eyebrow">THREE CALLS. TWO STORIES.</p><h1>Keep your $1,000.<br />Finish both tasks.</h1>
      <p>Who gets your trust?</p>
      <div className="start-row"><button className="primary" disabled={busy} onClick={() => void startVoice(true)}>Start by voice<span>Talk to Yui with your microphone</span></button><button className="start-text" disabled={busy} onClick={() => { setMode('text'); void act({ type: 'start' }); }}>{busy && mode === 'text' ? 'Starting…' : 'Start in text'}<span>Type your replies</span></button></div>
      <p className="hint">Either way: an AI practice caller, the same day. Use no real personal details.</p></div>
      <figure className="planner"><SpritePlayer personality="planner" animation="idle" /><figcaption>Drill Planner · your day is ready</figcaption></figure>
    </section> : <>
      <h1 className="sr-only">Your Challenge day</h1>
      <div className={`board ${active ? 'on-call' : ''}`}>
        <aside className="account dim"><p className="eyebrow">YOUR BALANCE</p><p className="balance">${displayBalance.toLocaleString('en-US')}</p><p>Fictional money. Real decisions.</p>
          <h2>Day ledger</h2><ol className="ledger">{CALL_ORDER.map(id => { const result = day.calls?.find(call => call.callerId === id); return <li key={id}>{CALLERS[id].name} · {CALLERS[id].org}<strong>{result ? <Stamp>{result.verdict} · {result.cost ? `−$${result.cost}` : '$0 lost'}</Stamp> : day.callerId === id ? 'IN PROGRESS' : 'UP NEXT'}</strong></li>; })}</ol>
        </aside>
        <section className="caller" aria-label={`${caller.name} call`}>
          <div className="call-meta"><span className="pill">AI practice caller</span><span className="timer">{active ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Call ended'}</span></div>
          <p className={`call-state ${voiceMode && !voiceLive ? 'still' : ''}`}><span className="dot" aria-hidden="true">●</span>{voiceMode && active && !voiceLive ? (voice === 'connecting' ? 'Connecting' : 'Not connected') : active ? 'Call active' : 'Call ended'}</p><h2>{caller.name}</h2><p>{caller.org}</p><p className="scenario">{caller.scenario}</p><p className="limits">Fictional details only · Date of birth: {FAKE_SECRETS.date_of_birth} · Address: {FAKE_SECRETS.home_address} · PIN: {FAKE_SECRETS.account_pin}</p>
          {active && day.codeVisible && <Toast><strong>Corvanta · One-time code</strong><p className="bank-code">{FAKE_SECRETS.live_code}</p><p>Do not share this code with a caller.</p></Toast>}
          <p className="limits">12 replies or 3 minutes · {voiceMode ? spokenReplies : day.replies}/12 replies{voiceMode && ' · say “stop drill” to end'}</p>
          {voiceMode && active && voice === 'connecting' && <p className="voice-note" role="status">Calling Yui. Allow the microphone when your browser asks.</p>}
          {voiceBlocked && active && <div className="voice-failed" role="alert"><p ref={voiceStatus} tabIndex={-1}>{voice === 'mic-denied' ? 'Your microphone is off, so Yui can’t hear you. Play this call in text instead.' : 'The call didn’t connect. Your day is saved.'}</p><div className="voice-actions">{voice === 'mic-denied' ? <><button className="primary" disabled={busy} onClick={playInText}>Play in text</button><button disabled={busy} onClick={callAgain}>Call again</button></> : <><button className="primary" disabled={busy} onClick={callAgain}>Call again</button><button disabled={busy} onClick={playInText}>Play in text</button></>}</div></div>}
          {voiceLive && callHandle && <Waveform handle={callHandle} />}
          <div className="transcript" hidden={voiceMode && voiceTurns.length === 0} ref={transcript} role="log" aria-label="Call transcript" aria-live="polite" tabIndex={0}>
            {voiceMode ? voiceTurns.map((turn, i) => <div className={`turn ${turn.role === 'user' ? 'user' : 'assistant'}`} key={i}><strong>{turn.role === 'user' ? 'You' : 'Yui'}</strong><p>{turn.message}</p></div>) : day.turns.map((turn, i) => <div className={`turn ${turn.role}`} key={i}><strong>{turn.role === 'system' ? 'Tell' : turn.role === 'user' ? 'You' : caller.name}</strong><p>{turn.text}</p>{turn.role === 'assistant' && <span className="source">{turn.source === 'nemotron' ? 'Nemotron · approved script line' : 'Script'}</span>}</div>)}
          </div>
          {!voiceMode && <p className="source">Each reply shows whether it used Nemotron or the script.</p>}
          {active && !voiceMode && <form onSubmit={event => { event.preventDefault(); void act({ type: 'reply', text }); }}>
            <label htmlFor="reply">Your reply · use no real personal details</label><div className="reply-row"><input ref={replyInput} id="reply" maxLength={1000} value={text} onChange={event => setText(event.target.value)} disabled={busy} autoComplete="off" /><button disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Send'}</button></div>
            <p className="hint">Type “stop drill” to end at any time.</p>
          </form>}
          {day.phase === 'verdict' && <section className="verdict"><h3 ref={verdictHeading} tabIndex={-1}>Could you tell?</h3><p>Choose one verdict.</p>{([['Real', 'I trust this caller.'], ['Scam', 'I do not trust this caller.'], ['Unverified', 'I will check another way.']] as const).map(([verdict, description]) => <button key={verdict} disabled={busy} onClick={() => void act({ type: 'verdict', verdict })}><strong>{verdict}</strong><span>{description}</span></button>)}</section>}
          {day.phase === 'between' && <section role="status" className="between"><h3>Verdict saved: {day.verdict}</h3><p>Balance and tasks saved.</p><button className="primary" disabled={busy} onClick={() => void act({ type: 'next' })}>Next call</button></section>}
          {day.phase === 'complete' && <section className="day-result" aria-label="Day result"><h3>Your day result</h3><p className="balance">${day.balance.toLocaleString('en-US')}</p><p>{day.balance === 1000 && day.interview === 'BOOKED' && day.bank === 'RESOLVED' ? 'Both tasks done. You kept your $1,000.' : 'Your money and tasks show the outcome of your choices.'}</p><p>Interview: {day.interview === 'BOOKED' ? 'Done · Tuesday at 10 AM' : 'Not completed'}</p><p>Bank alert: {day.bank === 'RESOLVED' ? 'Done' : day.bank === 'FAILED' ? 'Failed · Code shared' : 'Not completed · Call Corvanta to check'}</p><ul>{day.calls.map(call => <li key={call.callerId}>{CALLERS[call.callerId].name}: {call.verdict} · ${call.cost} lost</li>)}</ul><button disabled={busy} onClick={() => { if (mode === 'voice') void startVoice(true); else void act({ type: 'start' }); }}>Play again</button></section>}
        </section>
        <aside className="tasks dim"><h2>Your two tasks</h2><div className="task"><span className="pill">{!active && day.interview === 'BOOKED' ? <Stamp>{day.interview}</Stamp> : day.interview}</span><h3>Book your Bluebonnet Labs interview</h3></div><div className="task"><span className="pill">{!active && day.bank !== 'OPEN' ? <Stamp key={day.bank}>{day.bank}</Stamp> : day.bank}</span><h3>Sort out the Corvanta Bank alert</h3></div>
          <button className="app-tile" disabled={busy} onClick={() => void act({ type: 'portal' })}>Bluebonnet portal <span>Open candidate portal ↗</span></button><button className="app-tile" disabled={busy} onClick={() => void act({ type: 'bank' })}>Corvanta Bank <span>Open your bank app ↗</span></button>
        </aside>
      </div>
    </>}
    <nav className="moves" aria-label="Your four moves">{moves.map(([move, hint]) => <button key={move} disabled={busy || !active || (voiceMode && (move === 'Probe' || move === 'Protect'))} onClick={() => {
      if (move === 'Disconnect') { if (handleRef.current) endVoiceCall(); else { if (voiceMode) setVoice('ended'); void act({ type: 'end' }); } }
      else if (move === 'Verify') void act({ type: day?.callerId === 'fraud_team' ? 'bank' : 'portal' });
      else { setText(move === 'Probe' ? 'How can I check this through a number I already have?' : 'I do not share personal details on a call.'); replyInput.current?.focus(); }
    }}><strong>{move}</strong><span>{voiceMode && (move === 'Probe' || move === 'Protect') ? `${hint}, out loud` : hint}</span></button>)}</nav>
    <Sheet open={bankOpen} onClose={() => setBankOpen(false)} label="Fictional Corvanta bank app">
      <p className="eyebrow">FICTIONAL BANK APP</p><h2>Corvanta Bank</h2><p>Alex · Card ending 4417</p><p>Recent charge: $23.40 at a restaurant yesterday.</p>
      {!day?.callbackStep ? <><p>Use the number saved in this app to check an alert.</p><button disabled={busy || !day || day.callerId !== 'fraud_team' || active} onClick={() => void act({ type: 'callback_start' })}>Call Corvanta</button>{active && <p>End the current call before you call back.</p>}</> : <section aria-label="Corvanta callback"><h3>Aki · AI practice agent</h3><div role="log" aria-live="polite">{CALLBACK_LINES.slice(0, day.callbackStep).map(line => <p key={line}>{line}</p>)}</div>{day.callbackStep < 3 ? <button disabled={busy} onClick={() => void act({ type: 'callback_next' })}>{day.callbackStep === 1 ? 'Yes, this is Alex. Was there an alert?' : 'Thank you. Finish callback'}</button> : <p role="status">Callback saved as a Verify event. {day.bank === 'FAILED' || day.leaked.includes('live_code') ? 'The code was already shared. The bank task remains failed.' : 'Bank task complete.'}</p>}</section>}
      <button onClick={() => setBankOpen(false)}>Back to your day</button>
    </Sheet>
    <dialog ref={portalDialog} className="portal" onClose={() => setPortal(false)}><p className="eyebrow">FICTIONAL COMPANY PORTAL</p><h2>Bluebonnet Labs</h2><h3>Alex · Operations analyst interview</h3><p>Booked · Tuesday at 10 AM</p><p>Bluebonnet never charges for equipment.</p><p>Portal check saved as a Verify event.</p><button onClick={() => portalDialog.current?.close()}>Back to your day</button></dialog>
  </main>;
}
