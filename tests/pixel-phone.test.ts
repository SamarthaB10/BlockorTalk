import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import PixelPhone from '../app/components/PixelPhone';
import { PlayCatalog } from '../app/play/PlayCatalog';
import { SCENARIOS } from '../lib/practice/catalog';
import { scenarioCatalog } from '../lib/season/scenarios/catalog';

test('the pixel phone is one crisp, labelled drawing, the same for every caller', () => {
  const html = renderToStaticMarkup(createElement(PixelPhone));
  expect(html).toContain('shape-rendering="crispEdges"');
  expect(html).toContain('aria-label="Incoming call"');
  expect(renderToStaticMarkup(createElement(PixelPhone))).toBe(html);
});

test('every scenario card on the dashboard shows a pixel phone instead of a mascot', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Scenarios' }));
  expect(html.match(/class="pixel-phone"/g)).toHaveLength(SCENARIOS.length + scenarioCatalog.length);
  expect(html).not.toContain('hub-scenario-mascot');
});

test('the Play catalog shows a pixel phone on every call', () => {
  const html = renderToStaticMarkup(createElement(PlayCatalog, { model: { scenarios: scenarioCatalog.slice(0, 3).map(({ id, category, org }) => ({ id, category, org })), blokbuks: 0, scoredCallsLeft: 5, nextCallScored: true, season: null, serverNow: '2026-11-08T18:00:00Z' } }));
  expect(html.match(/class="pixel-phone"/g)).toHaveLength(3);
});
