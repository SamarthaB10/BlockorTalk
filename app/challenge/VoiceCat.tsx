'use client';

import { useEffect, useRef } from 'react';
import type { BrowserCallHandle } from '../../lib/voice/browserCall';
import { FRAME_MS, SPRITE_HEIGHT, SPRITE_WIDTH, frameCount, spriteFrame as rawFrame, spriteFrames as rawFrames } from '../../lib/sprites.mjs';

// Transparent cutouts of the same frames (scripts/cutout-sprites.py).
const cutout = (src: string) => src.replace('/sprites/', '/sprites/cutout/');
const spriteFrame = (...args: Parameters<typeof rawFrame>) => cutout(rawFrame(...args));
const spriteFrames = (...args: Parameters<typeof rawFrames>) => rawFrames(...args).map(cutout);

type Pose = 'idle' | 'talk_standard' | 'talk_excited';

const SPEAK_AT = 0.04; // caller output level that counts as speech
const LOUD_AT = 0.45; // smoothed level that switches to the energetic pose
const HOLD_MS = 280; // keep talking through the short gaps between syllables

/**
 * The practice caller's cat. It reacts to the caller's audio level only, in one
 * fixed colorway, so nothing about it can hint at the call type. Frames and
 * wiggle are written straight to the DOM to avoid a React render every tick.
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pose: Pose = 'idle';
    let frame = 1;
    let lastFrame = 0;
    let lastVoice = 0;
    let smooth = 0;
    const show = () => { image.src = spriteFrame('planner', pose, frame); };
    const setPose = (next: Pose) => { if (next === pose) return; pose = next; frame = 1; lastFrame = performance.now(); show(); };
    const rest = () => { setPose('idle'); frame = 1; show(); node.style.setProperty('--cat-level', '0'); };
    if (!handle || !active) { rest(); return; }

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      const level = Math.min(1, Math.max(0, handle.outputLevel()));
      smooth = smooth * 0.6 + level * 0.4;
      if (level > SPEAK_AT) lastVoice = now;
      const speaking = now - lastVoice < HOLD_MS;
      node.style.setProperty('--cat-level', speaking && !reduced ? String(Math.min(1, smooth * 1.6 + 0.2).toFixed(2)) : '0');
      if (!speaking) { setPose('idle'); return; }
      setPose(smooth > LOUD_AT ? 'talk_excited' : 'talk_standard');
      if (!reduced && now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        frame = (frame % frameCount[pose]) + 1;
        show();
      }
    }, 40);
    return () => { window.clearInterval(timer); rest(); };
  }, [handle, active]);

  return <div className="voice-cat" ref={wrap} aria-hidden="true">
    <img ref={img} src={spriteFrame('planner', 'idle', 1)} width={SPRITE_WIDTH} height={SPRITE_HEIGHT} alt="" draggable={false} />
  </div>;
}
