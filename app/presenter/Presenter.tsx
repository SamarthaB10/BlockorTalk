'use client';

import { useEffect, useRef, useState } from 'react';
import SpritePlayer from '../components/SpritePlayer';
import type { PresenterSnapshot } from '../../lib/challenge/presenter-types';

const statusText: Record<PresenterSnapshot['status'], string> = {
  waiting: 'Waiting for a call', scoring: 'Scoring the next turn', ready: 'Live detection',
  uncertain: "Can't tell — verify by calling back on a number you already have",
  unavailable: 'Detector unavailable · no new prediction', 'rate-limited': 'Detector rate limited · waiting to retry',
};

export default function Presenter() {
  const [proof, setProof] = useState('');
  const [snapshot, setSnapshot] = useState<PresenterSnapshot | null>(null);
  const [error, setError] = useState('');
  const [late, setLate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const lastRisk = useRef<{ caller: string; risk: number | null } | null>(null);
  const prior = useRef<{ caller: string; turn: number | null; since: number } | null>(null);

  useEffect(() => {
    const read = () => { setSnapshot(null); setProof(window.location.hash.slice(1)); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  useEffect(() => {
    if (!proof) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/presenter', { headers: { Authorization: `Bearer ${proof}` },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        const body = await response.json() as { snapshot?: PresenterSnapshot; error?: string };
        if (!response.ok || !body.snapshot) throw new Error(body.error ?? 'Connection lost · showing the last received score');
        if (stopped) return;
        const next = body.snapshot;
        if (prior.current?.caller !== next.callerName || prior.current?.turn !== next.currentTurn) prior.current = { caller: next.callerName, turn: next.currentTurn, since: Date.now() };
        setLate(next.status === 'scoring' && Date.now() - (prior.current?.since ?? Date.now()) > 3000);
        setSnapshot(next); setError('');
      } catch (error) {
        if (!stopped) setError(error instanceof Error ? error.message : 'Connection lost · showing the last received score');
      } finally { if (!stopped) timer = setTimeout(poll, 500); }
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [proof]);

  useEffect(() => {
    const previous = lastRisk.current && lastRisk.current.caller === snapshot?.callerName ? lastRisk.current.risk : null;
    lastRisk.current = snapshot ? { caller: snapshot.callerName, risk: snapshot.risk } : null;
    setSpeaking(snapshot?.risk != null && snapshot.risk > (previous ?? 0));
    const timer = setTimeout(() => setSpeaking(false), 1500);
    return () => clearTimeout(timer);
  }, [snapshot?.callerName, snapshot?.scoredTurn, snapshot?.risk]);

  async function connect() {
    setConnecting(true); setError('');
    try {
      const response = await fetch('/api/presenter', { method: 'POST' });
      const body = await response.json() as { path?: string; error?: string };
      if (!response.ok || !body.path) throw new Error(body.error ?? 'Could not connect this day.');
      window.location.hash = body.path.split('#')[1];
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not connect this day.'); }
    finally { setConnecting(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { setCopied(false); setError('Copy the address from your browser to share this presenter screen.'); }
  }

  const working = snapshot?.status === 'scoring' && !error;
  const animation = working || snapshot?.status === 'uncertain' || snapshot?.status === 'rate-limited' ? 'thinking' : speaking ? 'talking' : 'idle';
  return <main className="presenter">
    <header className="presenter-header"><a href="/">TELL</a><span className="ui-pill">PRESENTER ONLY</span>
      {proof && <button onClick={() => void copy()}>{copied ? 'Link copied' : 'Copy presenter link'}</button>}
    </header>
    {!proof ? <section className="presenter-connect">
      <p className="presenter-eyebrow">A separate view for the audience</p>
      <h1>Watch for the tell.</h1>
      <p>Start a Challenge day in this browser, then connect it here. Copy this screen’s link to open it on a second device.</p>
      <p>The player’s screen keeps the call private from the detector.</p>
      <button className="presenter-connect-button" disabled={connecting} onClick={() => void connect()}>{connecting ? 'Connecting…' : 'Connect current day'}</button>
    </section> : <>
      <section className="presenter-caller" aria-label="Current claimed caller">
        <div><p className="presenter-eyebrow">{snapshot?.phase === 'complete' ? 'Day complete · last caller' : snapshot?.phase === 'call' ? 'On the line' : 'Current caller'}</p>
          <h1>{snapshot?.callerName ?? 'Connecting…'}</h1><p>{snapshot?.organization ?? 'Waiting for the Challenge day'}</p></div>
        {snapshot && (snapshot.phase === 'call' || snapshot.phase === 'verdict') && <SpritePlayer personality="detector" animation={animation} active={Boolean(working || speaking)} scale={1} />}
      </section>
      <section className="presenter-meter" aria-label="Live risk">
        <p className="presenter-eyebrow">Call risk</p>
        <div className="presenter-value"><span>{snapshot?.risk ?? '—'}</span><small>/100</small></div>
        <div className="presenter-bar" role="meter" aria-label="Call risk" aria-valuemin={0} aria-valuemax={100}
          {...(snapshot?.risk != null ? { 'aria-valuenow': snapshot.risk } : { 'aria-valuetext': 'No confident prediction yet' })}>
          <div style={{ transform: `scaleX(${(snapshot?.risk ?? 0) / 100})` }} /></div>
        <p className="presenter-status" role="status">{error || (snapshot ? late ? 'Detector is catching up · last received score shown' : statusText[snapshot.status] : 'Connecting to the Challenge day')}</p>
        <p className="presenter-turn">{snapshot?.scoredTurn != null ? `Last scored: turn ${snapshot.scoredTurn}` : 'No turn scored yet'}{snapshot?.currentTurn != null && ` · Current: turn ${snapshot.currentTurn}`}</p>
      </section>
      <section className="presenter-tactics" aria-label="Detected tactics"><p className="presenter-eyebrow">Tactics heard</p>
        <div>{snapshot?.tactics.length ? snapshot.tactics.map(tactic => <span className="presenter-tactic" key={tactic}>{tactic.replaceAll('-', ' ')}</span>) : <p>No supported tactic flags yet.</p>}</div>
      </section>
      <footer className="presenter-footer"><span>{snapshot?.firstCorrectTurn != null ? `First correct detection: turn ${snapshot.firstCorrectTurn} · ${snapshot.firstCorrectSeconds}s into the call` : 'First correct detection: not recorded yet'}</span><span>Results stay on this presenter screen.</span></footer>
    </>}
    {!proof && error && <p role="alert">{error}</p>}
  </main>;
}
