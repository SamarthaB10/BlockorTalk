'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Season } from '../../lib/season/routes';
import { Button } from '../components/ui';
import Blokbuks from '../components/Blokbuks';

type Rank = { rank: number; nickname: string; blokbuks: number };
type Board = { season: Season & { status: string }; final: boolean; leaderboard: Rank[]; ownRank: Rank | null; claimEligible: boolean };

export default function Leaderboard({ claim = false }: { claim?: boolean }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [offset, setOffset] = useState(0);
  const active = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/season', { cache: 'no-store' });
      const value = await response.json() as Board & { error?: string };
      if (!response.ok) throw new Error(value.error || 'The Leaderboard is unavailable.');
      if (active.current) {
        setBoard(value); setError('');
        const serverDate = response.headers.get('date');
        if (serverDate) setOffset(Date.parse(serverDate) - Date.now());
      }
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : 'Please try again.'); }
  }, []);

  useEffect(() => {
    active.current = true;
    void refresh();
    const interval = setInterval(refresh, 10000);
    return () => { active.current = false; clearInterval(interval); };
  }, [refresh]);

  useEffect(() => {
    if (!board) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((Date.parse(board.season.endsAt) - Date.now() - offset) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [board, offset]);

  // Fetch the final board at zero; a failed request stays visible and retries on the regular interval.
  useEffect(() => {
    if (!board || board.final || remaining !== 0 || Date.now() + offset < Date.parse(board.season.endsAt)) return;
    void refresh();
  }, [remaining, board, offset, refresh]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/season/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), adult: form.get('adult') === 'on', usResident: form.get('usResident') === 'on' }) });
      const value = await response.json() as { error?: string; message?: string };
      setMessage(value.message || value.error || 'Please try again.');
    } catch { setMessage('Your request could not be sent. Please try again.'); }
    finally { setSaving(false); }
  }

  const row = (rank: Rank) => <tr key={rank.rank}><td>{rank.rank}</td><th scope="row">{rank.nickname}</th><td><Blokbuks amount={rank.blokbuks} /></td></tr>;
  return <main className="season-page">
    <header><p className="season-eyebrow">National Leaderboard · {board?.season.name || 'Season 1'}</p>
      <h1>{claim ? 'Claim your prize' : 'Good judgment adds up.'}</h1>
      <p>Practice spotting scam calls. Earn Blokbuks with each Scored call.</p>
    </header>
    {error && <p role="alert" className="season-notice">{error} <a href="/leaderboard">Try again</a></p>}
    {!board && !error && <p role="status">Loading the Leaderboard…</p>}
    {board && <>
      <section className="season-summary" aria-label="Season status">
        <div><h2>{board.final ? 'Final Leaderboard' : remaining === 0 ? 'Waiting for final results' : board.season.status === 'upcoming' ? 'Season starts soon' : 'Season ends in'}</h2>
          <p className="season-countdown" role="timer" aria-label="Time until Season ends">{Math.floor(remaining / 3600)}h {Math.floor(remaining % 3600 / 60)}m {remaining % 60}s</p>
          <p>{board.final ? 'The Season has ended. Scores are final.' : `Ends ${new Date(board.season.endsAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`}</p></div>
        <div><h2>Season prizes</h2><ol>{board.season.prizes.map(prize => <li key={prize.place}>{prize.prize}</li>)}</ol><p>provided by sponsor · rules apply</p></div>
      </section>
      {claim ? <section aria-label="Prize claim">
        {board.claimEligible ? <><h2>Confirm your details</h2><p>This is a claim request. The sponsor must verify your email and approve the prize.</p>
          <form className="season-claim" onSubmit={submit}>
            <label htmlFor="claim-email">Confirm your profile email</label><input id="claim-email" name="email" type="email" autoComplete="email" maxLength={254} required />
            <label><input type="checkbox" name="adult" required /> I am 18 or older.</label>
            <label><input type="checkbox" name="usResident" required /> I am a US resident.</label>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Sending…' : 'Send claim request'}</Button>
          </form><p role="status">{message}</p></> : <p>Claims are open only to the final top three Players. Sign in with your Player profile after the Season ends.</p>}
      </section> : <>
        {board.ownRank && <p className="season-notice">Your rank: <strong>{board.ownRank.rank}</strong> · <Blokbuks amount={board.ownRank.blokbuks} /></p>}
        {board.claimEligible && <p><a className="ui-button" href="/leaderboard/claim">Claim your prize</a></p>}
        <h2>Top 100 Players</h2><p>Order: Blokbuks, then accuracy, then who reached the score first.</p>
        {board.leaderboard.length ? <table><caption className="ui-sr-only">National Leaderboard</caption><thead><tr><th scope="col">Rank</th><th scope="col">Nickname</th><th scope="col">Blokbuks</th></tr></thead><tbody>{board.leaderboard.map(row)}</tbody></table> : <p>No Players yet. Be the first to join.</p>}
      </>}
    </>}
  </main>;
}
