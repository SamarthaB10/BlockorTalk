import { describe, expect, it, vi } from "vitest";
import { ElevenLabsVoiceAdapter, FakeVoiceAdapter, VoiceRequestError, type AgentIds } from "../../lib/voice/adapter";
import { phoneCallHandler } from "../../lib/voice/phoneCall";
import { SCENARIO_VARIABLE_NAMES } from "../../lib/voice/scenarioVoice";

const TEAM = ["+15125550123"];
function harness(voice = new FakeVoiceAdapter()) {
  const handler = phoneCallHandler({ voice, teamPhones: TEAM, drawScenarioAgent: () => "scenario_scam" });
  const post = (body: unknown, origin = "https://tell.test") => handler(new Request("https://tell.test/api/voice/call", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { post, voice };
}

describe("call my phone", () => {
  it("rings a team phone with a Challenge caller and its card", async () => {
    const h = harness();
    const res = await h.post({ callerId: "fraud_team", to: "(512) 555-0123" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ calling: true });
    expect(h.voice.calls).toHaveLength(1);
    expect(h.voice.calls[0]).toMatchObject({ callerId: "fraud_team", toNumber: "+15125550123", phoneVerified: true });
    expect(h.voice.calls[0]!.variables.card_ending).toBe("4417");
  });

  it("rings a catalog scenario through a server-chosen agent and never says which", async () => {
    const h = harness();
    const res = await h.post({ callerId: "insurance", to: "+1 512 555 0123" });
    const body = await res.json();
    expect(body).toEqual({ calling: true });
    expect(JSON.stringify(body)).not.toMatch(/scam|real|agent/);
    expect(h.voice.calls[0]).toMatchObject({ callerId: "scenario_scam", variableNames: SCENARIO_VARIABLE_NAMES });
    expect(h.voice.calls[0]!.variables).toMatchObject({ caller_name: "Nao", org: "Pebblewick Mutual" });
  });

  it("only ever dials team phones, and refuses other sites and unknown callers", async () => {
    const h = harness();
    expect((await h.post({ callerId: "fraud_team", to: "+15125559999" })).status).toBe(403);
    expect((await h.post({ callerId: "fraud_team", to: "not a number" })).status).toBe(400);
    expect((await h.post({ callerId: "nobody", to: "+15125550123" })).status).toBe(400);
    expect((await h.post({ callerId: "fraud_team", to: "+15125550123" }, "https://evil.test")).status).toBe(403);
    expect(h.voice.calls).toHaveLength(0);
  });

  it("says phone calls are not set up when there is no phone line, without leaking vendor text", async () => {
    const voice = new FakeVoiceAdapter();
    voice.placeCall = async () => { throw new VoiceRequestError("ELEVENLABS_PHONE_NUMBER_ID is not configured"); };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await harness(voice).post({ callerId: "fraud_team", to: "+15125550123" });
    log.mockRestore();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Phone calls aren’t set up yet." });
  });
});

describe("Twilio outbound calls", () => {
  it("rings through the Twilio line with the agent, number and card variables", async () => {
    const outbound: any[] = [];
    const client = { conversationalAi: { twilio: { outboundCall: async (req: any) => { outbound.push(req); return { success: true, message: "ok", conversationId: "conv_tw" }; } } } } as any;
    const ids = { recruiter: "agent_r", onboarding: "agent_o", fraud_team: "agent_f", bank_callback: "agent_b", scenario_real: "agent_sr", scenario_scam: "agent_ss" } as AgentIds;
    const voice = new ElevenLabsVoiceAdapter(client, ids, "phnum_twilio", undefined, "twilio");
    const variables = { player_name: "Player Fern", caller_name: "Nao", org: "Pebblewick Mutual", card_fact: "Policy on file.", practice_code: "8212", extra: "dropped" };
    expect(await voice.placeCall({ callerId: "scenario_real", toNumber: "+15125550123", phoneVerified: true, variables, variableNames: SCENARIO_VARIABLE_NAMES }))
      .toEqual({ conversationId: "conv_tw" });
    expect(outbound[0]).toMatchObject({ agentId: "agent_sr", agentPhoneNumberId: "phnum_twilio", toNumber: "+15125550123" });
    expect(Object.keys(outbound[0].conversationInitiationClientData.dynamicVariables).sort()).toEqual([...SCENARIO_VARIABLE_NAMES].sort());
  });
});
