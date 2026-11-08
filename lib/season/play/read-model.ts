import { scoredCallsLeftToday } from '../../blokbuks/rules';
import type { PlayModel } from './types';
export type SeasonRow = { id: string; name: string; startsAt: string; endsAt: string };
export function createPlayReadModel(deps: {
  now: () => Date; currentSeason: () => Promise<SeasonRow | null>;
  catalog: () => Promise<{ id: string; category: string; org: string }[]>;
  score: (playerId: string, seasonId: string) => Promise<number>;
  scoredStarts: (playerId: string) => Promise<string[]>;
}) {
  return async (playerId: string): Promise<PlayModel> => {
    const now = deps.now(); const season = await deps.currentSeason();
    const [catalog, blokbuks, starts] = await Promise.all([deps.catalog(), season ? deps.score(playerId, season.id) : Promise.resolve(0), deps.scoredStarts(playerId)]);
    const scoredCallsLeft = scoredCallsLeftToday(starts, now);
    const status = season ? now < new Date(season.startsAt) ? 'upcoming' : now >= new Date(season.endsAt) ? 'ended' : 'live' : null;
    return { scenarios: catalog.map(({ id, category, org }) => ({ id, category, org })), blokbuks, scoredCallsLeft, nextCallScored: status === 'live' && scoredCallsLeft > 0, season: season && { ...season, status: status! }, serverNow: now.toISOString() };
  };
}
