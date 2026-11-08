import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { postCallWebhookHandler, type PostCallTranscript } from "../../src/voice/webhook";

const SECRET = "wsec_test_secret";

function sign(body: string, secret = SECRET, at = Math.floor(Date.now() / 1000)) {
  const mac = createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");
  return `t=${at},v0=${mac}`;
}

const payload = JSON.stringify({
  type: "post_call_transcription",
  event_timestamp: 1762560000,
  data: {
    agent_id: "agent_fraud",
    conversation_id: "conv_123",
    status: "done",
    transcript: [
      { role: "agent", message: "This is a Tell practice call...", time_in_call_secs: 0 },
      { role: "user", message: "It's five five one two seven four", time_in_call_secs: 31 },
    ],
    metadata: { call_duration_secs: 44 },
  },
});

function harness(opts: { failStore?: boolean } = {}) {
  const claimed = new Set<string>();
  const stored: PostCallTranscript[] = [];
  const deleted: string[] = [];
  const handler = postCallWebhookHandler({
    secret: SECRET,
    claim: async (id) => (claimed.has(id) ? false : (claimed.add(id), true)),
    release: async (id) => void claimed.delete(id),
    onTranscript: async (t) => {
      if (opts.failStore) throw new Error("db down");
      stored.push(t);
    },
    deleteConversation: async (id) => void deleted.push(id),
  });
  const post = (body: string, signature: string) =>
    handler(
      new Request("https://tell.test/api/voice/post-call", {
        method: "POST",
        body,
        headers: { "ElevenLabs-Signature": signature },
      }),
    );
  return { post, stored, deleted, claimed };
}

describe("post-call webhook", () => {
  it("stores a verified transcript, then deletes the conversation from ElevenLabs", async () => {
    const h = harness();
    const res = await h.post(payload, sign(payload));
    expect(res.status).toBe(200);
    expect(h.stored).toEqual([
      {
        conversationId: "conv_123",
        agentId: "agent_fraud",
        status: "done",
        durationSecs: 44,
        turns: [
          { role: "agent", message: "This is a Tell practice call...", timeInCallSecs: 0 },
          { role: "user", message: "It's five five one two seven four", timeInCallSecs: 31 },
        ],
      },
    ]);
    expect(h.deleted).toEqual(["conv_123"]);
  });

  it("does not double-count a duplicate delivery", async () => {
    const h = harness();
    await h.post(payload, sign(payload));
    const again = await h.post(payload, sign(payload));
    expect(again.status).toBe(200);
    expect(h.stored).toHaveLength(1);
  });

  it("rejects a bad signature and stores nothing", async () => {
    const h = harness();
    const res = await h.post(payload, sign(payload, "wrong-secret"));
    expect(res.status).toBe(401);
    expect(h.stored).toHaveLength(0);
    expect(h.deleted).toHaveLength(0);
  });

  it("rejects a tampered body and a missing signature", async () => {
    const h = harness();
    const tampered = payload.replace("conv_123", "conv_999");
    expect((await h.post(tampered, sign(payload))).status).toBe(401);
    expect((await h.post(payload, "")).status).toBe(401);
    expect(h.stored).toHaveLength(0);
  });

  it("rejects a replayed signature older than the SDK's 30-minute window", async () => {
    const h = harness();
    const old = Math.floor(Date.now() / 1000) - 31 * 60;
    expect((await h.post(payload, sign(payload, SECRET, old))).status).toBe(401);
    expect(h.stored).toHaveLength(0);
  });

  it("returns 500 and lets the retry through when storing fails", async () => {
    const failing = harness({ failStore: true });
    expect((await failing.post(payload, sign(payload))).status).toBe(500);
    expect(failing.claimed.has("conv_123")).toBe(false);
    expect(failing.deleted).toHaveLength(0);
  });

  it("acknowledges other event types without storing them", async () => {
    const h = harness();
    const audio = JSON.stringify({ type: "post_call_audio", data: { conversation_id: "conv_123" } });
    const res = await h.post(audio, sign(audio));
    expect(res.status).toBe(200);
    expect(h.stored).toHaveLength(0);
  });
});
