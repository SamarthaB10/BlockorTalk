/**
 * Category playbooks for the season call generator. Research-backed beats for Magenta-style
 * carrier fraud (port-out, SIM/eSIM swap, fake support + OTP), kept fictional (Bramblebell, etc.).
 * Lines 1–3 never ask for secrets; the fourth line is fixed as ask_line / next_step in server.ts.
 */
import type { PublicScenario, Version } from './types.ts';

export type ThreeLines = [string, string, string];

export type CategoryPlaybook = {
  /** Extra system instructions for Nemotron when writing spoken lines 1–3. */
  guidance: string;
  /** Outline for spoken step 3 (pressure / guidance). */
  scamPressureOutline: string;
  realGuidanceOutline: string;
  /** Spoken fourth line for scam (asks for the practice code without naming call type). */
  askLine: string;
  fixed: (scenario: PublicScenario, version: Version) => ThreeLines;
};

/** Magenta-pattern carrier drills: fake support + OTP, port-out notice, details-as-proof. */
const CARRIER: CategoryPlaybook = {
  guidance: [
    'This is a phone-carrier account call about a pending number transfer or device change.',
    'Scam pattern (do not say "scam"): sound like account security, cite the fictional line or transfer notice as proof you already know them, create time pressure that service will change soon, and never ask for a code, PIN, passcode or secret in these three lines — the fourth line does that separately.',
    'Real pattern (do not say "real"): same opening facts, calm tone, steer the player to their own carrier app and its saved contact; never ask for a code or PIN.',
    'Never name real carriers. Never invent numbers, links or addresses. Never say the player should trust caller ID.',
  ].join(' '),
  scamPressureOutline: 'Warn that the pending transfer will finish soon unless they stay on the line — without asking for a secret.',
  realGuidanceOutline: 'Tell them to open their own carrier app and use the saved contact to confirm the notice — without asking for a secret.',
  askLine: 'Please read me the verification code that was just texted to this line so I can stop the transfer.',
  fixed: (scenario, version) => [
    `Hello, this is ${scenario.org} account security calling about a pending number transfer.`,
    scenario.card.facts[0] ?? 'There is a pending transfer notice on your line.',
    version === 'real'
      ? 'Please open your own carrier app and use its saved contact to confirm the notice yourself.'
      : 'The transfer will complete in the next few minutes unless we finish verifying while you are still on this call.',
  ],
};

const SUPPORT: CategoryPlaybook = {
  guidance: [
    'This is a tech-support style call about a compromised device or account.',
    'Scam pattern: claim urgent compromise, push remote help or immediate action, never ask for codes in these three lines.',
    'Real pattern: acknowledge the notice and send them to their own app or saved contact; never ask for codes.',
    'Never name real vendors. Never invent links or download URLs.',
  ].join(' '),
  scamPressureOutline: 'Claim the device or account is at risk right now and they must stay on the line — without asking for a secret.',
  realGuidanceOutline: 'Ask them to check the notice in their own app using the saved contact — without asking for a secret.',
  askLine: 'Please read me your fictional Practice protection code so I can unlock the secure session.',
  fixed: (scenario, version) => [
    `Hello from ${scenario.org}. I am calling about a security notice on your device.`,
    scenario.card.facts[0] ?? 'There is a practice security notice in your account.',
    version === 'real'
      ? 'Please review the notice through your own app using its saved contact.'
      : 'We need to finish securing the account while you are still on this call.',
  ],
};

const BY_CATEGORY: Record<string, CategoryPlaybook> = {
  'Phone carrier port-out': CARRIER,
  'Tech support': SUPPORT,
};

export function playbookFor(category: string): CategoryPlaybook | null {
  return BY_CATEGORY[category] ?? null;
}
