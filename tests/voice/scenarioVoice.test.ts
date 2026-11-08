import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { FakeVoiceAdapter } from "../../lib/voice/adapter";
import { browserSessionHandler } from "../../lib/voice/browserSession";
import { callVariables } from "../../lib/voice/callers";
import { SCENARIO_AGENT_KEYS, buildScenarioAgentConfig } from "../../lib/voice/scenarioAgents";
import { SCENARIO_VARIABLE_NAMES, VOICE_SCENARIO_IDS, scenarioVoiceVariables } from "../../lib/voice/scenarioVoice";
import { scenarioCatalog } from "../../lib/season/scenarios/catalog";

const DISCLOSURE = "It's recorded for your report. Say 'stop drill' anytime.";
const post = (handler: ReturnType<typeof browserSessionHandler>, callerId: string) =>
  handler(new Request("https://tell.test/api/voice/session", { method: "POST", body: JSON.stringify({ callerId }) }));

describe("catalog voice", () => {
  it("voices every catalog scenario with the same fictional variable names", () => {
    expect([...VOICE_SCENARIO_IDS].sort()).toEqual(scenarioCatalog.map(row => row.id).sort());
    for (const id of VOICE_SCENARIO_IDS) {
      const row = scenarioCatalog.find(item => item.id === id)!;
      const variables = scenarioVoiceVariables(id)!;
      expect(Object.keys(variables).sort()).toEqual([...SCENARIO_VARIABLE_NAMES].sort());
      expect(callVariables(id, variables, SCENARIO_VARIABLE_NAMES).org).toBe(row.org);
    }
    expect(scenarioVoiceVariables("recruiter")).toBeNull();
  });

  it("issues a token from a server-chosen agent and never tells the browser which one", async () => {
    const voice = new FakeVoiceAdapter();
    const handler = browserSessionHandler({ voice, drawScenarioAgent: () => "scenario_scam" });
    const res = await post(handler, VOICE_SCENARIO_IDS[0]!);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ conversationToken: "fake-token" });
    expect(JSON.stringify(body)).not.toMatch(/scam|real|agent/);
    expect(voice.sessions).toEqual([{ callerId: "scenario_scam" }]);
    expect((await post(handler, "nobody")).status).toBe(400);
  });

  it("gives both shared agents one voice, one opening and the disclosure", () => {
    const [a, b] = SCENARIO_AGENT_KEYS.map(id => buildScenarioAgentConfig(id));
    expect(a!.conversationConfig.tts).toEqual(b!.conversationConfig.tts);
    expect(a!.conversationConfig.agent!.firstMessage).toBe(b!.conversationConfig.agent!.firstMessage);
    expect(a!.conversationConfig.agent!.firstMessage!.startsWith(DISCLOSURE)).toBe(true);
    for (const cfg of [a!, b!]) {
      const agent = cfg.conversationConfig.agent!;
      expect(cfg.conversationConfig.conversation!.maxDurationSeconds).toBe(180);
      expect(cfg.platformSettings!.privacy!.recordVoice).toBe(false);
      expect(agent.prompt!.prompt).toMatch(/stop drill/);
      const used = new Set([...`${agent.prompt!.prompt} ${agent.firstMessage}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]!));
      expect([...used].sort()).toEqual(Object.keys((agent.dynamicVariables as { dynamic_variable_placeholders: object }).dynamic_variable_placeholders).sort());
    }
  });

  it("keeps the catalog prompts out of the browser", async () => {
    const out = await build({ entryPoints: ["app/dashboard/Dashboard.tsx"], bundle: true, platform: "browser", format: "esm", write: false, logLevel: "silent", external: ["react", "react-dom", "react/*", "@elevenlabs/client"], loader: { ".css": "empty" } });
    const js = out.outputFiles.map(file => file.text).join("");
    for (const leak of ["scenario_scam", "scenario_real", "Say you need the practice protection code", "Never say what kind of caller"]) expect(js).not.toContain(leak);
  }, 30_000);
});
