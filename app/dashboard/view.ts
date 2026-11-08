import { safeReturnPath } from '../../lib/players/returnTo';

export type DashboardView = 'Home' | 'Leaderboard' | 'Scenarios' | 'News' | 'Progress' | 'Profile';

const VIEWS: readonly DashboardView[] = ['Home', 'Leaderboard', 'Scenarios', 'News', 'Progress', 'Profile'];

export function dashboardView(value: string | undefined): DashboardView {
  return VIEWS.includes(value as DashboardView) ? value as DashboardView : 'Home';
}

/** Sign-in lives on the dashboard. A same-site Play path rides along so the call resumes after. */
export function profileLocation(returnTo?: unknown): string {
  const params = new URLSearchParams({ view: 'Profile' });
  const next = safeReturnPath(returnTo);
  if (next) params.set('returnTo', next);
  return `/dashboard?${params.toString()}`;
}

const INTRO: Record<DashboardView, { kicker: string; title: string; summary: string }> = {
  Home: { kicker: '', title: "Don't lose your future, Practice now", summary: '' },
  Leaderboard: { kicker: 'Your practice space', title: 'Good judgment adds up.', summary: 'Practice spotting scam calls. Earn Blokbuks with each Scored call.' },
  Scenarios: { kicker: 'Your practice space', title: 'One call. Your judgment.', summary: 'Practice individual calls by voice. No money or tasks to manage.' },
  News: { kicker: 'Your practice space', title: 'Stay one step ahead.', summary: 'Consumer alerts from the Federal Trade Commission.' },
  Progress: { kicker: 'Your progress', title: 'Protective habits, with evidence.', summary: 'Each skill is updated from your own decisions on calls, with the moment that showed it.' },
  Profile: { kicker: 'Saved on this device', title: 'Your Player profile.', summary: 'Sign in to save your calls, keep your Skill Log, and show up on the Leaderboard.' },
};

export function dashboardIntro(view: DashboardView) {
  return INTRO[view];
}
