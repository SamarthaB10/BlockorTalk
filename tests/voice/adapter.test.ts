import { describe, expect, it } from "vitest";
import { ElevenLabsVoiceAdapter, VoiceRequestError, type AgentIds } from "../../lib/voice/adapter";

const AGENTS: AgentIds = {
  recruiter: "agent_r",
  onboarding: "agent_o",
  fraud_team: "agent_f",
  bank_callback: "agent_b",
};

const KAI_CARD = {
  player_name: "Sam",
  date_of_birth: "July 2, 1988",
  home_address: "77 Mesquite Lane, Austin, Texas",
  card_ending: "9021",
  recent_charge: "$12.10 at a ShopNest order",
  live_code: "803 116",
};

function fakeClient() {
  const outbound: any[] = [];
  const client = {
    conversationalAi: {
      sipTrunk: {
        outboundCall: async (req: any) => {
          outbound.push(req);
          return { success: true, message: "ok", conversationId: "conv_live_1" };
        },
      },
      conversations: {
        getWebrtcToken: async (req: any) => ({ token: `tok-for-${req.agentId}` }),
        delete: async () => undefined,
      },
    },
  };
  return { client: client as any, outbound };
}

describe("ElevenLabs voice adapter", () => {
  it("rings a verified number with the right agent, line and scenario-card variables", async () => {
    const { client, outbound } = fakeClient();
    const voice = new ElevenLabsVoiceAdapter(client, AGENTS, "phnum_photon");
    const res = await voice.placeCall({
      callerId: "fraud_team",
      toNumber: "+14155550123",
      phoneVerified: true,
      variables: { ...KAI_CARD, unrelated: "dropped" },
    });
    expect(res).toEqual({ conversationId: "conv_live_1" });
    expect(outbound).toHaveLength(1);
    expect(outbound[0].agentId).toBe("agent_f");
    expect(outbound[0].agentPhoneNumberId).toBe("phnum_photon");
    expect(outbound[0].toNumber).toBe("+14155550123");
    expect(outbound[0].conversationInitiationClientData.dynamicVariables).toEqual(KAI_CARD);
  });

  it("never dials an unverified number", async () => {
    const { client, outbound } = fakeClient();
    const voice = new ElevenLabsVoiceAdapter(client, AGENTS, "phnum_photon");
    await expect(
      voice.placeCall({ callerId: "fraud_team", toNumber: "+14155550123", phoneVerified: false, variables: KAI_CARD }),
    ).rejects.toBeInstanceOf(VoiceRequestError);
    expect(outbound).toHaveLength(0);
  });

  it("refuses a call missing a scenario-card variable", async () => {
    const { client, outbound } = fakeClient();
    const voice = new ElevenLabsVoiceAdapter(client, AGENTS, "phnum_photon");
    const { live_code: _omit, ...partial } = KAI_CARD;
    await expect(
      voice.placeCall({ callerId: "fraud_team", toNumber: "+14155550123", phoneVerified: true, variables: partial }),
    ).rejects.toThrow(/live_code/);
    expect(outbound).toHaveLength(0);
  });

  it("refuses numbers that are not E.164 and calls with no SIP line configured", async () => {
    const { client, outbound } = fakeClient();
    const ok = { callerId: "fraud_team" as const, phoneVerified: true, variables: KAI_CARD };
    await expect(
      new ElevenLabsVoiceAdapter(client, AGENTS, "phnum").placeCall({ ...ok, toNumber: "415-555-0123" }),
    ).rejects.toThrow(/E\.164/);
    await expect(
      new ElevenLabsVoiceAdapter(client, AGENTS, undefined).placeCall({ ...ok, toNumber: "+14155550123" }),
    ).rejects.toThrow(/PHONE_NUMBER_ID/);
    expect(outbound).toHaveLength(0);
  });

  it("issues a browser-voice token for the requested caller's agent", async () => {
    const { client } = fakeClient();
    const voice = new ElevenLabsVoiceAdapter(client, AGENTS, undefined);
    expect(await voice.createBrowserSession({ callerId: "bank_callback" })).toEqual({
      agentId: "agent_b",
      conversationToken: "tok-for-agent_b",
    });
  });
});
