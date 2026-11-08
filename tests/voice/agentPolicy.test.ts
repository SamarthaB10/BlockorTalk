import { describe, expect, it } from "vitest";
import { buildAgentConfig, TRAINING_PURPOSE } from "../../lib/voice/agentConfig";
import { CHALLENGE_CALLER_IDS } from "../../lib/voice/personas";
import { SCENARIO_AGENT_KEYS, buildScenarioAgentConfig } from "../../lib/voice/scenarioAgents";

// ElevenLabs blocked the Ren, Kai and Practice caller B agents under its prohibited-uses
// policy: their prompts opened with "you are actually running a scam" and "you know the
// player's real card details". Every prompt must now open by stating it is a consented,
// fictional fraud-awareness exercise, and the role text must not read as a real fraud script.
const prompts = [
  ...CHALLENGE_CALLER_IDS.map((id) => [id, buildAgentConfig(id).conversationConfig.agent!.prompt!.prompt!] as const),
  ...SCENARIO_AGENT_KEYS.map((id) => [id, buildScenarioAgentConfig(id).conversationConfig.agent!.prompt!.prompt!] as const),
];

describe.each(prompts)("agent prompt %s", (_id, prompt) => {
  it("opens with the fraud-awareness training purpose", () => {
    expect(prompt.startsWith(TRAINING_PURPOSE)).toBe(true);
  });

  it("does not frame the role as a real fraud or real customer data", () => {
    for (const phrase of [/actually running/i, /hijacked/i, /real card details/i, /\bscam(ming)?\b/i]) {
      expect(prompt, String(phrase)).not.toMatch(phrase);
    }
  });
});
