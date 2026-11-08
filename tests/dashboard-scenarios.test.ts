import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import Welcome from '../app/dashboard/Welcome';
import { scenarioCatalog } from '../lib/season/scenarios/catalog';

test('every scenario is a voice call: no text practice and no link to the old /play call', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Scenarios' }));
  expect(html).toContain('Yui');
  expect(html).toContain('Play by voice');
  expect(html).not.toContain('Practice in text');
  expect(html).not.toContain('href="/play');
  for (const row of scenarioCatalog) {
    expect(html).toContain(row.category);
    for (const secret of row.secrets) expect(html).not.toContain(secret.value);
  }
  expect(html.match(/Voice coming soon/g)).toHaveLength(scenarioCatalog.length);
  expect(html).not.toMatch(/ask_line|next_step|versions/);
});

test('the name popup has no way to skip it', () => {
  const html = renderToStaticMarkup(createElement(Welcome, { onName: () => {} }));
  expect(html).toContain('What should I call you?');
  expect(html).toContain('id="welcome-name"');
  expect(html).not.toMatch(/Skip introduction|stay mysterious/);
});
