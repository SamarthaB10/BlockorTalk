import pg from 'pg';

export async function getHealth(env = process.env) {
  let database = false;
  if (env.DATABASE_URL) {
    const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      database = true;
    } catch {
      database = false;
    } finally {
      await client.end().catch(() => {});
    }
  }
  return {
    database,
    nvidia: Boolean(env.NVIDIA_API_KEY),
    elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
  };
}
