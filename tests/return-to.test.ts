import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import PlayerSignup from '../app/components/PlayerSignup';
import { safeReturnPath } from '../lib/players/returnTo';

test('a play path is not a safe return path', () => {
  expect(safeReturnPath('/play/bank')).toBeNull();
  expect(safeReturnPath('/play')).toBeNull();
  expect(safeReturnPath('/play/results/call-1')).toBeNull();
  expect(safeReturnPath('/play/insurance')).toBeNull();
  expect(safeReturnPath('%2Fplay%2Fbank')).toBeNull();
  for (const blocked of ['https://evil.test/play', '//evil.test/play', '/playground', '/profile', '/play/../profile', '/%2f%2fevil.test', '/play/bank\nbad', '']) {
    expect(safeReturnPath(blocked)).toBeNull();
  }
});

test('an old play return stays on the profile page', () => {
  const html = renderToStaticMarkup(createElement(PlayerSignup, { returnTo: '/play/insurance' }));
  expect(html).not.toContain('/play/insurance');
  expect(html).not.toContain('returnTo');
  expect(html).not.toContain('Continue this practice call');
});
