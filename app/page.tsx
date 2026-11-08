import SpritePlayer from './components/SpritePlayer';
import './landing.css';

const systems = [
  { personality: 'planner', name: 'Planner', description: 'Builds practice calls around the rules you need.' },
  { personality: 'detector', name: 'Detector', description: 'Finds signs of a scam and shows the evidence after your calls.' },
  { personality: 'debrief', name: 'Debrief', description: 'Explains your decisions and helps you try one again.' },
] as const;

export default function Home() {
  return <main className="landing">
    <header className="landing-head"><a href="/" aria-label="Tell home">TELL</a><span>PHONE SCAM PRACTICE</span></header>
    <section className="landing-intro">
      <p className="landing-label">A FICTIONAL DAY. YOUR DECISIONS.</p>
      <h1>Every scam<br />has a tell.</h1>
      <p className="landing-hook">Three calls. Two stories.<br />Who gets your trust?</p>
      <a className="landing-try ui-button ui-button--primary" href="/try-it">Try it <span aria-hidden="true">↗</span></a>
      <p className="landing-note">Text or browser voice. No account. No phone number.</p>
    </section>
    <section className="landing-systems" aria-labelledby="systems-heading">
      <div className="landing-system-intro"><p className="landing-label">BEHIND THE CALLS</p><h2 id="systems-heading">Three AI systems.<br />One clear lesson.</h2><p>Keep your fictional $1,000 and finish both tasks. Then see what each caller was hiding.</p></div>
      {systems.map(system => <article className="landing-system" key={system.name}>
        <SpritePlayer personality={system.personality} animation="idle" />
        <h3>{system.name}</h3><p>{system.description}</p>
      </article>)}
    </section>
    <footer className="landing-footer">Use fictional details only. The reveal opens after your third call.</footer>
  </main>;
}
