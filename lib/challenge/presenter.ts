import type { Challenge } from './types.ts';
import type { createRiskService } from './risk.ts';
import { json, session } from './routes.ts';

type Deps = {
  service: () => { get(id: string): Promise<Pick<Challenge, 'id' | 'risk'>> };
  risk: () => Pick<ReturnType<typeof createRiskService>, 'read'>;
  scheduleRisk: (id: string) => void;
};
export function createPresenterHandlers(deps: Deps) {
  return {
    async POST(request: Request) {
      if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Open the presenter page to connect a day.' }, 403);
      const id = session(request);
      if (!id) return json({ error: 'Start a Challenge day in this browser first.' }, 401);
      try {
        const day = await deps.service().get(id);
        if (!day.risk) return json({ error: 'This day is not ready to present.' }, 409);
        return json({ path: `/presenter#${id}.${day.risk.token}` });
      } catch { return json({ error: 'The presenter could not connect. Try again.' }, 503); }
    },
    async GET(request: Request) {
      const proof = request.headers.get('authorization')?.match(/^Bearer ([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.([0-9a-f]{64})$/i);
      if (!proof) return json({ error: 'Use a presenter share link.' }, 401);
      try {
        const snapshot = await deps.risk().read(proof[1], proof[2]);
        if (!snapshot) return json({ error: 'This presenter link is invalid.' }, 401);
        deps.scheduleRisk(proof[1]);
        return json({ snapshot });
      } catch { return json({ error: 'The presenter could not refresh. Trying again.' }, 503); }
    },
  };
}
