import { afterEach, expect, test, vi } from 'vitest';
import { saveCallName, storedCallName } from '../lib/callName';

afterEach(() => { vi.unstubAllGlobals(); });

test('the hello and the profile tab share one saved name', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  });
  expect(storedCallName()).toBeNull();
  expect(saveCallName('  River  ')).toBe('River');
  expect(storedCallName()).toBe('River');
});
