/**
 * Numbers behind the Player analysis and Carrier insights (docs/BLOKBUKS_SEASON.md).
 * Pure: no database, model or network. Code computes every number; agents only write
 * sentences around them (docs/adr/0001). Carrier insights are totals only (docs/adr/0002).
 */

export const TACTICS = ['Urgency', 'Authority', 'Details as proof', 'Reward', 'Fear'] as const;
export type Tactic = typeof TACTICS[number];
export type Verdict = 'Real' | 'Scam' | 'Unverified';
export type Version = 'real' | 'scam';
export type Outcome = 'fell for' | 'caught' | 'false alarm' | 'trusted real';

/** One finished or unfinished call. `verdict: null` means the call has no Verdict yet. */
export type CallRow = {
  playerId: string;
  scenarioId: string;
  category: string;
  tactic: Tactic;
  version: Version;
  verdict: Verdict | null;
  /** The Player gave away a fictional secret. Only meaningful on a scam Version. */
  leaked: boolean;
  synthetic: boolean;
};

export type Scenario = { id: string; category: string; tactic: Tactic };

/** Fewer distinct Players than this and an insight group is hidden (ADR 0002). */
export const MIN_PLAYERS = 5;
/** Finished calls needed before the Player analysis shows. Practice calls count. */
export const ANALYSIS_UNLOCK_CALLS = 2;

/**
 * Scam caller: giving up a secret, or calling it Real, is falling for it; anything else is caught.
 * Real caller: calling it a scam is a false alarm; Real or Unverified is trusting a real caller.
 * A real caller only asks for a safe next step, so a leak flag on a real Version is ignored.
 */
export function outcomeOf(version: Version, verdict: Verdict, leaked: boolean): Outcome {
  if (version === 'scam') return leaked || verdict === 'Real' ? 'fell for' : 'caught';
  return verdict === 'Scam' ? 'false alarm' : 'trusted real';
}

/** Code-point order, so results don't change with the host locale (Worker, CI, browser). */
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const isMiss = (outcome: Outcome) => outcome === 'fell for' || outcome === 'false alarm';

type Finished = CallRow & { verdict: Verdict; outcome: Outcome };

function finished(rows: readonly CallRow[]): Finished[] {
  return rows.flatMap(call => call.verdict ? [{ ...call, verdict: call.verdict, outcome: outcomeOf(call.version, call.verdict, call.leaked) }] : []);
}

export type Tally = { key: string; missed: number; right: number };

export type PlayerAnalysis =
  | { locked: true; finished: number; needed: number }
  | {
    locked: false;
    finished: number;
    byTactic: Tally[];
    byCategory: Tally[];
    /** Real callers the Player called a scam. */
    rejectedReal: number;
    weakest: { tactic: Tactic; missed: number; of: number } | null;
    /** The id of one Call scenario aimed at the weakest Tactic, or null when nothing was missed. */
    tryNext: string | null;
  };

function tally(calls: readonly Finished[], keyOf: (call: Finished) => string): Tally[] {
  const byKey = new Map<string, Tally>();
  for (const call of calls) {
    const key = keyOf(call);
    const entry = byKey.get(key) ?? { key, missed: 0, right: 0 };
    if (isMiss(call.outcome)) entry.missed += 1; else entry.right += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => byText(a.key, b.key));
}

/** `rows` are one Player's calls. */
export function playerAnalysis(rows: readonly CallRow[], scenarios: readonly Scenario[]): PlayerAnalysis {
  const calls = finished(rows);
  if (calls.length < ANALYSIS_UNLOCK_CALLS) return { locked: true, finished: calls.length, needed: ANALYSIS_UNLOCK_CALLS - calls.length };

  const byTactic = tally(calls, call => call.tactic);
  // Most misses, then the higher miss rate, then name, so the answer never depends on input order.
  const worst = byTactic
    .filter(entry => entry.missed > 0)
    .sort((a, b) => b.missed - a.missed || b.missed / (b.missed + b.right) - a.missed / (a.missed + a.right) || byText(a.key, b.key))[0];
  const weakest = worst ? { tactic: worst.key as Tactic, missed: worst.missed, of: worst.missed + worst.right } : null;

  const played = new Map<string, number>();
  for (const call of calls) played.set(call.scenarioId, (played.get(call.scenarioId) ?? 0) + 1);
  const tryNext = weakest
    ? scenarios
      .filter(scenario => scenario.tactic === weakest.tactic)
      .sort((a, b) => (played.get(a.id) ?? 0) - (played.get(b.id) ?? 0) || byText(a.id, b.id))[0]?.id ?? null
    : null;

  return {
    locked: false,
    finished: calls.length,
    byTactic,
    byCategory: tally(calls, call => call.category),
    rejectedReal: calls.filter(call => call.outcome === 'false alarm').length,
    weakest,
    tryNext,
  };
}

export type InsightGroup =
  | { category: string; tactic: Tactic; outcome: Outcome; hidden: true }
  | { category: string; tactic: Tactic; outcome: Outcome; hidden: false; calls: number; players: number };

export type InsightOptions = {
  /** Which rows count: real only (the default), synthetic demo rows only, or both. */
  include?: 'real' | 'synthetic' | 'both';
};

/**
 * Category × Tactic × outcome totals with distinct-Player counts. A group with fewer than
 * MIN_PLAYERS distinct Players is returned hidden with no count. Groups are built from fresh
 * objects so no Player id, scenario id, email, nickname or transcript can ride along.
 */
export function insightTotals(rows: readonly CallRow[], options: InsightOptions = {}): InsightGroup[] {
  const include = options.include ?? 'real';
  const groups = new Map<string, { category: string; tactic: Tactic; outcome: Outcome; calls: number; players: Set<string> }>();
  for (const call of finished(rows)) {
    if (include === 'real' && call.synthetic) continue;
    if (include === 'synthetic' && !call.synthetic) continue;
    const key = JSON.stringify([call.category, call.tactic, call.outcome]);
    const group = groups.get(key) ?? { category: call.category, tactic: call.tactic, outcome: call.outcome, calls: 0, players: new Set<string>() };
    group.calls += 1;
    group.players.add(call.playerId);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => byText(a.category, b.category) || byText(a.tactic, b.tactic) || byText(a.outcome, b.outcome))
    .map(({ category, tactic, outcome, calls, players }): InsightGroup => players.size < MIN_PLAYERS
      ? { category, tactic, outcome, hidden: true }
      : { category, tactic, outcome, hidden: false, calls, players: players.size });
}
