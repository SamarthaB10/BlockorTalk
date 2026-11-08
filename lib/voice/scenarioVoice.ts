/**
 * Browser-safe facts for voicing catalog Call scenarios: which ones have voice and the fictional
 * card values each session gets. No prompts and no Call type. Both shared agents declare these names.
 */
import { scenarioCatalog } from "../season/scenarios/catalog";

/** Every catalog scenario has a live voice session. */
export const VOICE_SCENARIO_IDS: readonly string[] = scenarioCatalog.map(row => row.id);

/** One Japanese caller per catalog scenario, the same for both Versions so a name never hints at the Call type. */
export const SCENARIO_CALLERS: Record<string, string> = {
  bank: "Haruto", delivery: "Sora", holiday: "Mei", business: "Takumi", phishing: "Hina", support: "Riku", government: "Daichi",
  prize: "Yuna", investment: "Kenji", carrier: "Emi", refund: "Sota", insurance: "Nao", sales: "Rin", "wrong-number": "Mio",
};

export const SCENARIO_VARIABLE_NAMES = ["player_name", "caller_name", "org", "card_fact", "practice_code"] as const;

export function isVoiceScenario(id: string): boolean {
  return VOICE_SCENARIO_IDS.includes(id);
}

export function scenarioVoiceVariables(id: string): Record<string, string> | null {
  const row = isVoiceScenario(id) ? scenarioCatalog.find(item => item.id === id) : undefined;
  if (!row) return null;
  return {
    player_name: row.card.name,
    caller_name: SCENARIO_CALLERS[row.id] ?? "Haruto",
    org: row.org,
    card_fact: row.card.facts[0] ?? row.category,
    practice_code: row.secrets[0]?.value ?? "0000",
  };
}
