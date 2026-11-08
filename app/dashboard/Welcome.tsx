'use client';

import { useEffect, useRef, useState } from 'react';
import SpritePlayer from '../components/SpritePlayer';

export default function Welcome({ onName }: { onName: (name: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    try { setName(localStorage.getItem('block-or-call-welcome') ?? ''); } catch {}
    dialog.current?.showModal();
    input.current?.focus();
  }, []);
  function finish(value: string) {
    try { localStorage.setItem('block-or-call-welcome', value); } catch {}
    onName(value);
    dialog.current?.close();
  }
  return <dialog ref={dialog} className="welcome-dialog" aria-labelledby="welcome-title" aria-describedby="welcome-note" onCancel={event => event.preventDefault()}>
    <div className="welcome-friend"><SpritePlayer personality="planner" animation="excited" /></div>
    <h2 id="welcome-title">Hi! Nice to meet you.</h2>
    <p>I’m your practice buddy.<br />What should I call you?</p>
    <form onSubmit={event => { event.preventDefault(); if (name.trim()) finish(name.trim()); }}>
      <label htmlFor="welcome-name">Your name or nickname</label>
      <input ref={input} id="welcome-name" value={name} onChange={event => setName(event.target.value)} placeholder="Type your name…" maxLength={40} autoComplete="off" required />
      <button className="welcome-go" disabled={!name.trim()}>Let’s meet your next call ↗</button>
    </form>
    <p id="welcome-note" className="welcome-note">Just for your dashboard. Saved on this device.<br />Practice calls still use fictional details.</p>
  </dialog>;
}
