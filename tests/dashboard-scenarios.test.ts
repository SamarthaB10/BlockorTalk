import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import Welcome from '../app/dashboard/Welcome';
import NewsAlerts from '../app/dashboard/NewsAlerts';
import { scenarioCatalog } from '../lib/season/scenarios/catalog';
import { SCENARIO_CALLERS } from '../lib/voice/scenarioVoice';
import { SCENARIOS } from '../lib/practice/catalog';
import { SCENARIO_TOPICS, TOPICS } from '../app/dashboard/topics';

test('every scenario has a voice session: no text practice, no /play link, no /profile', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Scenarios' }));
  expect(html).toContain('<strong>Yui</strong>');
  expect(html).not.toContain('Practice in text');
  expect(html).not.toContain('href="/play');
  for (const row of scenarioCatalog) {
    expect(html).toContain(`<strong>${SCENARIO_CALLERS[row.id]}</strong>`);
    expect(html).toContain(row.category);
    for (const secret of row.secrets) expect(html).not.toContain(secret.value);
  }
  expect(html.match(/data-contact="true"/g)).toHaveLength(SCENARIOS.length + scenarioCatalog.length);
  expect(html).not.toContain('Voice coming soon');
  expect(html).toContain('id="test-phone"');
  expect(html).not.toContain('/profile');
  expect(html).not.toMatch(/ask_line|next_step|versions/);
});

test('topic filters cover every scenario and never split a real caller from a scam one', () => {
  const ids = [...SCENARIOS.map(s => s.id), ...scenarioCatalog.map(s => s.id)];
  for (const id of ids) expect(TOPICS).toContain(SCENARIO_TOPICS[id]);
  expect(SCENARIO_TOPICS.recruiter).toBe(SCENARIO_TOPICS.onboarding);
  expect(SCENARIO_TOPICS.fraud_team).toBe(SCENARIO_TOPICS.bank_callback);

  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'Scenarios' }));
  expect(html).toContain('aria-label="Filter scenarios by topic"');
  expect(html).toMatch(/aria-pressed="true"[^>]*>All <span>18<\/span>/);
  for (const topic of TOPICS) {
    const count = ids.filter(id => SCENARIO_TOPICS[id] === topic).length;
    expect(html).toContain(`>${topic.replace('&', '&amp;')} <span>${count}</span>`);
  }
  expect(html).toContain('Shuffle call');
  expect(html).toContain('Showing all 18 calls');
});

test('each news alert has Practice this call, and the Drill Planner pick shows its category, reason and path', () => {
  const alerts = [
    { title: 'Got a call about a package held at customs?', link: 'https://consumer.ftc.gov/consumer-alerts/a', summary: 'A delivery fee demand.' },
    { title: 'Calls about your tax refund', link: 'https://consumer.ftc.gov/consumer-alerts/b', summary: 'A refund pitch.' },
  ];
  const pick = { link: alerts[0]!.link, id: 'delivery', category: 'Delivery or customs fee', reason: 'A parcel fee with a deadline. Practise slowing down.', path: 'fixed' as const };
  const html = renderToStaticMarkup(createElement(NewsAlerts, { alerts, status: '', planning: null, note: { link: pick.link, pick }, onPractice: () => {} }));
  expect(html.match(/>Practice this call ↗<\/button>/g)).toHaveLength(alerts.length);
  expect(html).toContain('Delivery or customs fee');
  expect(html).toContain(pick.reason);
  expect(html).toMatch(/fixed plan/i);
  expect(html.match(/href="https:\/\/consumer\.ftc\.gov\/consumer-alerts\/[ab]"/g)).toHaveLength(alerts.length);
  for (const row of scenarioCatalog) for (const secret of row.secrets) expect(html).not.toContain(secret.value);
  expect(html).not.toMatch(/ask_line|next_step|versions|\b(scam|real|legit\w*|hijack\w*)\b/i);

  const planning = renderToStaticMarkup(createElement(NewsAlerts, { alerts, status: '', planning: alerts[1]!.link, note: { link: alerts[1]!.link, error: 'The Drill Planner is unavailable.' }, onPractice: () => {} }));
  expect(planning.match(/disabled=""[^>]*>Practice this call/g)).toHaveLength(alerts.length);
  expect(planning).toContain('role="alert"');
});

test('the News view renders the alert list', () => {
  const html = renderToStaticMarkup(createElement(Dashboard, { initialView: 'News' }));
  expect(html).toContain('Loading consumer alerts');
});

test('the name popup has no way to skip it', () => {
  const html = renderToStaticMarkup(createElement(Welcome, { onName: () => {} }));
  expect(html).toContain('What should I call you?');
  expect(html).toContain('id="welcome-name"');
  expect(html).not.toMatch(/Skip introduction|stay mysterious/);
});
