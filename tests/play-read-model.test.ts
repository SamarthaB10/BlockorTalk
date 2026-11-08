import { expect, test } from 'vitest';
import { createPlayRoute } from '../lib/season/play/routes';
test('signed-out visitors cannot read the Play catalog', async () => {
  const route = createPlayRoute({ currentPlayer: async () => null, read: async () => { throw new Error('must not read'); } });
  expect((await route(new Request('https://tell.test/api/play'))).status).toBe(401);
});
import { createPlayReadModel } from '../lib/season/play/read-model';
test('the sixth call is practice and catalog exposes only Category and fictional org', async () => {
  const read = createPlayReadModel({ now: () => new Date('2026-11-08T18:00:00Z'), currentSeason: async () => ({ id: 's', name: 'Season 1', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-10T00:00:00Z' }), catalog: async () => [{ id: 'bank', category: 'Bank fraud alert', org: 'Corvanta Bank', version: 'scam', secrets: ['hidden'] }], score: async () => 250, scoredStarts: async () => Array(5).fill('2026-11-08T17:00:00Z') });
  const model = await read('player');
  expect(model).toMatchObject({ blokbuks: 250, scoredCallsLeft: 0, nextCallScored: false });
  expect(model.scenarios).toEqual([{ id: 'bank', category: 'Bank fraud alert', org: 'Corvanta Bank' }]);
});
test('unavailable Season dependencies return retryable 503 rather than invented totals', async()=>{
 const route=createPlayRoute({currentPlayer:async()=>({id:'p'}),read:async()=>{throw new Error('missing season_scores');}});
 const response=await route(new Request('https://tell.test/api/play'));expect(response.status).toBe(503);expect(await response.text()).not.toContain('blokbuks');
});
