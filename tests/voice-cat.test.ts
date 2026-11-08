import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import VoiceCat from '../app/challenge/VoiceCat';

test('the call cat starts on its idle loop, from the original opaque frames', () => {
  const html = renderToStaticMarkup(createElement(VoiceCat, { handle: null, active: false }));
  expect(html).toContain('src="/sprites/purple/idle/idle_01.png"');
  expect(html).not.toContain('/sprites/cutout/');
});
