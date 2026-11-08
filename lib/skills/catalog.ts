/**
 * The six defensive skills the Skill Log tracks. Browser-safe: names, wording and the per-step
 * hints only. Hints depend on the caller step, never on the Call type, so asking for one reveals nothing.
 */
export const SKILL_IDS = ['verify', 'protect', 'urgency', 'authority', 'payment', 'exit'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export type SkillInfo = {
  id: SkillId;
  name: string;
  /** Shorter label for the log list and debrief lines. */
  short: string;
  /** Used in "Practice …" for the recommended drill. */
  practice: string;
  /** What a success looks like, as "You …, but …". */
  recognized: string;
  /** What went differently on a miss, as "…, but …". Describes the moment, never the person. */
  caught: string;
  /** The next opportunity after a miss or a guided attempt. */
  practiceNext: string;
};

export const SKILLS: Record<SkillId, SkillInfo> = {
  verify: {
    id: 'verify', name: 'Verify independently', short: 'Verify independently', practice: 'verifying independently',
    recognized: 'checked through your own app',
    caught: 'the caller’s contact route came before your own check',
    practiceNext: 'Next time, open your own app before you use anything the caller gives you.',
  },
  protect: {
    id: 'protect', name: 'Protect codes and secrets', short: 'Protect codes', practice: 'protecting codes',
    recognized: 'kept your codes private',
    caught: 'the last caller’s code request caught you off guard',
    practiceNext: 'Next time a caller asks for a code, keep it and check through your own app.',
  },
  urgency: {
    id: 'urgency', name: 'Resist urgency', short: 'Resist urgency', practice: 'resisting urgency',
    recognized: 'recognized urgency',
    caught: 'the push to hurry moved the call along',
    practiceNext: 'Next time a caller rushes you, slow down with a question or end the call.',
  },
  authority: {
    id: 'authority', name: 'Challenge authority', short: 'Challenge authority', practice: 'challenging authority',
    recognized: 'questioned who was calling',
    caught: 'the caller’s claimed role went unquestioned',
    practiceNext: 'Next time a caller claims an official role, ask how you can confirm it yourself.',
  },
  payment: {
    id: 'payment', name: 'Inspect payment requests', short: 'Inspect payments', practice: 'inspecting payment requests',
    recognized: 'questioned the payment request',
    caught: 'the payment request went ahead without a check',
    practiceNext: 'Next time a call ends in a payment, check it in your own app before you act.',
  },
  exit: {
    id: 'exit', name: 'Exit safely', short: 'Exit safely', practice: 'exiting safely',
    recognized: 'ended the call on your terms',
    caught: 'the call ran through to the caller’s final request',
    practiceNext: 'Next time a call feels off, end it and call back on a number you already have.',
  },
};

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && (SKILL_IDS as readonly string[]).includes(value);
}

/** One hint per caller step. The same words for every Call scenario and Version. */
export const STEP_HINTS: Record<number, string> = {
  1: 'Ask who is calling and how you could check that yourself.',
  2: 'Knowing your details does not prove who is calling. Your own app is one tap away.',
  3: 'Pressure is a signal. You can slow down, ask a question, or end the call.',
  4: 'Codes and payments stay with you. Check through your own app before you act.',
};

export function hintFor(step: number): string {
  return STEP_HINTS[Math.min(4, Math.max(1, step))]!;
}

/** Drills are short practice calls in a new story for one skill. */
export const DRILL_SECONDS = 60;
export const CALL_SECONDS = 180;

export function drillHref(skill: SkillId, scenarioId: string): string {
  return `/play/${encodeURIComponent(scenarioId)}?drill=${skill}`;
}
