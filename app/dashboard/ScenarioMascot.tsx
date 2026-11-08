/** Card colors depend only on display order, never on call type. */
export default function ScenarioMascot({ index }: { index: number }) {
  const color = ['purple', 'green', 'red'][index % 3];
  return <img className="hub-scenario-mascot" src={`/sprites/${color}/idle/idle_01.png`} width={170} height={145} alt="" loading="lazy" />;
}
