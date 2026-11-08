/**
 * Example quizzes: a starter Skill Log for every account. Generated in code from the Player id, so
 * each account gets its own stable mix of example calls (the same on every read and every device)
 * without writing anything to the database. Real calls are added on top, so a Player's own
 * decisions keep building the log from there. Example entries are dated before the Season and are
 * marked "(example quiz)" wherever the Skill Log names the scenario.
 */
import type { Move, Verdict } from '../blokbuks/rules.ts';
import { scenarioCatalog } from '../season/scenarios/catalog.ts';
import { SCENARIO_TACTICS } from '../season/scenarios/tactics.ts';
import type { SkillCall } from './log.ts';

export const EXAMPLE_PREFIX = 'example-';
export const EXAMPLE_LABEL = 'Example quiz';
const EXAMPLES_PER_PLAYER = 6;
/** The example quizzes finish before this moment, so real calls always come after them. */
const LAST_EXAMPLE_AT = Date.parse('2026-11-07T22:00:00Z');

export const isExampleCall = (callId: string) => callId.startsWith(EXAMPLE_PREFIX);

type Reply = [step: number, move: Move, text: string, leaked?: boolean];
type Template = {
  version: 'real' | 'scam';
  verdict: Verdict;
  replies: (code: string) => Reply[];
  ownAppStep?: number;
  linkStep?: number;
  hintSteps?: number[];
  endedBy: SkillCall['endedBy'];
};

/** Plausible ways a Player gets through a call, good and bad, so each example log shows a mix. */
const TEMPLATES: Record<string, Template> = {
  careful: {
    version: 'scam', verdict: 'Scam', ownAppStep: 4, endedBy: 'player',
    replies: () => [[1, 'Probe', 'Who is this, please?'], [2, 'Probe', 'How can I confirm you are really with them?'], [3, 'Protect', 'I don’t share codes over the phone.'], [4, 'Verify', 'I’ll check this in my own app instead.']],
  },
  rushed: {
    version: 'scam', verdict: 'Real', endedBy: 'replies',
    replies: code => [[2, 'Comply', 'Okay, that sounds right.'], [3, 'Comply', 'Alright, what do I need to do?'], [4, 'Leak', `Fine, it’s ${code}.`, true]],
  },
  hangUp: {
    version: 'scam', verdict: 'Scam', ownAppStep: 3, endedBy: 'player',
    replies: () => [[2, 'Probe', 'Why do you need this right now?'], [3, 'Disconnect', 'I’m going to hang up and call back on the number I have.']],
  },
  helpedReal: {
    version: 'real', verdict: 'Real', ownAppStep: 4, endedBy: 'replies',
    replies: () => [[2, 'Probe', 'Which account is this about?'], [3, 'Comply', 'Okay, I can do that.'], [4, 'Comply', 'Sure, I’ll look at it in the app.']],
  },
  guided: {
    version: 'scam', verdict: 'Unverified', hintSteps: [3], endedBy: 'replies',
    replies: () => [[2, 'Probe', 'Which department are you calling from?'], [3, 'Protect', 'I’d rather not share that.'], [4, 'Protect', 'No, I’ll keep the code to myself.']],
  },
  followedLink: {
    version: 'scam', verdict: 'Unverified', linkStep: 3, endedBy: 'time',
    replies: () => [[2, 'Comply', 'Okay, go on.'], [3, 'Probe', 'Is this link safe to open?']],
  },
};
const MIX = ['careful', 'rushed', 'hangUp', 'helpedReal', 'guided', 'careful', 'rushed', 'hangUp'];

/** FNV-1a hash of the Player id, then a small seeded generator, so each account's mix is stable. */
function seededRandom(playerId: string) {
  let hash = 2166136261;
  for (let i = 0; i < playerId.length; i++) hash = Math.imul(hash ^ playerId.charCodeAt(i), 16777619);
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The example quizzes for one Player, oldest first. */
export function exampleCalls(playerId: string): SkillCall[] {
  const next = seededRandom(playerId);
  const scenarios = shuffled(scenarioCatalog, next).slice(0, EXAMPLES_PER_PLAYER);
  const mix = shuffled(MIX, next);
  return scenarios.map((scenario, i): SkillCall => {
    const template = TEMPLATES[scenario.id === 'phishing' && next() < 0.5 ? 'followedLink' : mix[i]!]!;
    const secret = scenario.secrets[0];
    // Spread over the two days before the Season, about seven hours apart, oldest first.
    const at = new Date(LAST_EXAMPLE_AT - (EXAMPLES_PER_PLAYER - 1 - i) * 7 * 3600_000 - Math.floor(next() * 3600_000)).toISOString();
    return {
      id: `${EXAMPLE_PREFIX}${i + 1}`,
      scenarioId: scenario.id,
      category: `${scenario.category} (${EXAMPLE_LABEL.toLowerCase()})`,
      org: scenario.org,
      tactic: SCENARIO_TACTICS[scenario.id] ?? '',
      version: template.version,
      verdict: template.verdict,
      at,
      replies: template.replies(secret?.value ?? '0000').map(([step, move, text, leaked = false]) => ({ step, move, text, quote: text, leaked })),
      ownAppStep: template.ownAppStep ?? null,
      linkStep: template.linkStep ?? null,
      linkOffered: template.linkStep !== undefined,
      hintSteps: template.hintSteps ?? [],
      endedBy: template.endedBy,
      drill: null,
      secretLabel: secret?.label ?? 'practice code',
    };
  });
}

/** A Player's Skill Log calls: their example quizzes first, then every real call they finish. */
export function withExamples(playerId: string, calls: readonly SkillCall[]): SkillCall[] {
  return [...exampleCalls(playerId), ...calls];
}
