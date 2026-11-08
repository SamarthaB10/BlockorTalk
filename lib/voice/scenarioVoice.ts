/**
 * Browser-safe facts for voicing catalog Call scenarios: which ones have voice and the fictional
 * card values each session gets. No prompts and no Call type. Both shared agents declare these names.
 */
import { scenarioCatalog } from "../season/scenarios/catalog";

/** Every catalog scenario has a live voice session. */
export const VOICE_SCENARIO_IDS: readonly string[] = scenarioCatalog.map(row => row.id);

export const SCENARIO_VARIABLE_NAMES = ["player_name", "caller_name", "org", "card_fact", "practice_code"] as const;

export function isVoiceScenario(id: string): boolean {
  return VOICE_SCENARIO_IDS.includes(id);
}

export function scenarioVoiceVariables(id: string): Record<string, string> | null {
  const row = isVoiceScenario(id) ? scenarioCatalog.find(item => item.id === id) : undefined;
  if (!row) return null;
  return {
    player_name: row.card.name,
    caller_name: "Jordan",
    org: row.org,
    card_fact: row.card.facts[0] ?? row.category,
    practice_code: row.secrets[0]?.value ?? "0000",
  };
}
