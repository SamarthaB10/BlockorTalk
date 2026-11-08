import type { Scenario } from './types.ts';

/** The pressure lever each Call scenario leans on. Browser-safe: a Tactic never reveals the Call type. */
export const SCENARIO_TACTICS: Record<string, Scenario['tactic']> = {
  bank: 'Details as proof', delivery: 'Urgency', holiday: 'Reward', business: 'Authority', phishing: 'Urgency',
  support: 'Fear', government: 'Authority', prize: 'Reward', investment: 'Reward', carrier: 'Details as proof',
  refund: 'Reward', insurance: 'Fear', sales: 'Reward', 'wrong-number': 'Details as proof',
};
