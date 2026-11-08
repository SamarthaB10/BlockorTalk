'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SCENARIO_TOPICS, TOPICS, type Topic } from './topics';

export type Contact = { id: string; name: string; org: string; about: string; fact: string };

const K = 70, C = 12.5, STEPS = 4;
const GROUPS = ['All', ...TOPICS] as const;
const KEYS = [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', ''], ['#', '']] as const;

const Chevron = ({ turn }: { turn: number }) => <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}><path d="M2 8 6 4l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Handset = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor" /></svg>;

/** The Scenarios picker: an old candybar phone whose address book holds the practice callers. Rows near the pointer rise in a springy wave. */
export default function ContactsPhone({ contacts, disabled, onCall, actions }: { contacts: Contact[]; disabled: boolean; onCall: (id: string) => void; actions: (id: string) => ReactNode }) {
  const [group, setGroup] = useState(0);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState<Contact | null>(null);
  const [ringing, setRinging] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const pointer = useRef<number | null>(null);
  const topic = GROUPS[group]!;
  const shown = contacts.filter(c => topic === 'All' || SCENARIO_TOPICS[c.id] === topic).sort((a, b) => a.name.localeCompare(b.name));
  const current = shown[Math.min(selected, shown.length - 1)];
  const count = (t: Topic | 'All') => t === 'All' ? contacts.length : contacts.filter(c => SCENARIO_TOPICS[c.id] === t).length;

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
        const target = pointer.current === null ? 0 : Math.exp(-(((box.top + box.height / 2) - pointer.current) ** 2) / 40 ** 2);
        const s = springs.get(row) ?? { y: 0, v: 0 };
        for (let i = 0; i < STEPS; i++) { s.v += ((target - s.y) * K - s.v * C) * h; s.y += s.v * h; }
        springs.set(row, s);
        if (Math.abs(s.y) > .001 || Math.abs(s.v) > .001) moving = true;
        row.style.transform = `translateX(${s.y * 10}px) rotate(${-s.v * .25}deg)`;
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

  function select(index: number) {
    const next = (index + shown.length) % shown.length;
    setSelected(next);
    document.getElementById(`contact-${shown[next]?.id}`)?.scrollIntoView({ block: 'nearest' });
  }
  function switchGroup(step: number) { setGroup(g => (g + step + GROUPS.length) % GROUPS.length); setSelected(0); setOpen(null); }
  function jump(letters: string) {
    if (open) return;
    const index = shown.findIndex(c => letters.includes(c.name[0]!.toLowerCase()));
    if (index >= 0) select(index);
  }
  function call() { if (current && !disabled) onCall((open ?? current).id); }
  function shuffle() {
    const pick = shown[Math.floor(Math.random() * shown.length)];
    if (!pick || disabled) return;
    setOpen(null);
    select(shown.indexOf(pick));
    setRinging(pick.id);
    setTimeout(() => { setRinging(null); onCall(pick.id); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
  }

  let letter = '';
  return <section className="contacts-stage" aria-label="Choose a practice caller">
    <div className="retro-phone">
      <span className="retro-speaker" aria-hidden="true" />
      <p className="retro-brand" aria-hidden="true">BLOCK·TALK</p>
      <div className="retro-lcd">
        <div className="retro-status" aria-hidden="true"><span className="retro-signal"><i /><i /><i /><i /></span><span>Contacts</span><span className="retro-battery" /></div>
        {open ? <div className="retro-card">
          <h2>{open.name}</h2>
          <p className="retro-label">AI practice caller</p>
          <p>{open.org}</p>
          <p>{open.about}</p>
          <p>{open.fact}</p>
          <button type="button" className="retro-play" disabled={disabled} onClick={() => onCall(open.id)}>Play by voice ↗</button>
          {actions(open.id)}
        </div> : <>
          <div className="retro-group" role="group" aria-label="Filter scenarios by topic">
            {GROUPS.map((t, i) => <button type="button" key={t} aria-pressed={group === i} onClick={() => { setGroup(i); setSelected(0); }}>{t} <span>{count(t)}</span></button>)}
          </div>
          <p className="contacts-count" role="status">{topic === 'All' ? `Showing all ${contacts.length} calls` : `Showing ${shown.length} of ${contacts.length} calls`}</p>
          <ul ref={list} className="contacts-list">
            {shown.map((c, i) => {
              const head = c.name[0]!.toUpperCase() !== letter ? (letter = c.name[0]!.toUpperCase()) : null;
              return <li key={c.id} style={{ '--i': i } as CSSProperties}>
                {head && <p className="contacts-letter" aria-hidden="true">{head}</p>}
                <button type="button" id={`contact-${c.id}`} data-contact aria-current={c === current ? 'true' : undefined} className={ringing === c.id ? 'is-ringing' : undefined}
                  onPointerEnter={() => setSelected(i)} onFocus={() => setSelected(i)} onClick={() => setOpen(c)}>
                  <strong>{c.name}</strong><small>{c.org} · {c.about}</small>
                </button>
              </li>;
            })}
          </ul>
        </>}
        <div className="retro-softkeys" aria-hidden="true"><span>{open ? 'Back' : 'Shuffle'}</span><span>{open ? 'Call' : 'Open'}</span></div>
      </div>
      <div className="retro-controls">
        <button type="button" className="retro-soft" aria-label={open ? 'Back' : 'Shuffle call'} onClick={() => open ? setOpen(null) : shuffle()} disabled={!open && (disabled || Boolean(ringing))} />
        <div className="retro-dpad">
          <button type="button" aria-label="Previous contact" onClick={() => select(selected - 1)}><Chevron turn={0} /></button>
          <button type="button" aria-label="Previous topic" onClick={() => switchGroup(-1)}><Chevron turn={270} /></button>
          <button type="button" aria-label={current ? `Open ${current.name}` : 'Open'} className="retro-ok" onClick={() => current && setOpen(current)}>OK</button>
          <button type="button" aria-label="Next topic" onClick={() => switchGroup(1)}><Chevron turn={90} /></button>
          <button type="button" aria-label="Next contact" onClick={() => select(selected + 1)}><Chevron turn={180} /></button>
        </div>
        <button type="button" className="retro-soft" aria-label={open ? `Call ${open.name} by voice` : current ? `Open ${current.name}` : 'Open'} onClick={() => open ? call() : current && setOpen(current)} />
        <button type="button" className="retro-call" aria-label={current ? `Call ${(open ?? current).name} by voice` : 'Call'} disabled={disabled || !current} onClick={call}><Handset /></button>
        <button type="button" className="retro-end" aria-label="Back to contacts" onClick={() => { setOpen(null); setGroup(0); setSelected(0); }}><Handset /></button>
      </div>
      <div className="retro-keypad">
        {KEYS.map(([key, letters]) => letters
          ? <button type="button" key={key} aria-label={`Jump to ${letters.toUpperCase()}`} onClick={() => jump(letters)}><b>{key}</b><small>{letters}</small></button>
          : <span key={key} aria-hidden="true"><b>{key}</b></span>)}
      </div>
    </div>
  </section>;
}
