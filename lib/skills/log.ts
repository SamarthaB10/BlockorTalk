/**
 * The Skill Log. Code decides every skill outcome from what the Player actually did in a finished
 * call: replies and their Moves, own-app checks, caller links, hints, how the call ended, and the
 * Verdict. Nothing here calls a model, and nothing is a score: each entry is one piece of evidence.
 *
 * States:
 *  - Unseen: no evidence yet.
 *  - Practiced: tried, or succeeded only with a hint.
 *  - Demonstrated: at least one success without a hint.
 *  - Independent: successes without a hint in two or more different Call scenarios,
 *    and the latest evidence is not a miss.
 */
import { SEASON_TIME_ZONE, type Move, type Verdict } from '../blokbuks/rules.ts';
import { scenarioCatalog } from '../season/scenarios/catalog.ts';
import { SCENARIO_TACTICS } from '../season/scenarios/tactics.ts';
import { SKILL_IDS, SKILLS, drillHref, type SkillId } from './catalog.ts';

export type SkillCall = {
  id: string;
  scenarioId: string;
  category: string;
  org: string;
  tactic: string;
  version: 'real' | 'scam';
  verdict: Verdict;
  /** When the call finished (ISO). */
  at: string;
  replies: { step: number; move: Move; text: string; quote: string; leaked: boolean }[];
  /** Caller step at which the Player first opened their own app, or null. */
  ownAppStep: number | null;
  /** Caller step at which the Player first opened the caller's link, or null. */
  linkStep: number | null;
  /** The caller delivered a link during this call. */
  linkOffered: boolean;
  /** Caller steps at which the Player asked for a hint. */
  hintSteps: number[];
  endedBy: 'player' | 'time' | 'replies' | null;
  drill: SkillId | null;
  secretLabel: string;
};

export type Outcome = 'success' | 'attempt' | 'miss';
export type SkillEntry = {
  skill: SkillId; callId: string; scenarioId: string; scenario: string; at: string;
  outcome: Outcome; guided: boolean; step: number | null; evidence: string;
};
export type SkillState = 'Unseen' | 'Practiced' | 'Demonstrated' | 'Independent';
export type EntryLabel = 'Demonstrated' | 'Practiced' | 'Needs practice';
export type HistoryEntry = {
  day: string; label: EntryLabel; evidence: string; note?: string; scenario: string; href: string; at: string;
};
export type SkillCard = {
  id: SkillId; name: string; short: string; state: SkillState; needsPractice: boolean;
  successes: number; scenarios: number; scenariosTried: number; guided: number; guidance: string;
  latest: string | null; next: string; history: HistoryEntry[];
};
export type Recommendation = { skill: SkillId; title: string; reason: string; scenarioId: string; scenario: string; href: string };
export type ProgressView = {
  summary: { demonstrated: number; independent: number; needsPractice: number; calls: number };
  recommended: Recommendation | null;
  skills: SkillCard[];
};
export type UpdateOutcome = 'Demonstrated' | 'Needs practice' | 'Improved' | 'Independent' | 'Practiced';
export type SkillUpdate = {
  skill: SkillId; name: string; outcome: UpdateOutcome; label: string; state: SkillState;
  why: string; note?: string; next: string;
};

const SAFE: readonly Move[] = ['Probe', 'Protect', 'Verify', 'Disconnect'];
const GIVES_IN: readonly Move[] = ['Comply', 'Leak'];
const PAYMENT_SCENARIOS = new Set(['delivery', 'holiday', 'business', 'phishing', 'prize', 'investment', 'refund', 'sales']);
const URGENCY_TACTICS = new Set(['Urgency', 'Fear']);
const AUTHORITY_TACTICS = new Set(['Authority', 'Details as proof']);

/** Whether a Call scenario gives a chance to use a skill. Used to pick drill stories. */
export function skillApplies(skill: SkillId, scenarioId: string): boolean {
  const tactic = SCENARIO_TACTICS[scenarioId] ?? '';
  if (skill === 'urgency') return URGENCY_TACTICS.has(tactic);
  if (skill === 'authority') return AUTHORITY_TACTICS.has(tactic);
  if (skill === 'payment') return PAYMENT_SCENARIOS.has(scenarioId);
  return true;
}

const said = (quote: string) => `“${quote.trim().replace(/[“”"]/g, '')}”`;

/** Every skill outcome one finished call shows. At most one entry per skill. */
export function judgeCall(call: SkillCall): SkillEntry[] {
  const scam = call.version === 'scam';
  const at = (step: number) => call.replies.find(reply => reply.step === step);
  const guidedAt = (step: number | null) => call.hintSteps.some(hint => hint <= (step ?? 99));
  const entries: SkillEntry[] = [];
  const add = (skill: SkillId, outcome: Outcome, step: number | null, evidence: string) => entries.push({
    skill, outcome, step, evidence, guided: outcome !== 'miss' && guidedAt(step),
    callId: call.id, scenarioId: call.scenarioId, scenario: `${call.org} · ${call.category}`, at: call.at,
  });

  // Verify independently: the Player's own app, before anything the caller supplies.
  const verifyReply = call.replies.find(reply => reply.move === 'Verify');
  if (call.linkStep !== null && (call.ownAppStep === null || call.ownAppStep > call.linkStep)) {
    add('verify', 'miss', call.linkStep, 'Opened the caller’s link before checking your own app.');
  } else if (call.ownAppStep !== null) {
    add('verify', 'success', call.ownAppStep, call.linkOffered
      ? `Opened your own ${call.org} app instead of using the caller’s link.`
      : `Checked the notice in your own ${call.org} app during the call.`);
  } else if (verifyReply) {
    add('verify', 'success', verifyReply.step, `Said you would check another way: ${said(verifyReply.quote)}`);
  } else if (scam && call.verdict === 'Real') {
    add('verify', 'miss', null, 'Trusted the caller without checking your own app.');
  } else if (call.verdict === 'Unverified') {
    add('verify', 'attempt', null, 'Held off on a Verdict without checking your own app.');
  }

  // Protect codes and secrets: the code stays with the Player.
  const leak = call.replies.find(reply => reply.leaked || reply.move === 'Leak');
  const protect = call.replies.find(reply => reply.move === 'Protect');
  const ask = at(4);
  if (leak) {
    add('protect', 'miss', leak.step, `Shared the fictional ${call.secretLabel.toLowerCase()} with the caller.`);
  } else if (protect) {
    add('protect', 'success', protect.step, `Kept the code private: ${said(protect.quote)}`);
  } else if (scam && ask) {
    if (ask.move === 'Comply') add('protect', 'attempt', 4, 'Agreed to the code request, then did not share the code.');
    else add('protect', 'success', 4, `Did not read the code when the caller asked: ${said(ask.quote)}`);
  }

  // Resist urgency: the reply to the pressure step on urgency and fear calls.
  const pressure = at(3);
  if (URGENCY_TACTICS.has(call.tactic) && pressure) {
    if (SAFE.includes(pressure.move)) add('urgency', 'success', 3, `Slowed down under pressure: ${said(pressure.quote)}`);
    else if (scam) add('urgency', 'miss', 3, 'Went along with the caller once they pushed you to hurry.');
  }

  // Challenge authority: asking a caller who claims a role or knows details to prove it.
  if (AUTHORITY_TACTICS.has(call.tactic)) {
    const question = [at(2), at(3)].find(reply => reply && (reply.move === 'Probe' || reply.move === 'Verify'));
    if (question && !question.leaked) add('authority', 'success', question.step, `Questioned who was calling: ${said(question.quote)}`);
    else if (scam && pressure && GIVES_IN.includes(pressure.move)) add('authority', 'miss', 3, 'Accepted the caller’s claimed role without asking how to confirm it.');
  }

  // Inspect payment requests. A shared code belongs to Protect codes alone.
  if (PAYMENT_SCENARIOS.has(call.scenarioId) && !leak) {
    const late = [at(4), at(3)].filter((reply): reply is NonNullable<typeof reply> => Boolean(reply));
    const safeLate = late.find(reply => SAFE.includes(reply.move));
    if (scam) {
      const gaveIn = late.find(reply => reply.move === 'Comply');
      if (gaveIn || call.verdict === 'Real') add('payment', 'miss', gaveIn?.step ?? null, 'Went along with a payment request without checking it.');
      else if (safeLate) add('payment', 'success', safeLate.step, `Questioned the payment request: ${said(safeLate.quote)}`);
    } else if (call.ownAppStep !== null) {
      add('payment', 'success', call.ownAppStep, `Checked the request in your own ${call.org} app before acting.`);
    }
  }

  // Exit safely: ending a call that is going wrong, on the Player's terms.
  const hangUp = call.replies.find(reply => reply.move === 'Disconnect');
  if (scam) {
    if (hangUp) add('exit', 'success', hangUp.step, `Ended the call: ${said(hangUp.quote)}`);
    else if (call.endedBy === 'player' && !ask && !leak) add('exit', 'success', null, 'Ended the call before the caller made their request.');
    else if (!leak && ask?.move === 'Comply') add('exit', 'miss', 4, 'Stayed on the call and went along with the caller’s final request.');
  } else if (hangUp && call.ownAppStep !== null) {
    add('exit', 'success', hangUp.step, 'Ended the call and checked through your own app.');
  }
  return entries;
}

type Folded = { state: SkillState; needsPractice: boolean; entries: SkillEntry[] };

function fold(entries: readonly SkillEntry[]): Folded {
  const clean = entries.filter(entry => entry.outcome === 'success' && !entry.guided);
  const cleanScenarios = new Set(clean.map(entry => entry.scenarioId)).size;
  const latest = entries[entries.length - 1];
  const needsPractice = latest?.outcome === 'miss';
  const state: SkillState = !entries.length ? 'Unseen'
    : !clean.length ? 'Practiced'
      : cleanScenarios >= 2 && !needsPractice ? 'Independent' : 'Demonstrated';
  return { state, needsPractice, entries: [...entries] };
}

function entriesBySkill(calls: readonly SkillCall[]): Record<SkillId, SkillEntry[]> {
  const sorted = [...calls].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const out = Object.fromEntries(SKILL_IDS.map(id => [id, [] as SkillEntry[]])) as Record<SkillId, SkillEntry[]>;
  for (const call of sorted) for (const entry of judgeCall(call)) out[entry.skill].push(entry);
  return out;
}

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: SEASON_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
function dayLabel(at: string, now: Date): string {
  const day = DAY.format(new Date(at));
  if (day === DAY.format(now)) return 'Today';
  if (day === DAY.format(new Date(now.getTime() - 86400000))) return 'Yesterday';
  return 'Earlier';
}

function entryLabel(entry: SkillEntry): EntryLabel {
  if (entry.outcome === 'miss') return 'Needs practice';
  return entry.outcome === 'success' && !entry.guided ? 'Demonstrated' : 'Practiced';
}

/** Where the evidence happened in the call's transcript. Example quizzes have no transcript, so no link. */
export function evidenceHref(entry: Pick<SkillEntry, 'callId' | 'step'>): string {
  if (entry.callId.startsWith('example-')) return '';
  const anchor = entry.step && entry.step <= 4 ? `step-${entry.step}` : 'verdict';
  return `/play/results/${encodeURIComponent(entry.callId)}#${anchor}`;
}

function nextPractice(skill: SkillId, folded: Folded): string {
  if (folded.needsPractice || folded.state === 'Practiced') return SKILLS[skill].practiceNext;
  if (folded.state === 'Unseen') return 'Try a call where this skill comes up.';
  if (folded.state === 'Demonstrated') return 'Try this skill in a different caller scenario, without a hint.';
  return 'Keep it fresh: try it in a new story now and then.';
}

function card(skill: SkillId, folded: Folded, now: Date): SkillCard {
  const successes = folded.entries.filter(entry => entry.outcome === 'success');
  const guided = successes.filter(entry => entry.guided).length;
  const latest = folded.entries[folded.entries.length - 1];
  return {
    id: skill, name: SKILLS[skill].name, short: SKILLS[skill].short,
    state: folded.state, needsPractice: folded.needsPractice,
    successes: successes.length,
    scenarios: new Set(successes.map(entry => entry.scenarioId)).size,
    scenariosTried: new Set(folded.entries.map(entry => entry.scenarioId)).size,
    guided,
    guidance: !successes.length ? 'No successful decisions yet'
      : guided ? `Guidance used in ${guided} of ${successes.length} success${successes.length === 1 ? '' : 'es'}` : 'No guidance needed',
    latest: latest?.evidence ?? null,
    next: nextPractice(skill, folded),
    history: [...folded.entries].reverse().map(entry => ({
      day: dayLabel(entry.at, now), label: entryLabel(entry), evidence: entry.evidence,
      ...(entry.outcome === 'success' && entry.guided ? { note: 'Successful with guidance.' } : {}),
      scenario: entry.scenario, href: evidenceHref(entry), at: entry.at,
    })),
  };
}

const RANK: Record<SkillState, number> = { Practiced: 0, Unseen: 1, Demonstrated: 2, Independent: 3 };

/** A Call scenario for a drill: one this skill applies to, in a story not yet used for it. */
export function drillScenario(skill: SkillId, entries: readonly SkillEntry[]) {
  const options = scenarioCatalog.filter(row => skillApplies(skill, row.id));
  const lastUse = new Map<string, string>();
  for (const entry of entries) lastUse.set(entry.scenarioId, entry.at);
  const fresh = options.find(row => !lastUse.has(row.id));
  return fresh ?? [...options].sort((a, b) => lastUse.get(a.id)!.localeCompare(lastUse.get(b.id)!))[0]!;
}

function recommend(bySkill: Record<SkillId, Folded>, calls: readonly SkillCall[]): Recommendation {
  const latestAt = (id: SkillId) => bySkill[id].entries[bySkill[id].entries.length - 1]?.at ?? '';
  const needs = SKILL_IDS.filter(id => bySkill[id].needsPractice).sort((a, b) => latestAt(b).localeCompare(latestAt(a)));
  const skill = needs[0] ?? [...SKILL_IDS].sort((a, b) =>
    RANK[bySkill[a].state] - RANK[bySkill[b].state] || latestAt(a).localeCompare(latestAt(b)))[0]!;
  const folded = bySkill[skill];
  let reason: string;
  if (folded.needsPractice) {
    const miss = folded.entries[folded.entries.length - 1]!;
    const sameCall = calls.find(call => call.id === miss.callId);
    const win = sameCall ? judgeCall(sameCall).find(entry => entry.outcome === 'success' && entry.skill !== skill) : undefined;
    const caught = SKILLS[skill].caught;
    reason = win ? `You ${SKILLS[win.skill].recognized}, but ${caught}.` : `${caught[0]!.toUpperCase()}${caught.slice(1)}.`;
  } else if (folded.state === 'Practiced') {
    reason = folded.entries.some(entry => entry.outcome === 'success')
      ? 'You have done this with a hint. Try it on your own in a new story.'
      : 'You have tried this. A fresh story is a good next step.';
  } else if (folded.state === 'Unseen') {
    reason = 'This skill has not come up in your calls yet.';
  } else if (folded.state === 'Demonstrated') {
    reason = 'You have shown this once without a hint. Try it in a different story to make it your own.';
  } else {
    reason = 'Every skill is independent. Keep them fresh with a new story.';
  }
  const scenario = drillScenario(skill, folded.entries);
  return {
    skill, title: `Practice ${SKILLS[skill].practice}`, reason,
    scenarioId: scenario.id, scenario: `${scenario.org} · ${scenario.category}`, href: drillHref(skill, scenario.id),
  };
}

/** The Progress screen: summary counts, one recommended drill, and a card per skill. */
export function progressView(calls: readonly SkillCall[], now = new Date()): ProgressView {
  const raw = entriesBySkill(calls);
  const bySkill = Object.fromEntries(SKILL_IDS.map(id => [id, fold(raw[id])])) as Record<SkillId, Folded>;
  const skills = SKILL_IDS.map(id => card(id, bySkill[id], now));
  return {
    summary: {
      demonstrated: skills.filter(skill => skill.state === 'Demonstrated' || skill.state === 'Independent').length,
      independent: skills.filter(skill => skill.state === 'Independent').length,
      needsPractice: skills.filter(skill => skill.needsPractice).length,
      calls: calls.length,
    },
    recommended: recommend(bySkill, calls),
    skills,
  };
}

/**
 * The debrief's one skill update for a finished call. A miss comes first, because it is the next
 * opportunity; then a skill that became Independent; then an improvement; then any success.
 */
export function skillUpdate(calls: readonly SkillCall[], callId: string): SkillUpdate | null {
  const call = calls.find(item => item.id === callId);
  if (!call) return null;
  const order = (item: SkillCall) => `${item.at}\u0000${item.id}`;
  const before = calls.filter(item => item.id !== callId && order(item) < order(call));
  const own = judgeCall(call);
  if (!own.length) return null;
  const prior = entriesBySkill(before);
  const after = entriesBySkill([...before, call]);
  const rate = (entry: SkillEntry): [UpdateOutcome, number] => {
    const was = fold(prior[entry.skill]);
    const now = fold(after[entry.skill]);
    if (entry.outcome === 'miss' || (entry.outcome === 'attempt' && !entry.guided)) return ['Needs practice', 0];
    if (entry.guided) return ['Practiced', 4];
    if (now.state === 'Independent' && was.state !== 'Independent') return ['Independent', 1];
    const last = prior[entry.skill][prior[entry.skill].length - 1];
    if (last && (last.outcome !== 'success' || last.guided)) return ['Improved', 2];
    return ['Demonstrated', 3];
  };
  const ranked = own.map(entry => ({ entry, rated: rate(entry) }));
  const drill = call.drill ? ranked.find(item => item.entry.skill === call.drill) : undefined;
  const pick = drill ?? [...ranked].sort((a, b) => a.rated[1] - b.rated[1] || SKILL_IDS.indexOf(a.entry.skill) - SKILL_IDS.indexOf(b.entry.skill))[0]!;
  const { entry } = pick;
  const outcome = pick.rated[0];
  const info = SKILLS[entry.skill];
  const state = fold(after[entry.skill]).state;
  return {
    skill: entry.skill, name: info.name, outcome, label: `${info.short} · ${outcome}`, state,
    why: `You ${entry.evidence[0]!.toLowerCase()}${entry.evidence.slice(1)}`,
    ...(entry.outcome === 'success' && entry.guided ? { note: 'Successful with guidance.' } : {}),
    next: outcome === 'Needs practice' || outcome === 'Practiced' ? info.practiceNext
      : state === 'Independent' ? 'Keep it fresh: try it in a new story now and then.'
        : 'Try this skill in a different caller scenario, without a hint.',
  };
}
