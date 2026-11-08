import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createChallengeService } from '../lib/challenge/service.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
async function fixture(t) {
  const schema = `challenge_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: databaseUrl });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(databaseUrl);
  url.searchParams.set('options', `-csearch_path=${schema}`);
  const connectionString = url.toString();
  const setup = new pg.Client({ connectionString });
  await setup.connect();
  await setup.query(await readFile(new URL('../migrations/002_challenge.sql', import.meta.url), 'utf8'));
  await setup.end();
  t.after(async () => {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  let now = Date.parse('2026-11-08T10:00:00Z');
  const service = createChallengeService({ connectionString, now: () => now, reply: async ({ options }) => options[0] });
  return { service, advance: (ms) => { now += ms; } };
}

test('Real books the interview and persists the verdict', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  assert.equal(day.balance, 1000);
  assert.match(day.turns[0].text, /^This is a Tell practice call/);
  await service.act(day.id, { type: 'end' });
  await service.act(day.id, { type: 'verdict', verdict: 'Real' });
  const restored = await service.get(day.id);
  assert.equal(restored.interview, 'BOOKED');
  assert.equal(restored.verdict, 'Real');
});

for (const verdict of ['Scam', 'Unverified']) {
  test(`${verdict} leaves the interview open; only Unverified plus a portal check books it`, { skip: !databaseUrl }, async (t) => {
    const { service } = await fixture(t);
    const day = await service.start();
    await service.act(day.id, { type: 'end' });
    const result = await service.act(day.id, { type: 'verdict', verdict });
    assert.equal(result.interview, 'OPEN');
    const verified = await service.act(day.id, { type: 'portal' });
    assert.equal(verified.interview, verdict === 'Unverified' ? 'BOOKED' : 'OPEN');
    assert.deepEqual(verified.events, [{ type: 'Verify', surface: 'portal', at: '2026-11-08T10:00:00.000Z' }]);
    assert.deepEqual((await service.get(day.id)).events, verified.events);
  });
}

test('stop drill ends immediately and still accepts a verdict', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  const stopped = await service.act(day.id, { type: 'reply', text: 'Please STOP DRILL now' });
  assert.equal(stopped.endReason, 'stop');
  assert.equal(stopped.turns.at(-1).role, 'user');
  assert.equal((await service.act(day.id, { type: 'verdict', verdict: 'Real' })).interview, 'BOOKED');
});

test('12 replies end the call without a thirteenth player turn', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  let day = await service.start();
  for (let i = 0; i < 12; i++) day = await service.act(day.id, { type: 'reply', text: 'Okay' });
  assert.equal(day.phase, 'verdict');
  assert.equal(day.endReason, 'reply_cap');
  assert.equal(day.replies, 12);
  const after = await service.act(day.id, { type: 'reply', text: 'One more' });
  assert.equal(after.replies, 12);
});

test('the three-minute deadline survives reload and prevents a late reply', { skip: !databaseUrl }, async (t) => {
  const { service, advance } = await fixture(t);
  const day = await service.start();
  advance(180000);
  const expired = await service.get(day.id);
  assert.equal(expired.phase, 'verdict');
  assert.equal(expired.endReason, 'time_cap');
  assert.equal((await service.act(day.id, { type: 'reply', text: 'Too late' })).replies, 0);
});

test('a portal check during the call counts when Unverified is chosen later', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  await service.act(day.id, { type: 'portal' });
  await service.act(day.id, { type: 'end' });
  assert.equal((await service.act(day.id, { type: 'verdict', verdict: 'Unverified' })).interview, 'BOOKED');
});

test('concurrent replies cannot exceed the cap', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  for (let i = 0; i < 11; i++) await service.act(day.id, { type: 'reply', text: 'Okay' });
  await Promise.all([service.act(day.id, { type: 'reply', text: 'Okay' }), service.act(day.id, { type: 'reply', text: 'Okay' })]);
  assert.equal((await service.get(day.id)).replies, 12);
});

test('likely personal details are removed before storage', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  await service.act(day.id, { type: 'reply', text: 'My card is 4111 1111 1111 1111 and email is test@example.com' });
  const saved = await service.get(day.id);
  assert.doesNotMatch(JSON.stringify(saved), /4111|test@example/);
  assert.match(saved.turns.at(-1).text, /practice call/);
});


test('explicit short secrets are not stored or sent to the LLM', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  for (const text of ['My PIN is 1234', 'My password is rainbow', 'The code is 551274']) {
    await service.act(day.id, { type: 'reply', text });
  }
  const saved = await service.get(day.id);
  assert.doesNotMatch(JSON.stringify(saved), /1234|rainbow|551274/);
  assert.equal(saved.turns.filter(turn => turn.role === 'assistant' && turn.source === 'nemotron').length, 0);
});
