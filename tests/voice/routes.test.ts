import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FakeVoiceAdapter } from "../../lib/voice/adapter";
import { createVoiceRoutes, type VoiceEvent, type VoiceStore } from "../../lib/voice/routes";
import type { PostCallTranscript } from "../../lib/voice/transcript";

const WEBHOOK_SECRET = "wsec_routes";
const TOOL_SECRET = "tool_routes";
const BASE = "https://tell.test";

function sign(body: string, secret = WEBHOOK_SECRET) {
  const at = Math.floor(Date.now() / 1000);
  return `t=${at},v0=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;
}

function fakeStore() {
  const transcripts = new Map<string, PostCallTranscript>();
  const events: VoiceEvent[] = [];
  const store: VoiceStore = {
    async saveTranscript(t) {
      if (transcripts.has(t.conversationId)) return "duplicate";
      transcripts.set(t.conversationId, t);
      return "stored";
    },
    async addEvent(e) {
      events.push({ id: events.length + 1, at: new Date(0).toISOString(), ...e });
    },
    async listEvents(conversationId, afterId) {
      return events.filter((e) => e.conversationId === conversationId && e.id > afterId);
    },
  };
  return { store, transcripts, events };
}

function setup() {
  const voice = new FakeVoiceAdapter();
  const db = fakeStore();
  const routes = createVoiceRoutes({
    voice,
    store: db.store,
    toolSecret: TOOL_SECRET,
    webhookSecret: WEBHOOK_SECRET,
  });
  const postCall = (payload: unknown) => {
    const body = JSON.stringify(payload);
    return routes.postCall(
      new Request(`${BASE}/api/voice/post-call`, {
        method: "POST",
        body,
        headers: { "ElevenLabs-Signature": sign(body) },
      }),
    );
  };
  return { routes, voice, db, postCall };
}

const transcriptEvent = (userSays: string) => ({
  type: "post_call_transcription",
  data: {
    conversation_id: "conv_r1",
    agent_id: "agent_f",
    status: "done",
    transcript: [
      { role: "agent", message: "Can you confirm your card?", time_in_call_secs: 5 },
      { role: "user", message: userSays, time_in_call_secs: 9 },
    ],
    metadata: { call_duration_secs: 30 },
  },
});

describe("voice routes: post-call", () => {
  it("redacts real-looking card numbers and SSNs before storing the transcript", async () => {
    const h = setup();
    const res = await h.postCall(
      transcriptEvent("sure it's 4111 1111 1111 1111 and my social is 123-45-6789, code 551 274"),
    );
    expect(res.status).toBe(200);
    const stored = h.db.transcripts.get("conv_r1")!;
    expect(stored.turns[1]!.message).toBe(
      "sure it's [redacted card number] and my social is [redacted SSN], code 551 274",
    );
    expect(stored.turns[0]!.message).toBe("Can you confirm your card?");
    expect(h.voice.deleted).toEqual(["conv_r1"]);
  });
});

describe("redact", () => {
  it("keeps the fake scenario secrets, even several read out in a row", async () => {
    const { redact } = await import("../../lib/voice/routes");
    for (const said of [
      "4417 551 274 8302",
      "5 5 1 2 7 4 8 3 0 2 4 4 1 7",
      "1991-03-14 8302 551274",
      "the code is KQ7R-2M4X-9PLT",
      "born 03/14/1991, card ends 4417",
    ]) {
      expect(redact(said), said).toBe(said);
    }
  });

  it("redacts real card numbers however speech-to-text punctuates them", async () => {
    const { redact } = await import("../../lib/voice/routes");
    expect(redact("4111 1111 1111 1111")).toBe("[redacted card number]");
    expect(redact("it's 4111, 1111, 1111, 1111 ok")).toBe("it's [redacted card number] ok");
    expect(redact("4111.1111.1111.1111")).toBe("[redacted card number]");
    expect(redact("5500-0000-0000-0004")).toBe("[redacted card number]");
  });
});

describe("voice routes: live events", () => {
  const events = (h: ReturnType<typeof setup>, query: string) =>
    h.routes.events(new Request(`${BASE}/api/voice/events?${query}`));
  const callFailed = (h: ReturnType<typeof setup>, conversationId: string, reason: string) =>
    h.postCall({
      type: "call_initiation_failure",
      data: { conversation_id: conversationId, agent_id: "agent_f", failure_reason: reason },
    });

  it("turns a failed outbound call into a call_failed event with its reason", async () => {
    const h = setup();
    expect((await callFailed(h, "conv_r2", "no-answer")).status).toBe(200);
    const res = await events(h, "conversation_id=conv_r2");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { events: VoiceEvent[] };
    expect(body.events.map((e) => [e.kind, e.detail])).toEqual([["call_failed", "no-answer"]]);
    expect(h.db.transcripts.size).toBe(0);
  });

  it("needs a conversation ID, and returns only events after the cursor", async () => {
    const h = setup();
    expect((await events(h, "")).status).toBe(400);
    await callFailed(h, "conv_r3", "busy");
    await callFailed(h, "conv_r3", "no-answer");
    const after1 = (await (await events(h, "conversation_id=conv_r3&after=1")).json()) as { events: VoiceEvent[] };
    expect(after1.events.map((e) => e.detail)).toEqual(["no-answer"]);
    const junk = (await (await events(h, "conversation_id=conv_r3&after=abc")).json()) as { events: VoiceEvent[] };
    expect(junk.events).toHaveLength(2);
  });
});

describe("voice routes: missing Worker secrets", () => {
  function unconfigured() {
    const voice = new FakeVoiceAdapter();
    const db = fakeStore();
    const routes = createVoiceRoutes({ voice, store: db.store, toolSecret: "", webhookSecret: "" });
    return { routes, db };
  }

  it("refuses post-call webhooks when ELEVENLABS_WEBHOOK_SECRET is unset", async () => {
    const { routes, db } = unconfigured();
    const body = JSON.stringify(transcriptEvent("hello"));
    for (const signature of ["", sign(body, "")]) {
      const res = await routes.postCall(
        new Request(`${BASE}/api/voice/post-call`, {
          method: "POST",
          body,
          headers: { "ElevenLabs-Signature": signature },
        }),
      );
      expect(res.status).toBe(401);
    }
    expect(db.transcripts.size).toBe(0);
  });
});
