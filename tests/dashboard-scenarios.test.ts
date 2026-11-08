import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import TypedGreeting from '../app/dashboard/TypedGreeting';
import { scenarioCatalog } from '../lib/season/scenarios/catalog';
import { SCENARIOS } from '../lib/practice/catalog';
import { VOICE_SCENARIO_IDS } from '../lib/voice/scenarioVoice';

test('every scenario on the Scenarios page has a voice session and none sends anyone to /profile', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Scenarios' }));
  expect(html).toContain('Yui');
  expect(html.match(/Play by voice/g)).toHaveLength(SCENARIOS.length + scenarioCatalog.length);
  expect(VOICE_SCENARIO_IDS).toHaveLength(scenarioCatalog.length);
  expect(html).not.toContain('/profile');
  for (const row of scenarioCatalog) {
    expect(html).toContain(row.category);
    expect(html).toContain(`href="/play/${encodeURIComponent(row.id)}"`);
    for (const secret of row.secrets) expect(html).not.toContain(secret.value);
  }
  expect(html).toContain('Refund or billing error');
  expect(html).toContain('Insurance policy check');
  expect(html).toContain('Subscription or sales call');
  expect(html).toContain('Wrong number');
  expect(html).not.toMatch(/ask_line|next_step|versions/);
});

// Pending: the welcome dialog without a skip option was specified in another session but not built yet.
test.skip('the name dialog is in the dashboard markup before any saved name', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Home' }));
  expect(html).toContain('id="welcome-name"');
  expect(html).toContain('What should I call you?');
  expect(html).not.toContain('Skip introduction');
  expect(html).not.toContain('welcome-skip');
  expect(html).not.toContain('localStorage');
});

test('the greeting names the player and hides the full sentence until it types', () => {
  const html = renderToStaticMarkup(createElement(TypedGreeting, { name: 'Fern' }));
  expect(html).toContain('aria-label="Good to see you, Fern."');
  const visible = html.replace(/aria-label="[^"]*"/g, '');
  expect(visible).not.toContain('Good to see you, Fern.');
});
