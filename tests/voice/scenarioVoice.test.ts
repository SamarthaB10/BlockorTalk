import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { FakeVoiceAdapter } from "../../lib/voice/adapter";
import { browserSessionHandler } from "../../lib/voice/browserSession";
import { callVariables } from "../../lib/voice/callers";
import { SCENARIO_AGENT_KEYS, buildScenarioAgentConfig } from "../../lib/voice/scenarioAgents";
import { SCENARIO_CALLERS, SCENARIO_VARIABLE_NAMES, VOICE_SCENARIO_IDS, scenarioVoiceVariables } from "../../lib/voice/scenarioVoice";
import { scenarioCatalog } from "../../lib/season/scenarios/catalog";

const DISCLOSURE = "It's recorded for your report. Say 'stop drill' anytime.";
const post = (handler: ReturnType<typeof browserSessionHandler>, callerId: string) =>
  handler(new Request("https://tell.test/api/voice/session", { method: "POST", body: JSON.stringify({ callerId }) }));

describe("catalog voice", () => {
  it("gives every catalog caller its own Japanese name, apart from the Challenge callers", () => {
    const names = scenarioCatalog.map(row => SCENARIO_CALLERS[row.id]);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(scenarioCatalog.length);
    for (const name of names) expect(["Yui", "Ren", "Kai", "Aki", "Jordan"]).not.toContain(name);
    for (const row of scenarioCatalog) expect(scenarioVoiceVariables(row.id)!.caller_name).toBe(SCENARIO_CALLERS[row.id]);
  });

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

  it("ships Practice this call without the Drill Planner, call types or scenario versions", async () => {
    const out = await build({ entryPoints: ["app/dashboard/Dashboard.tsx"], bundle: true, platform: "browser", format: "esm", write: false, metafile: true, logLevel: "silent", external: ["react", "react-dom", "react/*", "@elevenlabs/client"], loader: { ".css": "empty" } });
    const js = out.outputFiles.map(file => file.text).join("");
    expect(js).toContain("Practice this call");
    const inputs = Object.keys(out.metafile!.inputs);
    expect(inputs).toContain("app/dashboard/NewsAlerts.tsx");
    for (const server of ["lib/practice/planner.ts", "lib/practice/script.ts", "lib/season/scenarios/server.ts", "lib/voice/personas.ts"]) expect(inputs, server).not.toContain(server);
    for (const leak of ["ask_line", "next_step", "Please read me your fictional", "Drill Planner for Tell", "Details as proof"]) expect(js, leak).not.toContain(leak);
  }, 30_000);
});
