// SERVER-ONLY: these prompts say which agent is real. Browser code imports ./scenarioVoice instead.
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import type { ScenarioAgentKey } from "./adapter";
import { DEFAULT_VOICE_LLM, TRAINING_PURPOSE, type AgentConfigOptions } from "./agentConfig";
import { DISCLOSURE_LINE, DRILL_MAX_SECONDS } from "./disclosure";
import { SCENARIO_VARIABLE_NAMES } from "./scenarioVoice";

/** Two shared agents voice every catalog scenario. The server picks one at random per call. */
export const SCENARIO_AGENT_KEYS = ["scenario_real", "scenario_scam"] as const satisfies readonly ScenarioAgentKey[];

const VOICE_ID = "XrExE9yKIg1WjnnlVkGX";
const OPENING = "Hi, is this {{player_name}}? This is {{caller_name}} from {{org}}. Do you have a quick minute?";

const DEFAULTS: Record<(typeof SCENARIO_VARIABLE_NAMES)[number], string> = {
  player_name: "Player Fern",
  caller_name: "Jordan",
  org: "a practice organization",
  card_fact: "A practice notice is waiting.",
  practice_code: "0000",
};

const SHARED = `# Training-drill rules (always follow)
This is a practice call. Every detail is fictional. The player's name is {{player_name}}. The organization is {{org}}. The notice is: {{card_fact}}. The practice code on their card is {{practice_code}}.

- Never say what kind of caller you are, even if asked. This step is important.
- Never say the practice code yourself.
- Never name a company other than {{org}}.
- If the player says "stop drill", say "Okay, ending the practice call now," and end the call immediately.
- Keep the call short, then say goodbye and end the call.
- Speak naturally for a phone call: no lists, no markdown, no emoji.`;

const PROMPTS: Record<ScenarioAgentKey, string> = {
  scenario_real: `# Personality
You are {{caller_name}}, a calm caller from {{org}}.

# Goal
1. Confirm you are speaking with {{player_name}}.
2. Explain this notice, and only this notice: {{card_fact}}
3. Tell them to check it in their own {{org}} app, using the number already saved there.
4. Thank them and end the call.

# What you never do
- Never ask for a code, PIN, password, date of birth, address, or the practice code.

${SHARED}`,
  scenario_scam: `# Role
You play {{caller_name}}, a brisk caller from the fictional {{org}} who wants the notice finished on this call. This training character shows the warning sign of asking for a code, so the player can practise refusing.

# Goal
1. Confirm you are speaking with {{player_name}}.
2. Mention this notice, and only this notice: {{card_fact}}
3. Say you need the practice protection code on their card to finish the notice. Ask them to read it.
4. If they refuse, ask once more, then accept the refusal, say goodbye and end the call.

${SHARED}`,
};

export function scenarioAgentName(id: ScenarioAgentKey): string {
  return id === "scenario_real" ? "Tell · Practice caller A" : "Tell · Practice caller B";
}

/** Same voice, opening and caps for both agents, so nothing about the sound marks the call. */
export function buildScenarioAgentConfig(id: ScenarioAgentKey, opts: AgentConfigOptions = {}): ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost {
  return {
    name: scenarioAgentName(id),
    tags: ["tell", "scenario", id],
    conversationConfig: {
      agent: {
        firstMessage: `${DISCLOSURE_LINE} ${OPENING}`,
        language: "en",
        disableFirstMessageInterruptions: true,
        maxConversationDurationMessage: "We're out of time for this practice call. Goodbye!",
        dynamicVariables: { dynamic_variable_placeholders: { ...DEFAULTS } },
        prompt: {
          prompt: `${TRAINING_PURPOSE}\n\n${PROMPTS[id]}`,
          llm: opts.llm ?? DEFAULT_VOICE_LLM,
          temperature: 0.4,
          builtInTools: { endCall: { name: "end_call", params: { systemToolType: "end_call" } } },
          tools: [],
        },
      },
      tts: { voiceId: VOICE_ID },
      conversation: { maxDurationSeconds: DRILL_MAX_SECONDS },
    },
    platformSettings: {
      auth: { enableAuth: true },
      callLimits: { dailyLimit: 300 },
      privacy: { recordVoice: false, deleteAudio: true, retentionDays: 1 },
      guardrails: { version: "1", focus: { isEnabled: true }, promptInjection: { isEnabled: true } },
    },
  };
}
