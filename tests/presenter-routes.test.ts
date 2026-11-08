import { describe, expect, it, vi } from 'vitest';
import { createPresenterHandlers } from '../lib/challenge/presenter';
import type { PresenterSnapshot } from '../lib/challenge/presenter-types';

const id = '11111111-1111-4111-8111-111111111111';
const token = 'a'.repeat(64);
const snapshot: PresenterSnapshot = { callerName: 'Ren', organization: 'Bluebonnet Labs onboarding', phase: 'call', risk: 91,
  tactics: ['urgency'], scoredTurn: 4, currentTurn: 4, status: 'ready', firstCorrectTurn: 4, firstCorrectSeconds: 5, series: [] };
function fixture() {
  const read = vi.fn(async (_id: string, proof: string) => proof === token ? snapshot : null);
  const scheduleRisk = vi.fn();
  const handlers = createPresenterHandlers({
    service: () => ({ get: async () => ({ id, risk: { token, calls: [] } }) }),
    risk: () => ({ read }), scheduleRisk,
  });
  return { ...handlers, read, scheduleRisk };
}
describe('presenter routes', () => {
  it('requires a separate capability even when the browser has the player cookie', async () => {
    const h = fixture();
    const response = await h.GET(new Request('https://tell.test/api/presenter', { headers: { cookie: `tell_challenge=${id}` } }));
    expect(response.status).toBe(401);
    expect(h.read).not.toHaveBeenCalled();
    expect(h.scheduleRisk).not.toHaveBeenCalled();
  });
  it('serves only the authorized projection and resumes background scoring', async () => {
    const h = fixture();
    const response = await h.GET(new Request('https://tell.test/api/presenter', { headers: { authorization: `Bearer ${id}.${token}` } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ snapshot });
    expect(h.scheduleRisk).toHaveBeenCalledWith(id);
  });
  it('rejects a wrong capability without launching detection', async () => {
    const h = fixture();
    const response = await h.GET(new Request('https://tell.test/api/presenter', { headers: { authorization: `Bearer ${id}.${'b'.repeat(64)}` } }));
    expect(response.status).toBe(401);
    expect(h.scheduleRisk).not.toHaveBeenCalled();
  });
  it('creates a share link only for a same-origin request with a player session', async () => {
    const h = fixture();
    expect((await h.POST(new Request('https://tell.test/api/presenter', { method: 'POST', headers: { origin: 'https://elsewhere.test', cookie: `tell_challenge=${id}` } }))).status).toBe(403);
    expect((await h.POST(new Request('https://tell.test/api/presenter', { method: 'POST', headers: { origin: 'https://tell.test' } }))).status).toBe(401);
    const response = await h.POST(new Request('https://tell.test/api/presenter', { method: 'POST', headers: { origin: 'https://tell.test', cookie: `tell_challenge=${id}` } }));
    expect(await response.json()).toEqual({ path: `/presenter#${id}.${token}` });
  });
});
