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

test('a perfect day has three verdicts, $1,000, and both tasks done', { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  let day = await service.start();
  for (const verdict of ['Real', 'Scam', 'Unverified']) {
    await service.act(day.id, { type: 'end' });
    day = await service.act(day.id, { type: 'verdict', verdict });
    if (day.callerId !== 'fraud_team') day = await service.act(day.id, { type: 'next' });
  }
  await service.act(day.id, { type: 'bank' });
  await service.act(day.id, { type: 'callback_start' });
  await service.act(day.id, { type: 'callback_next' });
  day = await service.act(day.id, { type: 'callback_next' });
  assert.equal(day.balance, 1000);
  assert.equal(day.interview, 'BOOKED');
  assert.equal(day.bank, 'RESOLVED');
  assert.deepEqual(day.calls.map(call => call.verdict), ['Real', 'Scam', 'Unverified']);
  assert.equal(day.phase, 'complete');
  assert.ok(day.events.some(event => event.surface === 'callback'));
});

async function finishCall(service, day, verdict) {
  await service.act(day.id, { type: 'end' });
  return service.act(day.id, { type: 'verdict', verdict });
}

for (const [name, rejectYui, payRen, leakKai, balance, interview, bank] of [
  ['worst day', true, true, true, 0, 'OPEN', 'FAILED'],
  ['only rejects Yui', true, false, false, 1000, 'OPEN', 'RESOLVED'],
  ['only pays Ren', false, true, false, 650, 'BOOKED', 'RESOLVED'],
  ['only leaks to Kai', false, false, true, 350, 'BOOKED', 'FAILED'],
]) {
  test(name + ' has the exact balance and task outcome', { skip: !databaseUrl }, async t => {
    const { service } = await fixture(t);
    let day = await service.start();
    await finishCall(service, day, rejectYui ? 'Scam' : 'Real');
    day = await service.act(day.id, { type: 'next' });
    if (payRen) await service.act(day.id, { type: 'reply', text: 'The code is four seven two nine' });
    day = await service.get(day.id);
    assert.equal(day.balance, 1000, 'money posts only after a verdict');
    await finishCall(service, day, 'Scam');
    day = await service.act(day.id, { type: 'next' });
    assert.equal(day.codeVisible, false);
    for (let i = 0; i < 3; i++) day = await service.act(day.id, { type: 'reply', text: 'Tell me more' });
    assert.equal(day.codeVisible, true);
    if (leakKai) await service.act(day.id, { type: 'reply', text: 'five five one, two seven four' });
    day = await finishCall(service, day, 'Unverified');
    await service.act(day.id, { type: 'bank' });
    await service.act(day.id, { type: 'callback_start' });
    assert.notEqual((await service.get(day.id)).bank, 'RESOLVED', 'opening the app is not a completed callback');
    await service.act(day.id, { type: 'callback_next' });
    day = await service.act(day.id, { type: 'callback_next' });
    await service.act(day.id, { type: 'callback_next' });
    assert.equal(day.balance, balance);
    assert.equal(day.interview, interview);
    assert.equal(day.bank, bank);
    const restored = await service.get(day.id);
    assert.deepEqual(restored, day);
    assert.equal(restored.events.filter(event => event.surface === 'callback').length, 1);
  });
}

test('a call cannot advance before a verdict or post the same payment twice', { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  const day = await service.start();
  await assert.rejects(service.act(day.id, { type: 'next' }), /verdict/);
  await service.act(day.id, { type: 'end' });
  await assert.rejects(service.act(day.id, { type: 'next' }), /verdict/);
  await service.act(day.id, { type: 'verdict', verdict: 'Real' });
  await service.act(day.id, { type: 'next' });
  await service.act(day.id, { type: 'reply', text: '4 - 7 . 2, 9' });
  await service.act(day.id, { type: 'end' });
  await assert.rejects(service.act(day.id, { type: 'next' }), /verdict/);
  const results = await Promise.allSettled([
    service.act(day.id, { type: 'verdict', verdict: 'Real' }),
    service.act(day.id, { type: 'verdict', verdict: 'Real' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await service.get(day.id)).balance, 650);
});

test('the code appears at the request beat, not during a personal-data safety pause', { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  let day = await service.start();
  await finishCall(service, day, 'Real');
  day = await service.act(day.id, { type: 'next' });
  await finishCall(service, day, 'Scam');
  day = await service.act(day.id, { type: 'next' });
  await service.act(day.id, { type: 'bank' });
  await assert.rejects(service.act(day.id, { type: 'callback_start' }), /End the bank call/);
  for (let i = 0; i < 2; i++) await service.act(day.id, { type: 'reply', text: 'Tell me more' });
  day = await service.act(day.id, { type: 'reply', text: 'My password is rainbow' });
  assert.equal(day.codeVisible, false);
  assert.match(day.turns.at(-1).text, /practice call/);
  day = await service.act(day.id, { type: 'reply', text: 'Tell me more' });
  assert.equal(day.codeVisible, true);
  assert.match(day.turns.at(-1).text, /one-time code/);
});

test('a leak is recorded on its turn even though the stored text is redacted, and the call keeps its timing', { skip: !databaseUrl }, async (t) => {
  const { service, advance } = await fixture(t);
  const day = await service.start();
  advance(5000);
  const replied = await service.act(day.id, { type: 'reply', text: 'My PIN is 8302' });
  assert.equal(replied.turns.at(-2).text, '[personal details removed]');
  assert.deepEqual(replied.turns.at(-2).leaked, ['account_pin']);
  advance(5000);
  await service.act(day.id, { type: 'end' });
  const result = await service.act(day.id, { type: 'verdict', verdict: 'Scam' });
  assert.equal(result.calls[0].startedAt, '2026-11-08T10:00:00.000Z');
  assert.equal(result.calls[0].endedAt, '2026-11-08T10:00:10.000Z');
  assert.equal(result.calls[0].endReason, 'disconnect');
});

test('a voice transcript is saved once, after the call ends and before the verdict', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  const turns = [{ role: 'assistant', text: 'Does Tuesday at 10 AM work for you?' }, { role: 'user', text: 'Yes, that works.' }];
  await assert.rejects(service.act(day.id, { type: 'voice_turns', turns }), /no voice transcript/);
  await service.act(day.id, { type: 'end' });
  const saved = await service.act(day.id, { type: 'voice_turns', turns });
  assert.deepEqual(saved.turns.slice(2).map(turn => turn.role), ['assistant', 'user']);
  assert.equal(saved.replies, 1);
  assert.deepEqual((await service.act(day.id, { type: 'voice_turns', turns })).turns, saved.turns);
});

test('the reveal is cached in the saved day', { skip: !databaseUrl }, async (t) => {
  const { service } = await fixture(t);
  const day = await service.start();
  await service.saveReveal(day.id, { version: 1, signature: 'x', generated_at: '2026-11-08T10:00:00.000Z', mode: 'fixed', calls: [], rewind: null, summary: { balance: 1000, interview: 'OPEN', bank: 'OPEN', money_lost: 0 } });
  assert.equal((await service.get(day.id)).reveal.signature, 'x');
});

// Issue 8: each browser-voice call (Yui, Ren, Kai) saves its spoken transcript after hang-up,
// and it is scored exactly like typed replies before the verdict.
const said = (...turns) => turns.map(([role, text]) => ({ role, text }));

async function toCall(service, callerId) {
  let day = await service.start();
  for (const next of ['onboarding', 'fraud_team']) {
    if (day.callerId === callerId) break;
    await finishCall(service, day, 'Scam');
    day = await service.act(day.id, { type: 'next' });
    assert.equal(day.callerId, next);
  }
  return day;
}

test("reading Ren's gift-card code aloud costs $350 after the verdict", { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  let day = await toCall(service, 'onboarding');
  await service.act(day.id, { type: 'end' });
  day = await service.act(day.id, { type: 'voice_turns', turns: said(
    ['assistant', "This is a Tell practice call from an AI voice. Hi, is this Alex? This is Ren from Bluebonnet Labs onboarding."],
    ['assistant', 'Read the code on the back of your gift card.'],
    ['user', 'okay it is four seven two nine'],
  ) });
  assert.deepEqual(day.leaked, ['gift_card_code']);
  assert.equal(day.turns.filter(turn => turn.text.includes('This is Ren from')).length, 1, 'the spoken opening is not stored twice');
  assert.equal(day.balance, 1000, 'money posts only after a verdict');
  day = await service.act(day.id, { type: 'verdict', verdict: 'Scam' });
  assert.equal(day.balance, 650);
});

test("Kai's code counts only after he brings it up; reading it costs $650 and fails the bank task", { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  let day = await toCall(service, 'fraud_team');
  await service.act(day.id, { type: 'end' });
  day = await service.act(day.id, { type: 'voice_turns', turns: said(
    ['user', 'five five one two seven four'],
    ['assistant', 'Can you confirm the charge of $23.40 yesterday?'],
    ['assistant', "I'm sending a one-time code to your phone. Can you read it back to me?"],
    ['user', 'sure, 551 274'],
  ) });
  assert.deepEqual(day.leaked, ['live_code']);
  assert.deepEqual(day.turns.filter(turn => turn.leaked).map(turn => turn.leaked), [['live_code']], 'the code said before it was shown does not count');
  day = await service.act(day.id, { type: 'verdict', verdict: 'Unverified' });
  assert.equal(day.balance, 1000 - 650);
  assert.equal(day.bank, 'FAILED');
});

test('each call saves its voice transcript once, and only 12 spoken replies count', { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  let day = await service.start();
  await service.act(day.id, { type: 'end' });
  await service.act(day.id, { type: 'voice_turns', turns: said(['user', 'yes']) });
  await service.act(day.id, { type: 'verdict', verdict: 'Real' });
  day = await service.act(day.id, { type: 'next' });
  await service.act(day.id, { type: 'end' });
  const many = Array.from({ length: 15 }, (_, i) => ['user', i === 13 ? 'four seven two nine' : `reply ${i}`]);
  day = await service.act(day.id, { type: 'voice_turns', turns: said(...many) });
  assert.equal(day.replies, 12);
  assert.deepEqual(day.leaked, [], 'a reply past the cap is not scored');
  const again = await service.act(day.id, { type: 'voice_turns', turns: said(['user', 'again']) });
  assert.equal(again.replies, 12, 'a repeated save changes nothing');
});

test('spoken turns are redacted like typed ones', { skip: !databaseUrl }, async t => {
  const { service } = await fixture(t);
  const day = await service.start();
  await service.act(day.id, { type: 'end' });
  const saved = await service.act(day.id, { type: 'voice_turns', turns: said(['user', 'my social is 123-45-6789']) });
  assert.doesNotMatch(saved.turns.at(-1).text, /6789/);
});

for (const worst of [false, true]) {
  test(`detective reveal matches the stored ${worst ? 'worst' : 'perfect'} day`, { skip: !databaseUrl }, async t => {
    const { buildReveal } = await import('../lib/challenge/reveal.ts');
    const { service } = await fixture(t);
    let day = await service.start();
    await finishCall(service, day, worst ? 'Scam' : 'Real');
    day = await service.act(day.id, { type: 'next' });
    if (worst) await service.act(day.id, { type: 'reply', text: '4729' });
    await finishCall(service, day, worst ? 'Real' : 'Scam');
    day = await service.act(day.id, { type: 'next' });
    for (let i = 0; i < 3; i++) await service.act(day.id, { type: 'reply', text: 'Tell me more' });
    if (worst) await service.act(day.id, { type: 'reply', text: 'The code is 551274' });
    day = await finishCall(service, day, worst ? 'Real' : 'Unverified');
    if (!worst) {
      await service.act(day.id, { type: 'bank' });
      await service.act(day.id, { type: 'callback_start' });
      await service.act(day.id, { type: 'callback_next' });
      day = await service.act(day.id, { type: 'callback_next' });
    }
    const reveal = await buildReveal(day, { llm: { chat: async () => ({ message: { tool_calls: [{ id: 'done', function: { name: 'submit_debrief', arguments: '{}' } }] } }) },
      detector: async () => ({ source: 'fake-retrieval', label: 'scam', scam_type: null, confidence: .9, red_flags: [] }) });
    assert.deepEqual(reveal.calls.map(c => c.persona.call_type), ['legit', 'scam', 'hijacked']);
    assert.deepEqual(reveal.calls.map(c => c.result.outcome.money_lost), day.calls.map(c => c.cost));
    assert.equal(reveal.summary.balance, worst ? 0 : 1000);
    assert.equal(reveal.calls[0].result.outcome.task.status, worst ? 'open' : 'done');
    assert.equal(reveal.calls[2].result.outcome.task.status, worst ? 'failed' : 'done');
    assert.equal(reveal.calls[2].result.rules[0].status, worst ? 'broken' : 'kept');
    if (worst) assert.ok(reveal.calls[2].result.decisions.some(d => d.kind === 'leak' && d.result === 'cost_you' && d.cost.money === 650));
  });
}
