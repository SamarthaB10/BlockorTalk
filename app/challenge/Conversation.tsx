'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { BrowserCallHandle } from '../../lib/voice/browserCall';
import VoiceOrb from './VoiceOrb';
import './conversation.css';

export type ConvoTurn = { key: string | number; who: 'caller' | 'you' | 'system'; label: string; text: string; note?: string };

/** The shared call pane: one orb and one chat window, for every caller. */
export default function Conversation({ turns, handle = null, active, connecting, children }: {
  turns: ConvoTurn[];
  handle?: BrowserCallHandle | null;
  active: boolean;
  connecting: boolean;
  children?: ReactNode;
}) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo(0, log.current.scrollHeight); }, [turns]);
  return <div className="conversation">
    <VoiceOrb handle={handle} active={active} connecting={connecting} />
    <div className="convo" ref={log} role="log" aria-label="Call transcript" aria-live="polite" tabIndex={0}>
      {turns.length === 0 && <p className="convo-empty">The conversation will show up here.</p>}
      {turns.map(turn => <div className={`turn ${turn.who}`} key={turn.key}><strong>{turn.label}</strong><p>{turn.text}</p>{turn.note && <span className="source">{turn.note}</span>}</div>)}
    </div>
    {children}
  </div>;
}
