'use client';

import { useEffect, useRef } from 'react';
import type { BrowserCallHandle } from '../../lib/voice/browserCall';
import { FRAME_MS, SPRITE_HEIGHT, SPRITE_WIDTH, frameCount, spriteFrame, spriteFrames } from '../../lib/sprites.mjs';

type Pose = 'idle' | 'talk_standard' | 'talk_excited';

const SPEAK_AT = 0.04; // caller output level that counts as speech
const LOUD_AT = 0.45; // smoothed level that switches to the energetic pose
const HOLD_MS = 280; // keep talking through the short gaps between syllables

/**
 * The practice call's cat. It loops its idle animation while waiting and talks while the caller
 * speaks, reacting to the caller's audio level only, in one fixed colorway, so nothing about it can
 * hint at the call type. Frames are written straight to the DOM to avoid a React render every tick;
 * it pauses off screen and in hidden tabs, and holds a still frame for reduced motion.
 */
export default function VoiceCat({ handle, active }: { handle: BrowserCallHandle | null; active: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    (['idle', 'talk_standard', 'talk_excited'] as const).forEach(pose => spriteFrames('planner', pose).forEach(src => { new Image().src = src; }));
  }, []);

  useEffect(() => {
    const node = wrap.current;
    const image = img.current;
    if (!node || !image) return;
    let pose: Pose = 'idle';
    let frame = 1;
    let lastFrame = 0;
    let lastVoice = 0;
    let smooth = 0;
    let visible = true;
    const show = () => { image.src = spriteFrame('planner', pose, frame); };
    const rest = () => { pose = 'idle'; frame = 1; show(); node.style.setProperty('--cat-level', '0'); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { rest(); return; }

    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; });
    observer.observe(node);
    const live = Boolean(handle && active);
    const timer = window.setInterval(() => {
      if (document.hidden || !visible) return;
      const now = performance.now();
      let speaking = false;
      if (live && handle) {
        const level = Math.min(1, Math.max(0, handle.outputLevel()));
        smooth = smooth * 0.6 + level * 0.4;
        if (level > SPEAK_AT) lastVoice = now;
        speaking = now - lastVoice < HOLD_MS;
        node.style.setProperty('--cat-level', speaking ? Math.min(1, smooth * 1.6 + 0.2).toFixed(2) : '0');
      }
      const next: Pose = speaking ? (smooth > LOUD_AT ? 'talk_excited' : 'talk_standard') : 'idle';
      if (next !== pose) { pose = next; frame = 1; lastFrame = now; show(); return; }
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        frame = (frame % frameCount[pose]) + 1;
        show();
      }
    }, 25);
    return () => { window.clearInterval(timer); observer.disconnect(); rest(); };
  }, [handle, active]);

  return <div className="voice-cat" ref={wrap} aria-hidden="true">
    <img ref={img} src={spriteFrame('planner', 'idle', 1)} width={SPRITE_WIDTH} height={SPRITE_HEIGHT} alt="" draggable={false} />
  </div>;
}
