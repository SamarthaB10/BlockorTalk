import PlayerSignup from '../components/PlayerSignup';
import { safeReturnPath } from '../../lib/players/returnTo';
import '../landing.css';

export const metadata = { title: 'Player profile · Block or Talk' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { returnTo } = await searchParams;
  return <main className="landing">
    <header className="landing-head"><a href="/dashboard">Back to dashboard</a></header>
    <h1>Player profile</h1>
    <PlayerSignup returnTo={safeReturnPath(returnTo)} />
    <p><a href="/me">View your analysis</a></p>
  </main>;
}
