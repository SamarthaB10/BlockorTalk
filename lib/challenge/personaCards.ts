// Debrief persona cards for the text Challenge day, built from the same callers, beats and fake
// secrets the day uses, so the Debrief agent scores exactly what the player saw.
// Server-only: these cards name each caller's call type, which the board must not reveal mid-day.
import type { PersonaCard } from '../debrief/index.mjs';
import { CALLERS, FAKE_SECRETS, CODE_REQUEST_LINES } from './scenarios.ts';
import type { CallerId } from './types.ts';

const { live_code: _liveCode, ...dayOnlySecrets } = FAKE_SECRETS;
const beatIds = (callerId: CallerId) => CALLERS[callerId].beats.map((_, i) => `b${i + 1}`);
const DISCLOSURE_BEAT = { id: 'disclosure', line: "This is a Tell practice call from an AI voice. It's recorded for your report. Say 'stop drill' anytime." };

function beats(callerId: CallerId, asks: Record<number, { asks_for: string[]; event?: string }> = {}) {
  const caller = CALLERS[callerId];
  return [
    DISCLOSURE_BEAT,
    { id: 'open', line: caller.opening },
    ...beatIds(callerId).map((id, i) => ({ id, line: caller.beats[i][0], ...(asks[i] ?? {}) })),
  ];
}

export const CHALLENGE_PERSONAS: Record<CallerId, PersonaCard> = {
  recruiter: {
    id: 'recruiter',
    persona_name: CALLERS.recruiter.name,
    claimed_org: CALLERS.recruiter.org,
    theme: 'job-interview',
    call_type: 'legit',
    challenge_order: 1,
    demeanor: 'friendly, unhurried, points you to the candidate portal',
    player_first_name: 'Alex',
    fake_secrets: dayOnlySecrets,
    caller_knows: ['operations analyst', 'Tuesday at 10'],
    quirk: 'Offers the candidate portal as a way to check before you decide.',
    script_beats: beats('recruiter'),
    red_flags: [],
    rules_tested: [4],
    task: { id: 'interview', label: 'Book your Bluebonnet Labs interview' },
    stakes: {
      cost: 0,
      cost_secrets: [],
      fail_task_on_cost: false,
      task_done_when: [{ verdict: ['real'] }, { verdict: ['unverified'], event: 'portal_opened' }],
    },
  },
  onboarding: {
    id: 'onboarding',
    persona_name: CALLERS.onboarding.name,
    claimed_org: CALLERS.onboarding.org,
    theme: 'job-offer',
    call_type: 'scam',
    challenge_order: 2,
    demeanor: 'upbeat, casual, treats the deposit as routine',
    player_first_name: 'Alex',
    fake_secrets: dayOnlySecrets,
    caller_knows: ['operations analyst', 'Bluebonnet'],
    quirk: 'Says the gift-card deposit is "totally standard" and talks up the swag pack.',
    script_beats: beats('onboarding', {
      0: { asks_for: ['date_of_birth', 'home_address'] },
      2: { asks_for: ['gift_card_code'] },
      3: { asks_for: ['gift_card_code'] },
    }),
    red_flags: ['odd_payment', 'asks_for_secret', 'reward', 'details_as_proof'],
    rules_tested: [1, 2, 3, 4],
    task: null,
    stakes: { cost: 350, cost_secrets: ['gift_card_code'], fail_task_on_cost: false, task_done_when: [] },
  },
  fraud_team: {
    id: 'fraud_team',
    persona_name: CALLERS.fraud_team.name,
    claimed_org: CALLERS.fraud_team.org,
    theme: 'banking',
    call_type: 'hijacked',
    challenge_order: 3,
    demeanor: 'calm, reassuring, knows your recent charge',
    player_first_name: 'Alex',
    fake_secrets: { ...FAKE_SECRETS },
    caller_knows: ['4417', '23.40', 'restaurant'],
    quirk: 'Says the block only works while you stay on the line.',
    script_beats: beats('fraud_team', {
      1: { asks_for: ['date_of_birth'] },
      2: { asks_for: ['live_code'], event: 'code_popup' },
      3: { asks_for: ['live_code'] },
    }),
    red_flags: ['details_as_proof', 'asks_for_code', 'urgency', 'authority'],
    rules_tested: [1, 2, 3, 4],
    task: { id: 'bank_alert', label: 'Sort out the Corvanta Bank alert' },
    stakes: { cost: 650, cost_secrets: ['live_code'], fail_task_on_cost: true, task_done_when: [{ event: 'callback_completed' }] },
  },
};

/** The beat id for a caller line, or undefined for a line that is not in the script. */
export function beatFor(callerId: CallerId, text: string): string | undefined {
  const caller = CALLERS[callerId];
  if (text === caller.opening) return 'open';
  const i = caller.beats.findIndex(options => (options as readonly string[]).includes(text));
  return i >= 0 ? beatIds(callerId)[i] : undefined;
}

export const isCodeRequest = (text: string) => (CODE_REQUEST_LINES as readonly string[]).includes(text);
