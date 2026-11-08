'use client';

import { useEffect, useRef, useState } from 'react';
import { startBrowserCall, type BrowserCallHandle } from '../../lib/voice/browserCall';
import Conversation from '../challenge/Conversation';
import { SCENARIOS, type ScenarioId } from '../../lib/practice/catalog';
import { scenarioCatalog } from '../../lib/season/scenarios/catalog';
import { SCENARIO_VARIABLE_NAMES, scenarioVoiceVariables } from '../../lib/voice/scenarioVoice';
import SpritePlayer from '../components/SpritePlayer';
import './dashboard.css';
import Welcome from './Welcome';
import PracticeCard from './PracticeCard';
import TypedGreeting from './TypedGreeting';
import Leaderboard from '../leaderboard/Leaderboard';
import ScenarioMascot from './ScenarioMascot';
import { dashboardIntro, dashboardView, type DashboardView } from './view';
import ProgressPanel from './ProgressPanel';
import ProfilePanel from './ProfilePanel';
import { isSkillId, type SkillId } from '../../lib/skills/catalog';

type View = DashboardView;
type Turn = { role: 'caller' | 'you'; text: string };
type Alert = { title: string; link: string; summary: string; date?: string };

export default function Dashboard({ initialView = 'Home', returnTo = null, skill = null }: { initialView?: View; returnTo?: string | null; skill?: SkillId | null }) {
  const [skillParam, setSkillParam] = useState<SkillId | null>(skill);
  const [playerName, setPlayerName] = useState('');
  const [view, setView] = useState<View>(initialView);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(location.search);
      setView(dashboardView(params.get('view') ?? undefined));
      const selected = params.get('skill');
      setSkillParam(isSkillId(selected) ? selected : null);
      stopVoice(); setScenario(null); setShowCode(false);
    };
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [newsState, setNewsState] = useState('Loading consumer alerts…');
  const [scenario, setScenario] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [voiceHandle, setVoiceHandle] = useState<BrowserCallHandle | null>(null);
  const voiceRef = useRef<BrowserCallHandle | null>(null);
  const connection = useRef(0);
  const [connecting, setConnecting] = useState(false);
  function stopVoice() { connection.current += 1; void voiceRef.current?.end(); voiceRef.current = null; setVoiceHandle(null); setConnecting(false); }
  useEffect(() => () => { connection.current += 1; void voiceRef.current?.end(); }, []);
  const [ended, setEnded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ explanation: string; safest: string } | null>(null);
  useEffect(() => {
    fetch('/api/news').then(async response => {
      if (!response.ok) throw new Error();
      const value = await response.json() as { items: Alert[] };
      setAlerts(value.items); setNewsState(value.items.length ? '' : 'No alerts available right now.');
    }).catch(() => setNewsState('Consumer alerts are unavailable right now. Read the FTC feed directly.'));
  }, []);
  async function giveVerdict(scenarioId: ScenarioId, verdict: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verdict', scenarioId, turns, verdict }) });
      const value = await response.json() as { error?: string; explanation: string; safest: string };
      if (!response.ok) throw new Error(value.error ?? 'Please try again.');
      setResult(value);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function practiceVoice(scenarioId: string) {
    const challengeCaller = SCENARIOS.find(item => item.id === scenarioId);
    const variables = challengeCaller?.voiceVariables ?? scenarioVoiceVariables(scenarioId);
    if (!variables) return;
    stopVoice();
    const attempt = connection.current;
    setShowCode(false); setScenario(scenarioId); setTurns([]); setResult(null); setEnded(false); setError(''); setConnecting(true);
    try {
      const response = await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callerId: scenarioId }) });
      const session = await response.json() as { conversationToken?: string };
      if (!response.ok || !session.conversationToken) throw new Error('Voice is unavailable right now. Try again in a moment.');
      if (attempt !== connection.current) return;
      const handle = await startBrowserCall({ callerId: scenarioId, conversationToken: session.conversationToken, variables, variableNames: challengeCaller ? undefined : SCENARIO_VARIABLE_NAMES,
        onTurn: turn => { if (attempt === connection.current) setTurns(current => [...current, { role: turn.role === 'user' ? 'you' : 'caller', text: turn.message }]); },
        onEnded: () => { if (attempt === connection.current) { setEnded(true); setVoiceHandle(null); voiceRef.current = null; setConnecting(false); } },
        onMicDenied: () => { if (attempt === connection.current) setError('Microphone access was denied. Allow your microphone, then start the call again.'); },
      });
      if (attempt !== connection.current) { void handle?.end(); return; }
      if (!handle) throw new Error('Voice did not connect. Return to scenarios to try again.');
      voiceRef.current = handle; setVoiceHandle(handle);
    } catch (failure) { if (attempt === connection.current) { setError(failure instanceof Error ? failure.message : 'Voice did not connect.'); setEnded(true); } }
    finally { if (attempt === connection.current) setConnecting(false); }
  }
  function navigate(next: View) { stopVoice(); setView(next); setScenario(null); setError(''); history.pushState(null, '', next === 'Home' ? '/dashboard' : `/dashboard?view=${next}`); }
  return <main className="hub">
    <Welcome onName={setPlayerName} />
    {playerName && <TypedGreeting name={playerName} />}
    <header className="hub-nav"><a href="/">Block or Talk<span>Practice your judgment.</span></a><nav aria-label="Dashboard">{(['Home', 'Scenarios', 'News'] as const).map(item => <button key={item} aria-current={view === item ? 'page' : undefined} onClick={() => navigate(item)}>{item}</button>)}<button aria-current={view === 'Leaderboard' ? 'page' : undefined} onClick={() => navigate('Leaderboard')}>Leaderboard</button>{(['Progress', 'Profile'] as const).map(item => <button key={item} aria-current={view === item ? 'page' : undefined} onClick={() => navigate(item)}>{item}</button>)}</nav></header>
    <section className="hub-intro"><div className="hub-mascot"><SpritePlayer personality="planner" animation="idle" /></div><div><p>{dashboardIntro(view).kicker}</p><h1>{dashboardIntro(view).title}</h1><p>{dashboardIntro(view).summary}</p></div></section>
    {error && <p role="alert">{error}</p>}
    {view === 'Home' && <section className="hub-grid" aria-label="Choose your practice">
      <article className="hub-card"><span className="hub-chip">Scenario practice</span><h2>A single call.<br />A fresh perspective.</h2><p>Meet Yui, Ren, Kai, or Aki. Make a decision and see the evidence.</p><div className="hub-people">{SCENARIOS.map((item, index) => <span key={item.id}><ScenarioMascot index={index} />{item.caller}</span>)}</div><button className="hub-link" onClick={() => navigate('Scenarios')}>Choose a scenario ↗</button></article>
      <article className="hub-card hub-news"><span className="hub-chip">FTC consumer alerts</span><h2>What’s happening now.</h2>{alerts.slice(0, 2).map(item => <a key={item.link} href={item.link} target="_blank" rel="noreferrer">{item.title} ↗</a>)}{newsState && <p role="status">{newsState}</p>}<button className="hub-link" onClick={() => navigate('News')}>Read the latest ↗</button></article>
      <article className="hub-card hub-rule"><span className="hub-chip">Take it with you</span><h2>Knowing your details doesn’t prove who’s calling.</h2><p>Hang up. Call back on a number you already have.</p><span className="hub-rule-number">One rule. Any call.</span></article>
    </section>}
    {view === 'Scenarios' && !scenario && <section className="hub-library">{SCENARIOS.map((item, index) => <article className="hub-card hub-scenario" key={item.id}><ScenarioMascot index={index} /><span className="hub-chip">{item.theme} · {item.direction}</span><h2>{item.caller}</h2><p>{item.org}</p><p>{item.card}</p><button disabled={busy || connecting} className="hub-primary" onClick={() => void practiceVoice(item.id)}>Play by voice ↗</button></article>)}{scenarioCatalog.map((item, index) => <article className="hub-card hub-scenario" key={item.id}><ScenarioMascot index={index + SCENARIOS.length} /><span className="hub-chip">{item.category}</span><h2>{item.org}</h2><p>{item.card.facts[0]}</p><button disabled={busy || connecting} className="hub-primary" onClick={() => void practiceVoice(item.id)}>Play by voice ↗</button></article>)}</section>}
    {view === 'Scenarios' && scenario && !SCENARIOS.some(item => item.id === scenario) && (() => { const row = scenarioCatalog.find(item => item.id === scenario)!; return <section className="hub-practice"><button className="hub-link" disabled={busy} onClick={() => { stopVoice(); setScenario(null); }}>← All scenarios</button><h2>{row.org} · Practice call</h2><p>{row.card.facts[0]} Use fictional details only. Your practice code is {row.secrets[0]?.value}; keep it to yourself.</p><Conversation handle={voiceHandle} active={Boolean(voiceHandle)} connecting={connecting} turns={turns.map((turn, index) => ({ key: index, who: turn.role === 'you' ? 'you' as const : 'caller' as const, label: turn.role === 'you' ? 'You' : 'AI practice caller', text: turn.text }))}>{(voiceHandle || connecting) && <button onClick={() => { stopVoice(); setEnded(true); }}>End voice call</button>}</Conversation></section>; })()}
    {view === 'Scenarios' && scenario && SCENARIOS.some(item => item.id === scenario) && <section className="hub-practice"><button className="hub-link" disabled={busy} onClick={() => { stopVoice(); setScenario(null); setShowCode(false); }}>← All scenarios</button><h2>{SCENARIOS.find(item => item.id === scenario)?.caller} · Practice call</h2><p>Use fictional details only.</p><PracticeCard scenario={SCENARIOS.find(item => item.id === scenario)!} showCode={showCode} voiceMode={Boolean(voiceHandle || connecting)}/><Conversation handle={voiceHandle} active={Boolean(voiceHandle)} connecting={connecting} turns={turns.map((turn, index) => ({ key: index, who: turn.role === 'you' ? 'you' as const : 'caller' as const, label: turn.role === 'you' ? 'You' : 'Caller', text: turn.text }))}>{(voiceHandle || connecting) && <button onClick={() => { stopVoice(); setEnded(true); }}>End voice call</button>}</Conversation>{result ? <div role="status"><h3>The evidence</h3><p>{result.explanation}</p><p>{result.safest}</p></div> : <>{ended && turns.length > 0 && <><h3>What’s your verdict?</h3><div className="hub-verdict">{['Real', 'Scam', 'Unverified'].map(verdict => <button key={verdict} disabled={busy} onClick={() => void giveVerdict(scenario as ScenarioId, verdict)}>{verdict}</button>)}</div></>}</>}</section>}
    {view === 'News' && <section className="hub-library">{newsState && <p role="status">{newsState} <a href="https://consumer.ftc.gov/consumer-alerts">Read FTC alerts ↗</a></p>}{alerts.map(item => <article className="hub-card" key={item.link}><span className="hub-chip">FTC · Consumer alert</span><h2>{item.title}</h2><p>{item.summary}</p><a className="hub-link" href={item.link} target="_blank" rel="noreferrer">Read the source ↗</a></article>)}</section>}
    {view === 'Leaderboard' && <Leaderboard embedded />}
    {view === 'Progress' && <ProgressPanel initialSkill={skillParam} onSignIn={() => navigate('Profile')} />}
    {view === 'Profile' && <ProfilePanel returnTo={returnTo} />}
    <footer className="hub-footer">Block or Talk · Fictional calls. Practical instincts.<a href="/insights">Carrier insights</a></footer>
  </main>;
}
