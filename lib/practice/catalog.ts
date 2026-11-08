/**
 * Browser-safe practice catalog: what the player sees before and during a call.
 * Deliberately holds NO call types (real, scam, hijacked) for the scenarios. Those
 * live server-side in lib/practice/script.ts and are revealed only after a verdict.
 * Battle cards are scam moves by definition, so they use their own callers, never
 * the four scenario callers, and can't give a scenario away.
 */
import type { ChallengeCallerId } from "../voice/callers";

/** Every card value is fictional. */
export const IDENTITY = {
  player_name: "Alex",
  date_of_birth: "March 14, 1991",
  home_address: "418 Pecan Hollow Drive, Plano, Texas",
} as const;

export type ScenarioId = "recruiter" | "onboarding" | "fraud_team" | "bank_callback";

export interface Scenario {
  id: ScenarioId;
  agent: ChallengeCallerId;
  caller: string;
  org: string;
  theme: "Jobs" | "Banking";
  /** Who calls whom, in the player's words. */
  direction: "They call you" | "You call them";
  card: string;
  /** Fictional details on the card the player should protect. */
  protect: { label: string; value: string }[];
  /** A code that arrives mid-call; shown when the caller brings it up. */
  liveCode?: { label: string; value: string };
  /** Dynamic variables for this caller's ElevenLabs agent. */
  voiceVariables: Record<string, string>;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "recruiter",
    agent: "recruiter",
    caller: "Yui",
    org: "Bluebonnet Labs recruiting",
    theme: "Jobs",
    direction: "They call you",
    card: "You applied for the operations analyst role at Bluebonnet Labs. Your candidate portal shows an interview on Tuesday at 10 AM.",
    protect: [
      { label: "Date of birth", value: IDENTITY.date_of_birth },
      { label: "Home address", value: IDENTITY.home_address },
    ],
    voiceVariables: { ...IDENTITY, interview_role: "operations analyst", interview_slot: "Tuesday at 10 AM" },
  },
  {
    id: "onboarding",
    agent: "onboarding",
    caller: "Ren",
    org: "Bluebonnet Labs onboarding",
    theme: "Jobs",
    direction: "They call you",
    card: "You have an interview coming up for the operations analyst role at Bluebonnet Labs. You also bought a $350 gift card for a friend's birthday.",
    protect: [
      { label: "Gift-card code", value: "4729" },
      { label: "Date of birth", value: IDENTITY.date_of_birth },
      { label: "Home address", value: IDENTITY.home_address },
    ],
    voiceVariables: { ...IDENTITY, interview_role: "operations analyst", deposit_amount: "$350", gift_card_code: "4729" },
  },
  {
    id: "fraud_team",
    agent: "fraud_team",
    caller: "Kai",
    org: "Corvanta Bank fraud team",
    theme: "Banking",
    direction: "They call you",
    card: "Your Corvanta card ends in 4417. Yesterday you spent $23.40 at a restaurant. A one-time code may arrive on your phone during the call.",
    protect: [
      { label: "Date of birth", value: IDENTITY.date_of_birth },
      { label: "Home address", value: IDENTITY.home_address },
    ],
    liveCode: { label: "Corvanta one-time code", value: "551 274" },
    voiceVariables: { ...IDENTITY, card_ending: "4417", recent_charge: "$23.40 at a restaurant yesterday", live_code: "551 274" },
  },
  {
    id: "bank_callback",
    agent: "bank_callback",
    caller: "Aki",
    org: "Corvanta Bank",
    theme: "Banking",
    direction: "You call them",
    card: "Someone called about your Corvanta card ending in 4417. You're calling Corvanta back on the number in your bank app to check.",
    protect: [
      { label: "Date of birth", value: IDENTITY.date_of_birth },
      { label: "Home address", value: IDENTITY.home_address },
    ],
    voiceVariables: { ...IDENTITY, card_ending: "4417" },
  },
];

export const RULES = [
  { n: 1, text: "Never share codes, PINs, passwords, your SSN or identity details." },
  { n: 2, text: "Pressure is the tell." },
  { n: 3, text: "Knowing your details doesn't prove who's calling." },
  { n: 4, text: "Hang up and call back on a number you already have." },
] as const;

export type Tactic = "Authority" | "Urgency" | "Details as proof" | "Reward" | "Fear";

export interface BattleCard {
  id: string;
  theme: "Banking" | "Shopping" | "Phone provider";
  tactic: Tactic;
  caller: string;
  org: string;
  line: string;
  pushback: string;
  secret: { label: string; value: string };
  safeSay: string;
  safeDo: string;
  rules: number[];
  why: string;
}

export const BATTLE_CARDS: readonly BattleCard[] = [
  {
    id: "port-out-code",
    theme: "Phone provider",
    tactic: "Details as proof",
    caller: "Ray",
    org: "Nimbus Mobile security",
    line: "I just texted you a code. Read it back so I can cancel the port.",
    pushback: "I can see your plan and your last bill, so you know this is real. The port goes through in five minutes.",
    secret: { label: "one-time code", value: "482 913" },
    safeSay: "I don't share codes. I'll call Nimbus back on the number in my app.",
    safeDo: "Hang up, then call the number in your Nimbus app.",
    rules: [1, 4],
    why: "He already knows your plan and bill, so he feels real.",
  },
  {
    id: "line-shutoff-pin",
    theme: "Phone provider",
    tactic: "Urgency",
    caller: "Ava",
    org: "Nimbus Mobile billing",
    line: "Your line will be cut off in 30 minutes unless you confirm your account PIN with me now.",
    pushback: "I'm trying to help you here. Once it's cut off, reconnection takes three days.",
    secret: { label: "account PIN", value: "7302" },
    safeSay: "I won't give my PIN on a call. I'll check my account in the Nimbus app.",
    safeDo: "Hang up and check your bill in the app or on the number on your statement.",
    rules: [1, 2, 4],
    why: "A short deadline leaves no time to think.",
  },
  {
    id: "customs-fee",
    theme: "Shopping",
    tactic: "Urgency",
    caller: "Priya",
    org: "ParcelKite delivery",
    line: "Your package is held at customs. Pay the $2.99 fee with your card number now or it goes back to the sender.",
    pushback: "It's only $2.99, and the truck leaves at five. Just read me the card number.",
    secret: { label: "card number", value: "4417 2290 1188 3051" },
    safeSay: "I don't pay fees over the phone. I'll check the tracking in my ParcelKite account.",
    safeDo: "Hang up and open the tracking page from the order email you already have.",
    rules: [1, 2, 4],
    why: "The amount is tiny, so it doesn't feel risky.",
  },
  {
    id: "refund-code",
    theme: "Shopping",
    tactic: "Fear",
    caller: "Tom",
    org: "ShopNest support",
    line: "There's a $499 order on your ShopNest account. To cancel it, I need the code we just sent you.",
    pushback: "If you don't cancel it now, the charge goes through tonight and I can't reverse it.",
    secret: { label: "one-time code", value: "903 155" },
    safeSay: "I'll check my orders in the ShopNest app myself. I don't read codes to anyone.",
    safeDo: "Hang up and look at your orders in the app.",
    rules: [1, 2, 4],
    why: "A big surprise charge makes you want to act fast.",
  },
  {
    id: "safe-account",
    theme: "Banking",
    tactic: "Authority",
    caller: "Derek",
    org: "Corvanta Bank security",
    line: "Your account is compromised. Move your savings to a safe account today, and I'll give you the account number.",
    pushback: "I'm with the security department. If you wait, you could lose everything by tonight.",
    secret: { label: "online banking password", value: "Pecan!91" },
    safeSay: "My bank would never ask me to move money. I'll call the number on the back of my card.",
    safeDo: "Hang up and call the number on your card. Move nothing.",
    rules: [2, 4],
    why: "Someone official telling you to act feels like protection.",
  },
  {
    id: "freeze-card",
    theme: "Banking",
    tactic: "Details as proof",
    caller: "Maria",
    org: "Corvanta Bank",
    line: "Your card ending in 4417 was just used in another state. Confirm your date of birth so I can freeze it.",
    pushback: "I already have your card number on my screen. I just need your date of birth to verify you.",
    secret: { label: "date of birth", value: "March 14, 1991" },
    safeSay: "Knowing my card doesn't prove who you are. I'll call Corvanta on the number in my app.",
    safeDo: "Hang up and call the number in your bank app.",
    rules: [1, 3, 4],
    why: "She knows your card ending, so she sounds like the bank.",
  },
];

/** Dynamic variables for the battle-card agent. */
export function cardVoiceVariables(card: BattleCard): Record<string, string> {
  return {
    ...IDENTITY,
    persona_name: card.caller,
    persona_org: card.org,
    scammer_line: card.line,
    pushback: card.pushback,
    secret_label: card.secret.label,
    secret_value: card.secret.value,
  };
}
