import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Landing from '../app/landing/Landing';

describe('landing sprite containment', () => {
  it('keeps one 3D display with reserved space in each section and a dashboard entry', () => {
    const html = renderToStaticMarkup(createElement(Landing));
    expect(html.match(/class="nova-scene"/g)).toHaveLength(1);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('OPEN DASHBOARD');
    expect(html).toContain('id="intro"');
    for (const slot of ['0', '1', '2']) expect(html).toContain(`data-scene-slot="${slot}"`);
    expect(html).not.toContain('nova-section-sprite');
  });
  it('shows the original three companion columns', () => {
    const html = renderToStaticMarkup(createElement(Landing));
    expect(html.match(/<article>/g)).toHaveLength(3);
    expect(html).toContain('Planner · Prepare your day');
    expect(html).toContain('Detector · Examine the evidence');
    expect(html).toContain('Debrief · Learn your next move');
    expect(html).not.toContain('team-preview');
    expect(html).toContain('aria-controls="nova-drawer"');
    expect(html).toContain('Previous rule');
    expect(html).toContain('Next rule');
  });
});
