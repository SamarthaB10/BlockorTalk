import { expect, test } from 'vitest';
import { createCallHandlers } from '../lib/season/calls/routes';
import { createCallService } from '../lib/season/calls/service';
import type { CallRecord, CallStore, Transaction } from '../lib/season/calls/store';
import type { PublicCall } from '../lib/season/calls/types';
import { scenarios } from '../lib/season/scenarios/server';
import { STEP_HINTS } from '../lib/skills/catalog';

function fixture() {
  let time = Date.parse('2026-11-08T10:00:00Z');
  let draw = 0;
  const rows = new Map<string, CallRecord>();
  const practice: boolean[] = [];
  const store: CallStore = {
    async start(player, draft, now, options) {
      practice.push(Boolean(options?.practice));
      const row: CallRecord = { ...draft, playerId: player, seasonId: 's1', scored: !options?.practice, startedAt: now.toISOString(), callsLeft: 4 };
      rows.set(row.id, row); return row;
    },
    async update(player, id, work) {
      const row = rows.get(id);
      if (!row || row.playerId !== player) return null;
      const next = structuredClone(row); await work(next, {} as Transaction); rows.set(id, next); return next;
    },
  };
  const service = createCallService({ store, scenario: async id => scenarios.find(row => row.id === id) ?? null,
    plan: async scenario => ({ lines: [`Hello from ${scenario.org}.`, scenario.card.facts[0]!, 'Please review this now.'] as [string, string, string], path: 'fixed' as const }),
    now: () => new Date(time), random: () => (draw++ % 2) / 2, finishCall: async () => ({ done: true }) });
  const handlers = createCallHandlers({ service, authenticate: async () => 'p1',
    speech: { speak: async () => new Response(''), transcribe: async () => '' } });
  const post = async (action: object, id?: string) => {
    const response = await handlers.POST(new Request(`https://tell.test/api/play/calls${id ? '/' + id : ''}`, { method: 'POST', headers: { origin: 'https://tell.test', 'content-type': 'application/json' }, body: JSON.stringify(action) }), id);
    return { status: response.status, body: await response.json() as { call: PublicCall; error?: string } };
  };
  return { post, rows, practice, advance: (ms: number) => { time += ms; } };
}

test('a hint is recorded at the current step and reads the same for real and scam calls', async () => {
  const f = fixture();
  const real = (await f.post({ type: 'start', scenarioId: 'bank' })).body.call;
  const scam = (await f.post({ type: 'start', scenarioId: 'bank' })).body.call;
  expect([f.rows.get(real.id)!.version, f.rows.get(scam.id)!.version]).toEqual(['real', 'scam']);
  const a = await f.post({ type: 'hint' }, real.id);
  const b = await f.post({ type: 'hint' }, scam.id);
  expect(a.body.call.hint).toBe(STEP_HINTS[1]);
  expect(b.body.call.hint).toBe(a.body.call.hint);
  await f.post({ type: 'reply', text: 'Who is this?' }, real.id);
  await f.post({ type: 'hint' }, real.id);
  expect(f.rows.get(real.id)!.hintEvents!.map(event => event.step)).toEqual([1, 2]);
  await f.post({ type: 'end' }, real.id);
  expect((await f.post({ type: 'hint' }, real.id)).status).toBe(409);
});

test('the engine records the caller’s link and how the call ended', async () => {
  const f = fixture();
  const ended = (await f.post({ type: 'start', scenarioId: 'bank' })).body.call;
  await f.post({ type: 'end' }, ended.id);
  expect(f.rows.get(ended.id)!.endedBy).toBe('player');
  const phishing = (await f.post({ type: 'start', scenarioId: 'phishing' })).body.call;
  expect(f.rows.get(phishing.id)!.version).toBe('scam');
  for (const text of ['Who is this?', 'What is it about?']) await f.post({ type: 'reply', text }, phishing.id);
  expect((await f.post({ type: 'caller-link' }, phishing.id)).status).toBe(200);
  expect(f.rows.get(phishing.id)!.linkEvents).toEqual([{ at: expect.any(String), step: 3 }]);
  for (const text of ['Hmm', 'No']) await f.post({ type: 'reply', text }, phishing.id);
  expect(f.rows.get(phishing.id)!.endedBy).toBe('replies');
  const timed = (await f.post({ type: 'start', scenarioId: 'bank' })).body.call;
  f.advance(180000);
  await f.post({ type: 'end' }, timed.id);
  expect(f.rows.get(timed.id)!.endedBy).toBe('time');
});

test('a drill is a 60-second practice call for one skill', async () => {
  const f = fixture();
  const drill = await f.post({ type: 'start', scenarioId: 'delivery', drill: 'protect' });
  expect(drill.status).toBe(201);
  expect(drill.body.call).toMatchObject({ limitSeconds: 60, drill: { skill: 'protect', name: 'Protect codes and secrets' } });
  expect(f.practice).toEqual([true]);
  const normal = (await f.post({ type: 'start', scenarioId: 'bank' })).body.call;
  expect(normal.limitSeconds).toBe(180);
  expect(normal.drill).toBeUndefined();
  f.advance(60000);
  await f.post({ type: 'reply', text: 'Hello?' }, drill.body.call.id);
  expect(f.rows.get(drill.body.call.id)!.phase).toBe('verdict');
  expect(f.rows.get(normal.id)!.phase).toBe('call');
  expect((await f.post({ type: 'start', scenarioId: 'bank', drill: 'xp' })).status).toBe(400);
});
