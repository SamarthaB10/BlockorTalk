'use client';

import Blokbuks from '../components/Blokbuks';
import { DotFigure } from '../components/ui';
import './standings.css';

export type Rank = { rank: number; nickname: string; blokbuks: number };

export type StandingsModel = {
  name: string;
  heading: string;
  final: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  endsAtLabel: string;
  prizes: { place: number; prize: string }[];
  rows: Rank[];
  ownRank: Rank | null;
  claimEligible: boolean;
};

const PLACE = ['', 'First', 'Second', 'Third'];

function placeName(place: number) {
  return PLACE[place] ?? `Place ${place}`;
}

function youLabel(rank: Rank, ownRank: Rank | null) {
  return ownRank?.rank === rank.rank;
}

export default function StandingsBoard({
  embedded = false,
  loading = false,
  error = '',
  onRetry,
  model = null,
}: {
  embedded?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  model?: StandingsModel | null;
}) {
  const Root = embedded ? 'section' : 'main';
  const top = model?.rows.slice(0, 3) ?? [];
  const rest = model?.rows.slice(3) ?? [];
  const clock = model && !model.final
    ? `${model.hours} hours, ${model.minutes} minutes, ${model.seconds} seconds`
    : '';

  return <Root className="standings" aria-labelledby={embedded ? 'standings-heading' : 'standings-title'}>
    <p className="standings-kicker">National Leaderboard{model ? ` · ${model.name}` : ''}</p>
    {!embedded && <>
      <h1 id="standings-title">Good judgment adds up.</h1>
      <p className="standings-lede">Practice spotting scam calls. Earn Blokbuks with each Scored call.</p>
    </>}
    <h2 id="standings-heading">{model?.heading ?? 'Leaderboard'}</h2>
    {model && !model.final && <p className="standings-clock" role="timer" aria-label={`Time until Season ends, ${clock}`}>
      <span className="standings-digits" aria-hidden="true"><DotFigure>{String(model.hours).padStart(2, '0')}</DotFigure><span className="standings-colon">:</span><DotFigure>{String(model.minutes).padStart(2, '0')}</DotFigure><span className="standings-colon">:</span><DotFigure>{String(model.seconds).padStart(2, '0')}</DotFigure></span>
      <span className="standings-clock-caption" aria-hidden="true">hours · minutes · seconds</span>
    </p>}
    {model && <p className="standings-ends">{model.endsAtLabel}</p>}
    {model && model.prizes.length > 0 && <p className="standings-prizes">{model.prizes.map(prize => `${placeName(prize.place)}: ${prize.prize}`).join(' · ')} · provided by sponsor · rules apply</p>}
    {error && <p role="alert" className="standings-alert">{error} <button type="button" className="standings-retry" onClick={onRetry}>Try again</button></p>}
    {loading && <p role="status">Loading the Leaderboard…</p>}
    {model?.ownRank && <p className="standings-own"><span>Your place</span><strong>{model.ownRank.rank}</strong><span>{model.ownRank.nickname}</span><Blokbuks amount={model.ownRank.blokbuks} /></p>}
    {model?.claimEligible && <p className="standings-actions"><a className="standings-claim" href="/leaderboard/claim">Claim your prize</a></p>}
    {model && (model.rows.length === 0
      ? <p>No Players yet. Be the first to join.</p>
      : <>
        <ol className="standings-podium" data-count={top.length} aria-label="Top places">
          {top.map(rank => <li key={rank.rank} className={youLabel(rank, model.ownRank) ? 'standings-place is-you' : 'standings-place'} data-place={rank.rank} aria-current={youLabel(rank, model.ownRank) || undefined}>
            <span className="standings-place-label">{placeName(rank.rank)}{youLabel(rank, model.ownRank) ? ' · You' : ''}</span>
            <DotFigure>{rank.rank}</DotFigure>
            <span className="standings-name">{rank.nickname}</span>
            <Blokbuks amount={rank.blokbuks} />
          </li>)}
        </ol>
        <h3 className="standings-list-title">Top 100 Players</h3>
        <p className="standings-order">Order: Blokbuks, then accuracy, then who reached the score first.</p>
        {rest.length > 0 && <table>
          <caption className="ui-sr-only">Places after the top three</caption>
          <thead><tr><th scope="col">Rank</th><th scope="col">Nickname</th><th scope="col">Blokbuks</th></tr></thead>
          <tbody>{rest.map(rank => <tr key={rank.rank} className={youLabel(rank, model.ownRank) ? 'is-you' : undefined}>
            <td>{rank.rank}</td>
            <th scope="row">{rank.nickname}{youLabel(rank, model.ownRank) && <span className="standings-you">You</span>}</th>
            <td><Blokbuks amount={rank.blokbuks} /></td>
          </tr>)}</tbody>
        </table>}
      </>)}
  </Root>;
}
