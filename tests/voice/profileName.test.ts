import { expect, test } from 'vitest';
import { withProfileName } from '../../lib/voice/callers';

const card = { player_name: 'Alex', date_of_birth: 'March 14, 1991', home_address: '418 Pecan Hollow Drive' };

test('a profile nickname is the name the caller speaks', () => {
  expect(withProfileName(card, 'River')).toEqual({ ...card, player_name: 'River' });
});

test('a missing profile keeps the fictional card name', () => {
  expect(withProfileName(card, null)).toBe(card);
  expect(withProfileName(card, '  ')).toBe(card);
});
