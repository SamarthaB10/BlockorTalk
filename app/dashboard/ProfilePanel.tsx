'use client';

import { useEffect, useState } from 'react';
import PlayerSignup from '../components/PlayerSignup';

type Section = { id: string; title: string; sentence: string; facts: string[]; link?: { href: string; label: string } };
type Analysis = { state: 'locked'; message: string } | { state: 'ready'; sections: Section[] };

/** Sign-in, sign-up and the Player analysis, inside the dashboard. */
export default function ProfilePanel({ returnTo }: { returnTo?: string | null }) {
  const [revision, setRevision] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | 'signin' | 'down' | 'loading'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    setAnalysis('loading');
    fetch('/api/me', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (response.status === 401) return setAnalysis('signin');
      if (!response.ok) return setAnalysis('down');
      setAnalysis(await response.json() as Analysis);
    }).catch(() => { if (!controller.signal.aborted) setAnalysis('down'); });
    return () => controller.abort();
  }, [revision]);

  return <div className="hub-profile">
    <section className="hub-card hub-profile-card hub-profile-identity">
      <PlayerSignup profile returnTo={returnTo} onSession={() => setRevision(value => value + 1)} />
    </section>
    <section className="hub-card hub-profile-card" id="profile-analysis" aria-labelledby="profile-analysis-title">
      <h2 id="profile-analysis-title">Your analysis</h2>
      {analysis === 'loading' && <p role="status">Loading your analysis…</p>}
      {analysis === 'signin' && <p>Sign in to see your analysis.</p>}
      {analysis === 'down' && <p>Your analysis is not available right now. Please try again soon.</p>}
      {typeof analysis === 'object' && analysis.state === 'locked' && <p role="status">{analysis.message}</p>}
      {typeof analysis === 'object' && analysis.state === 'ready' && analysis.sections.map(section => (
        <section key={section.id} className="hub-analysis" aria-labelledby={`profile-${section.id}`}>
          <h3 id={`profile-${section.id}`}>{section.title}</h3>
          <p>{section.sentence}</p>
          {section.facts.length > 0 && <ul>{section.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
          {section.link && <a className="hub-link" href={section.link.href}>Try {section.link.label}</a>}
        </section>
      ))}
    </section>
  </div>;
}
