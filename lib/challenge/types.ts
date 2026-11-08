export type Verdict = 'Real' | 'Scam' | 'Unverified';
export type CallerId = 'recruiter' | 'onboarding' | 'fraud_team';
/** `leaked` lists the fake secrets first said on this player turn (kept even when the text is redacted). */
export type Turn = { role: 'system' | 'assistant' | 'user'; text: string; at: string; source?: 'script' | 'nemotron'; leaked?: string[] };
export type VerifyRecord = { type: 'Verify'; surface: 'portal' | 'bank' | 'callback'; at: string };
export type CallResult = {
  callerId: CallerId;
  verdict: Verdict;
  turns: Turn[];
  cost: number;
  leaked: string[];
  /** Saved from the reveal on. Older saved days lack them; the reveal falls back to the first turn. */
  startedAt?: string;
  endedAt?: string;
  endReason?: 'disconnect' | 'stop' | 'reply_cap' | 'time_cap';
};
export type VoiceTurnInput = { role: 'assistant' | 'user'; text: string };
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
  events: VerifyRecord[];
  /** Set once this call's spoken transcript has been saved, so it can't be appended twice. */
  voiceSaved?: boolean;
  /** The detective reveal, cached after the day completes. Not sent with day responses. */
  reveal?: import('./reveal.ts').RevealPayload;
};
export type Action = { type: 'reply'; text: string } | { type: 'end' | 'next' | 'portal' | 'bank' | 'callback_start' | 'callback_next' } | { type: 'verdict'; verdict: Verdict } | { type: 'voice_turns'; turns: VoiceTurnInput[] };
export type ReplyRequest = { turns: Turn[]; options: readonly string[] };
export type Reply = (request: ReplyRequest) => Promise<string>;
