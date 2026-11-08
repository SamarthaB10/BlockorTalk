import { expect, it } from 'vitest';
import { anchorDetection } from '../lib/challenge/detector';
import type { Transcript } from '../lib/debrief/index.mjs';
const transcript: Transcript = { id: 'call', persona_id: 'kai', verdict: 'real', events: [], turns: [
  { turn: 1, speaker: 'caller', text: '☎️ Please read the code right now.' },
  { turn: 2, speaker: 'player', text: 'No.' },
] };
it('anchors exact retrieval quotes after emoji with UTF-16 offsets', () => {
  const result = anchorDetection(transcript, { label: 'scam', scam_type: 'code', confidence: .9, red_flags: [{ tactic: 'urgency', text: 'right now' }] });
  const span = result.red_flags[0].span;
  expect(transcript.turns[0].text.slice(span.start, span.end)).toBe('right now');
});
it.each(['missing', 'No.'])('rejects absent or repeated quotes: %s', text => {
  const input = { ...transcript, turns: [...transcript.turns, { turn: 3, speaker: 'caller' as const, text: 'No.' }] };
  expect(anchorDetection(input, { label: 'scam', scam_type: null, confidence: .9, red_flags: [{ tactic: 'fear', text }] }).label).toBeNull();
});
it('does not invent a label for low confidence', () => {
  expect(anchorDetection(transcript, { label: 'scam', scam_type: null, confidence: .59, red_flags: [] }).label).toBeNull();
});
