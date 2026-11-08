/** The hello popup and the Profile tab share this name. It stays on this device. */
export const CALL_NAME_KEY = 'block-or-call-welcome';

/** null when the hello has never been answered. A skipped hello is stored as "". */
export function storedCallName(): string | null {
  try {
    const saved = localStorage.getItem(CALL_NAME_KEY);
    return saved === null ? null : saved.trim();
  } catch {
    return null;
  }
}

export function saveCallName(name: string): string {
  const value = name.trim().slice(0, 40);
  try { localStorage.setItem(CALL_NAME_KEY, value); } catch { /* private mode still uses the name for this visit */ }
  return value;
}
