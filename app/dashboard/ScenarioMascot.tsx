import { useEffect, useRef, useState } from 'react';

const FRAMES = 12;

/** Card colors depend only on display order, never on call type. Hovering the card makes the cat "talk". */
export default function ScenarioMascot({ index }: { index: number }) {
  const color = ['purple', 'green', 'red'][index % 3];
  const ref = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState(0);
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    const card = ref.current?.closest('.hub-scenario');
    if (!card) return;
    const on = () => setTalking(true);
    const off = () => setTalking(false);
    card.addEventListener('mouseenter', on); card.addEventListener('mouseleave', off);
    return () => { card.removeEventListener('mouseenter', on); card.removeEventListener('mouseleave', off); };
  }, []);

  useEffect(() => {
    if (!talking || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setFrame(0); return; }
    const timer = setInterval(() => setFrame(value => value % FRAMES + 1), 90);
    return () => clearInterval(timer);
  }, [talking]);

  const src = talking && frame > 0
    ? `/sprites/cutout/${color}/talk_standard/talk_standard_${String(frame).padStart(2, '0')}.png`
    : `/sprites/cutout/${color}/idle/idle_01.png`;
  return <img ref={ref} className="hub-scenario-mascot" src={src} width={170} height={145} alt="" />;
}
