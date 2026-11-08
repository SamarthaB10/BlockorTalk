import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import PlayerSignup from '../app/components/PlayerSignup';
import { safeReturnPath } from '../lib/players/returnTo';

test('a practice call can be resumed only on a play path', () => {
  expect(safeReturnPath('/play/bank')).toBe('/play/bank');
  expect(safeReturnPath('/play')).toBe('/play');
  expect(safeReturnPath('/play/results/call-1')).toBe('/play/results/call-1');
  expect(safeReturnPath('%2Fplay%2Fbank')).toBe('/play/bank');
  for (const blocked of ['https://evil.test/play', '//evil.test/play', '/playground', '/profile', '/play/../profile', '/%2f%2fevil.test', '/play/bank\nbad', '']) {
    expect(safeReturnPath(blocked)).toBeNull();
  }
});

test('the profile explains that sign-in returns to the practice call', () => {
  const html = renderToStaticMarkup(createElement(PlayerSignup, { returnTo: '/play/bank' }));
  expect(html).toContain('Sign in to start this practice call.');
  expect(html).toContain('href="/play/bank"');
  expect(html).toContain('Continue this practice call');
});
