import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import { dashboardView } from '../app/dashboard/view';

test('Profile is a one-field name tab, the same hello the popup already asks', () => {
  expect(dashboardView('Profile')).toBe('Profile');
  expect(dashboardView('nope')).toBe('Home');
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Profile' }));
  expect(html).toContain('>Profile</button>');
  expect(html).toContain('id="profile-name"');
  expect(html).toContain('What should callers call you?');
  expect(html).toContain('Voice callers use this name.');
  expect(html).not.toContain('player-email');
  expect(html).not.toContain('Create your Player profile');
});
