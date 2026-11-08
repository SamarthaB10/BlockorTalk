import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Dashboard from '../app/dashboard/Dashboard';
import { seasonHeading } from '../app/leaderboard/Leaderboard';
import StandingsBoard, { type StandingsModel } from '../app/leaderboard/StandingsBoard';

const rows = [
  { rank: 1, nickname: 'Ada', blokbuks: 900 },
  { rank: 2, nickname: 'Bea', blokbuks: 700 },
  { rank: 3, nickname: 'Cid', blokbuks: 500 },
  { rank: 4, nickname: 'Dee', blokbuks: 200 },
];

function model(overrides: Partial<StandingsModel> = {}): StandingsModel {
  return {
    name: 'Season 1',
    heading: 'Season ends in',
    final: false,
    hours: 55,
    minutes: 3,
    seconds: 9,
    endsAtLabel: 'Ends November 8, 2026, 6:00:00 PM CT',
    prizes: [{ place: 1, prize: 'A fictional trophy' }, { place: 2, prize: 'A fictional mug' }],
    rows,
    ownRank: rows[3],
    claimEligible: false,
    ...overrides,
  };
}

function html(props: Parameters<typeof StandingsBoard>[0]) {
  return renderToStaticMarkup(createElement(StandingsBoard, props));
}

describe('season standings', () => {
  it('steps the top three in rank order and marks your place in the list', () => {
    const markup = html({ model: model() });
    expect(markup.indexOf('First')).toBeLessThan(markup.indexOf('Second'));
    expect(markup.indexOf('Second')).toBeLessThan(markup.indexOf('Third'));
    expect(markup).toContain('data-place="1"');
    expect(markup).toContain('Ada');
    expect(markup).toContain('Your place');
    expect(markup).toContain('class="is-you"');
    expect(markup).toContain('>You<');
    expect(markup).toContain('Top 100 Players');
    expect(markup).toContain('Order: Blokbuks, then accuracy, then who reached the score first.');
    expect(markup).toContain('First: A fictional trophy');
    expect(markup).toContain('provided by sponsor · rules apply');
    expect(markup).toContain('role="timer"');
    expect(markup).toContain('55 hours, 3 minutes, 9 seconds');
    expect(markup).not.toContain('🥇');
  });

  it('offers a claim when the season result says this player can claim', () => {
    const markup = html({ model: model({ claimEligible: true, ownRank: rows[0] }) });
    expect(markup).toContain('href="/leaderboard/claim"');
    expect(markup).toContain('First · You');
  });

  it('keeps the empty, loading, error, and final states readable', () => {
    expect(html({ model: model({ rows: [], ownRank: null, prizes: [] }) })).toContain('No Players yet. Be the first to join.');
    expect(html({ loading: true })).toContain('Loading the Leaderboard…');
    expect(html({ error: 'The Leaderboard is unavailable.', onRetry: () => {} })).toContain('Try again');
    const finalBoard = html({ model: model({ final: true, heading: 'Final Leaderboard', endsAtLabel: 'The Season has ended. Scores are final.' }) });
    expect(finalBoard).toContain('Final Leaderboard');
    expect(finalBoard).toContain('The Season has ended. Scores are final.');
    expect(finalBoard).not.toContain('role="timer"');
  });

  it('embeds as a section so the dashboard can keep its own page title', () => {
    const markup = html({ embedded: true, model: model() });
    expect(markup.startsWith('<section')).toBe(true);
    expect(markup).not.toContain('Good judgment adds up.');
    expect(markup).toContain('Season ends in');
  });

  it('names the season state the same way the claim page does', () => {
    const board = { final: false, season: { status: 'live' } } as Parameters<typeof seasonHeading>[0];
    expect(seasonHeading({ ...board, final: true }, 10)).toBe('Final Leaderboard');
    expect(seasonHeading(board, 0)).toBe('Waiting for final results');
    expect(seasonHeading({ ...board, season: { status: 'upcoming' } } as Parameters<typeof seasonHeading>[0], 10)).toBe('Season starts soon');
    expect(seasonHeading(board, 10)).toBe('Season ends in');
  });

  it('puts the Leaderboard on the dashboard as a tab, and leaves it closed on Home', () => {
    const markup = renderToStaticMarkup(createElement(Dashboard));
    expect(markup).toContain('>Leaderboard<');
    expect(markup).toContain('A little practice. Better instincts.');
    expect(markup).not.toContain('class="standings"');
  });
});
