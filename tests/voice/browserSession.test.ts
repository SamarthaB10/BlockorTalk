import { describe, expect, it } from "vitest";
import { FakeVoiceAdapter } from "../../lib/voice/adapter";
import { browserSessionHandler } from "../../lib/voice/browserSession";
import { CHALLENGE_CALLER_IDS } from "../../lib/voice/personas";

function harness(voice = new FakeVoiceAdapter()) {
  const handler = browserSessionHandler({ voice });
  const post = (body: unknown) =>
    handler(
      new Request("https://tell.test/api/voice/session", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  return { post, voice };
}

describe("browser session handler", () => {
  it("returns agentId and token for a Challenge caller, uncached", async () => {
    const h = harness();
    const id = CHALLENGE_CALLER_IDS[0]!;
    const res = await h.post({ callerId: id });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ agentId: `agent_fake_${id}`, conversationToken: "fake-token" });
    expect(h.voice.sessions).toEqual([{ callerId: id }]);
  });

  it("rejects unknown callers and bad JSON without calling the adapter", async () => {
    const h = harness();
    expect((await h.post({ callerId: "nobody" })).status).toBe(400);
    expect((await h.post({})).status).toBe(400);
    expect((await h.post("{nope")).status).toBe(400);
    expect(h.voice.sessions).toHaveLength(0);
  });

  it("returns a generic 502 when the adapter fails", async () => {
    const voice = new FakeVoiceAdapter();
    voice.createBrowserSession = async () => {
      throw new Error("xi-api-key sk_secret rejected");
    };
    const res = await harness(voice).post({ callerId: CHALLENGE_CALLER_IDS[0] });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/sk_secret|xi-api-key/);
  });
});
