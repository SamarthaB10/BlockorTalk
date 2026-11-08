import { redirect } from 'next/navigation';
import { profileLocation } from '../dashboard/view';

/** The Player profile lives on the dashboard. Old links land there. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { returnTo } = await searchParams;
  redirect(profileLocation(returnTo));
}
