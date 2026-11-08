import type { PublicScenario, Sheet } from '../scenarios/types';

export type Verdict = 'Real' | 'Scam' | 'Unverified';
export type CallAction = { type: 'reply'; text: string } | { type: 'end' } | { type: 'own-app' } | { type: 'caller-link' } | { type: 'hint' } | { type: 'verdict'; verdict: Verdict };
export type PublicCall = {
  id: string;
  scenario: PublicScenario;
  label: 'AI practice caller';
  turns: { role: 'caller' | 'player'; text: string; step: number }[];
  phase: 'call' | 'verdict' | 'complete';
  replies: number;
  startedAt: string;
  serverNow: string;
  scored: boolean;
  callsLeft: number;
  callerLink?: { href: string };
  sheet?: Sheet;
  /** 180 for a call, 60 for a drill. */
  limitSeconds?: number;
  /** The latest hint the Player asked for. The same words for every Version. */
  hint?: string;
  drill?: { skill: string; name: string };
  result?: Record<string, unknown>;
};
