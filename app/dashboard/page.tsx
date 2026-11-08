import Dashboard from './Dashboard';
import { dashboardView } from './view';
import { isSkillId } from '../../lib/skills/catalog';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string; returnTo?: string; skill?: string }> }) {
  const { view, returnTo, skill } = await searchParams;
  return <Dashboard initialView={dashboardView(view)} returnTo={returnTo ?? null} skill={isSkillId(skill) ? skill : null} />;
}
