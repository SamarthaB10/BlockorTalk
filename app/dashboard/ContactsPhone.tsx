'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import PixelPhone from '../components/PixelPhone';
import { SCENARIO_TOPICS, TOPICS, type Topic } from './topics';

export type Contact = { id: string; name: string; org: string; about: string; fact: string };

const K = 70, C = 12.5, STEPS = 4;

/** The Scenarios picker: one big phone whose contacts are the practice callers. Rows near the pointer rise in a springy wave. */
export default function ContactsPhone({ contacts, disabled, onCall, actions }: { contacts: Contact[]; disabled: boolean; onCall: (id: string) => void; actions: (id: string) => ReactNode }) {
  const [topic, setTopic] = useState<Topic | 'All'>('All');
  const [open, setOpen] = useState<Contact | null>(null);
  const [ringing, setRinging] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const pointer = useRef<number | null>(null);
  const shown = contacts.filter(c => topic === 'All' || SCENARIO_TOPICS[c.id] === topic).sort((a, b) => a.name.localeCompare(b.name));
  const count = (t: Topic) => contacts.filter(c => SCENARIO_TOPICS[c.id] === t).length;

  useEffect(() => {
    const el = list.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const springs = new Map<Element, { y: number; v: number }>();
    let frame = 0, last = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, .05), h = dt / STEPS;
      last = now;
      let moving = pointer.current !== null;
      for (const row of el.querySelectorAll<HTMLElement>('[data-contact]')) {
        const box = row.getBoundingClientRect();
        const target = pointer.current === null ? 0 : Math.exp(-(((box.top + box.height / 2) - pointer.current) ** 2) / 56 ** 2);
        const s = springs.get(row) ?? { y: 0, v: 0 };
        for (let i = 0; i < STEPS; i++) { s.v += ((target - s.y) * K - s.v * C) * h; s.y += s.v * h; }
        springs.set(row, s);
        if (Math.abs(s.y) > .001 || Math.abs(s.v) > .001) moving = true;
        row.style.transform = `translateX(${-s.y * 14}px) scale(${1 + s.y * .045}) rotate(${-s.v * .35}deg)`;
        row.style.setProperty('--lift', s.y.toFixed(3));
      }
      frame = moving ? requestAnimationFrame(tick) : 0;
    };
    const move = (event: PointerEvent) => {
      pointer.current = event.clientY;
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    };
    const leave = () => { pointer.current = null; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => { cancelAnimationFrame(frame); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); window.removeEventListener('blur', leave); };
  }, [open]);

  function shuffle() {
    const pick = shown[Math.floor(Math.random() * shown.length)];
    if (!pick) return;
    setRinging(pick.id);
    document.getElementById(`contact-${pick.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
    setTimeout(() => { setRinging(null); onCall(pick.id); }, wait);
  }

  let letter = '';
  return <section className="contacts-stage" aria-label="Choose a practice caller">
    <p className="contacts-wordmark" aria-hidden="true">Who’s calling?</p>
    <div className="contacts-phone">
      <div className="contacts-earpiece" aria-hidden="true"><i /><i /><i /></div>
      <div className="contacts-screen">
        {open ? <div className="contact-card pixel-phone-host">
          <button type="button" className="contact-back" onClick={() => setOpen(null)}>‹ Contacts</button>
          <PixelPhone />
          <h2>{open.name}</h2>
          <p className="contact-label">AI practice caller</p>
          <p>{open.org} · {open.about}</p>
          <p>{open.fact}</p>
          <button type="button" className="contact-call" disabled={disabled} onClick={() => onCall(open.id)}>Play by voice ↗</button>
          {actions(open.id)}
        </div> : <>
          <header className="contacts-head"><h2>Contacts</h2><button type="button" className="contacts-shuffle" disabled={disabled || !shown.length || Boolean(ringing)} onClick={shuffle}>Shuffle call</button></header>
          <div className="contacts-groups" role="group" aria-label="Filter scenarios by topic">
            <button type="button" aria-pressed={topic === 'All'} onClick={() => setTopic('All')}>All <span>{contacts.length}</span></button>
            {TOPICS.map(t => <button type="button" key={t} aria-pressed={topic === t} onClick={() => setTopic(t)}>{t} <span>{count(t)}</span></button>)}
          </div>
          <p className="contacts-count" role="status">{topic === 'All' ? `Showing all ${contacts.length} calls` : `Showing ${shown.length} of ${contacts.length} calls`}</p>
          <ul ref={list} className="contacts-list">
            {shown.map((c, i) => {
              const head = c.name[0]!.toUpperCase() !== letter ? (letter = c.name[0]!.toUpperCase()) : null;
              return <li key={c.id} style={{ '--i': i } as CSSProperties}>
                {head && <p className="contacts-letter" aria-hidden="true">{head}</p>}
                <button type="button" id={`contact-${c.id}`} data-contact className={ringing === c.id ? 'is-ringing' : undefined} onClick={() => setOpen(c)}>
                  <span className="contact-avatar" aria-hidden="true">{c.name[0]}</span>
                  <span><strong>{c.name}</strong><small>{c.org} · {c.about}</small></span>
                </button>
              </li>;
            })}
          </ul>
        </>}
      </div>
      <div className="contacts-keypad" aria-hidden="true">{['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => <span key={k}>{k}</span>)}</div>
    </div>
  </section>;
}
