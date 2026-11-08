export const TOPICS = ['Money', 'Work', 'Shopping & prizes', 'Phone & tech', 'Government'] as const;
export type Topic = (typeof TOPICS)[number];

/** Topic per scenario. Real and scam callers share topics, so a filter never hints at call type. */
export const SCENARIO_TOPICS: Record<string, Topic> = {
  recruiter: 'Work', onboarding: 'Work', business: 'Work',
  fraud_team: 'Money', bank_callback: 'Money', bank: 'Money', investment: 'Money', refund: 'Money', insurance: 'Money',
  delivery: 'Shopping & prizes', holiday: 'Shopping & prizes', sales: 'Shopping & prizes', prize: 'Shopping & prizes',
  support: 'Phone & tech', phishing: 'Phone & tech', carrier: 'Phone & tech', 'wrong-number': 'Phone & tech',
  government: 'Government',
};
