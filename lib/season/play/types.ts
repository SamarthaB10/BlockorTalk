export type PlaySeason = { id: string; name: string; startsAt: string; endsAt: string; status: 'upcoming' | 'live' | 'ended' };
export type PlayModel = { scenarios: { id: string; category: string; org: string }[]; blokbuks: number; scoredCallsLeft: number; nextCallScored: boolean; season: PlaySeason | null; serverNow: string };
