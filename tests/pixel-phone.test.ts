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

test('the Scenarios view is one retro phone whose address book lists every caller, with no mascots', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Scenarios' }));
  expect(html).toContain('class="retro-phone"');
  expect(html.match(/data-contact="true"/g)).toHaveLength(SCENARIOS.length + scenarioCatalog.length);
  expect(html).not.toContain('hub-scenario-mascot');
});

test('the Play catalog shows a pixel phone on every call', () => {
  const html = renderToStaticMarkup(createElement(PlayCatalog, { model: { scenarios: scenarioCatalog.slice(0, 3).map(({ id, category, org }) => ({ id, category, org })), blokbuks: 0, scoredCallsLeft: 5, nextCallScored: true, season: null, serverNow: '2026-11-08T18:00:00Z' } }));
  expect(html.match(/class="pixel-phone"/g)).toHaveLength(3);
});
