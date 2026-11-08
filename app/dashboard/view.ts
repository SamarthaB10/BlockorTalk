export type DashboardView = 'Home' | 'Scenarios' | 'Battlecards' | 'News';

export function dashboardView(value: string | undefined): DashboardView {
  return value === 'Scenarios' || value === 'Battlecards' || value === 'News' ? value : 'Home';
}
