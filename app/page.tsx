import { getHealth } from '../lib/health.mjs';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const health = await getHealth();
  return <main>
    <h1>Tell health</h1>
    <ul>
      <li>Database reachable: {health.database ? 'Yes' : 'No'}</li>
      <li>NVIDIA key present: {health.nvidia ? 'Yes' : 'No'}</li>
      <li>ElevenLabs key present: {health.elevenlabs ? 'Yes' : 'No'}</li>
    </ul>
  </main>;
}
