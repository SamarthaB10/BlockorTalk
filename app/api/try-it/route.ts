import { createTryItHandlers } from '../../../lib/try-it/routes';
import { tryItStore } from '../../../lib/try-it/store';
import { createNemotronReply } from '../../../lib/challenge/nemotron';

import { voiceRoutes } from '../../../lib/voice/server';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const cap = Number(process.env.TRY_IT_DAILY_CAP ?? 1000);
  if (!process.env.DATABASE_URL || !Number.isInteger(cap) || cap < 1) return Response.json({ error: 'Practice is not ready yet. Please come back soon.' }, { status: 503 });
  return createTryItHandlers({ secret: process.env.TRY_IT_SECRET ?? '', reply: createNemotronReply(), voiceToken: callerId => process.env.TRY_IT_BROWSER_VOICE === 'true' ? voiceRoutes().session(new Request(request.url, { method: 'POST', body: JSON.stringify({ callerId }) })) : Promise.resolve(Response.json({ error: 'Browser voice is not ready yet. Please use text.' }, { status: 503 })), ...tryItStore(process.env.DATABASE_URL, cap) }).POST(request);
}
