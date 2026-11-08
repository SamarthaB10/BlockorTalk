import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Landing from '../app/landing/Landing';

describe('landing sprite containment', () => {
  it('keeps one robot seated in the section column, plus a dashboard entry', () => {
    const html = renderToStaticMarkup(createElement(Landing));
    expect(html.match(/class="nova-scene"/g)).toHaveLength(1);
    expect(html.match(/data-scene-slot=/g)).toHaveLength(1);
    expect(html).toContain('data-scene-slot="0"');
    expect(html).not.toContain('data-scene-slot="1"');
    expect(html).not.toContain('data-scene-slot="2"');
    expect(html).not.toContain('nova-actor');
    expect(html).toContain('src="/sprites/purple/idle/idle_01.png"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('OPEN DASHBOARD');
    expect(html).toContain('id="intro"');
    expect(html).not.toContain('nova-section-sprite');
  });
  it('shows the three agents and the one job each does', () => {
    const html = renderToStaticMarkup(createElement(Landing));
    expect(html).toContain('Meet your team.');
    expect(html.match(/<article>/g)).toHaveLength(3);
    expect(html).toContain('/sprites/red/idle/idle_01.png');
    expect(html).toContain('/sprites/green/idle/idle_01.png');
    expect(html).toContain('>Planner</h3>');
    expect(html).toContain('Sets the callers and tasks for the day.');
    expect(html).toContain('>Detector</h3>');
    expect(html).toContain('Checks the call for scam signals.');
    expect(html).toContain('>Debrief</h3>');
    expect(html).toContain('Explains the result and the next move.');
    expect(html).not.toContain('One agent. Three moments.');
    expect(html).not.toContain('team-preview');
    expect(html).toContain('aria-controls="nova-drawer"');
    expect(html).toContain('Previous rule');
    expect(html).toContain('Next rule');
  });
});
