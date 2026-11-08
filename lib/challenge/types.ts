import type { DayDebrief } from './debrief.ts';
export type Verdict = 'Real' | 'Scam' | 'Unverified';
export type CallerId = 'recruiter' | 'onboarding' | 'fraud_team';
export type Turn = { role: 'system' | 'assistant' | 'user'; text: string; at: string; source?: 'script' | 'nemotron'; leaked?: string[] };
export type CallResult = {
  callerId: CallerId;
  verdict: Verdict;
  turns: Turn[];
  cost: number;
  leaked: string[];
  endReason?: 'disconnect' | 'stop' | 'reply_cap' | 'time_cap';
};
export type Challenge = {
  id: string;
  balance: number;
  interview: 'OPEN' | 'BOOKED';
  bank: 'OPEN' | 'RESOLVED' | 'FAILED';
  callerId: CallerId;
  phase: 'call' | 'verdict' | 'between' | 'complete';
  startedAt: string;
  endedAt?: string;
  endReason?: 'disconnect' | 'stop' | 'reply_cap' | 'time_cap';
  replies: number;
  verdict?: Verdict;
  turns: Turn[];
  calls: CallResult[];
  leaked: string[];
  codeVisible: boolean;
  callbackStep: 0 | 1 | 2 | 3;
  events: { type: 'Verify'; surface: 'portal' | 'bank' | 'callback'; at: string }[];
  /** The saved Debrief agent run for the reveal, once the day is complete. */
  debrief?: DayDebrief;
};
export type Action = { type: 'reply'; text: string } | { type: 'end' | 'next' | 'portal' | 'bank' | 'callback_start' | 'callback_next' } | { type: 'verdict'; verdict: Verdict };
export type ReplyRequest = { turns: Turn[]; options: readonly string[] };
export type Reply = (request: ReplyRequest) => Promise<string>;
