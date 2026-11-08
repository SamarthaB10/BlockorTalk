export type RuleNumber = 1 | 2 | 3 | 4;
export const RULES: ReadonlyArray<{ rule: RuleNumber; title: string }>;
export const MOVES: ReadonlyArray<'probe' | 'protect' | 'verify' | 'disconnect'>;
export const TACTICS: ReadonlyArray<'authority' | 'urgency' | 'details-as-proof' | 'reward' | 'fear'>;
export const VERIFY_EVENTS: ReadonlyArray<'portal_opened' | 'bank_app_opened' | 'callback_completed'>;
export const SECRET_LABELS: Readonly<Record<string, string>>;
export function secretLabel(key: string): string;
export const VERIFY_LABELS: Readonly<Record<'portal_opened' | 'bank_app_opened' | 'callback_completed', string>>;
