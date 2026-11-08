import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { DISCLOSURE_LINE, DRILL_MAX_SECONDS } from "./disclosure";
import { BEATS, PERSONAS, SHARED_GUARDRAILS, type ChallengeCallerId } from "./personas";

/**
 * Live calls use an ElevenLabs-hosted model by default (docs/SPEC.md, "Agent and
 * voice decisions"). Nemotron Nano as a custom LLM is switched on only if it beats
 * 800 ms to first word; that lives behind TELL_VOICE_LLM, not here.
 */
export const DEFAULT_VOICE_LLM: ElevenLabs.Llm = "gemini-2.5-flash";

/** Header the `report_beat` server tool sends; its value is an ElevenLabs workspace secret. */
export const BEAT_SECRET_HEADER = "X-Tell-Tool-Secret";
export const BEAT_ROUTE_PATH = "/api/voice/beat";

export interface BeatToolOptions {
  /** Public HTTPS origin of the Tell app, e.g. https://tell.example.com */
  publicUrl: string;
  /** ID of the ElevenLabs workspace secret holding the shared tool secret. */
  toolSecretId: string;
}

export interface AgentConfigOptions {
  llm?: ElevenLabs.Llm;
  /** Omit until the app has a public URL: agents then run without live beats. */
  beatTool?: BeatToolOptions;
}

/** Every `{{name}}` placeholder used in a string (system variables excluded). */
export function placeholdersIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    const name = m[1]!;
    if (!name.startsWith("system__")) names.add(name);
  }
  return [...names];
}

export function systemPromptFor(id: ChallengeCallerId): string {
  return `${PERSONAS[id].persona}\n\n${SHARED_GUARDRAILS}`;
}

export function firstMessageFor(id: ChallengeCallerId): string {
  return `${DISCLOSURE_LINE} ${PERSONAS[id].openingLine}`;
}

function beatTool(opts: BeatToolOptions): ElevenLabs.PromptAgentApiModelOutputToolsItem {
  const url = new URL(BEAT_ROUTE_PATH, opts.publicUrl);
  if (url.protocol !== "https:") throw new Error("TELL_PUBLIC_URL must be https");
  return {
    type: "webhook",
    name: "report_beat",
    description:
      "Tell the Tell app that a scripted moment just happened in this practice call. Call it silently; do not mention it to the player.",
    responseTimeoutSecs: 5,
    preToolSpeech: "off",
    executionMode: "async",
    apiSchema: {
      url: url.toString(),
      method: "POST",
      requestHeaders: { [BEAT_SECRET_HEADER]: { secretId: opts.toolSecretId } },
      requestBodySchema: {
        type: "object",
        required: ["beat", "conversation_id"],
        properties: {
          beat: {
            type: "string",
            enum: [...BEATS],
            description: "Which scripted moment just happened.",
          },
          conversation_id: {
            type: "string",
            dynamicVariable: "system__conversation_id",
            description: "The current conversation ID.",
          },
        },
      },
    },
  };
}

/**
 * The full create/update body for one Challenge agent. Pure: no API calls, so
 * it is unit-tested and the provisioning script just sends it.
 */
export function buildAgentConfig(
  id: ChallengeCallerId,
  opts: AgentConfigOptions = {},
): ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost {
  const p = PERSONAS[id];
  const prompt = systemPromptFor(id);
  const firstMessage = firstMessageFor(id);

  const missing = [...placeholdersIn(prompt), ...placeholdersIn(firstMessage)].filter(
    (n) => !(n in p.variables),
  );
  if (missing.length) {
    throw new Error(`Persona ${id} uses undeclared variables: ${[...new Set(missing)].join(", ")}`);
  }

  const tools = opts.beatTool ? [beatTool(opts.beatTool)] : [];

  return {
    name: p.agentName,
    tags: ["tell", "challenge", id],
    conversationConfig: {
      agent: {
        firstMessage,
        language: "en",
        // The disclosure must be heard in full before the player can talk over it.
        disableFirstMessageInterruptions: true,
        maxConversationDurationMessage: "We're out of time for this practice call. Goodbye!",
        dynamicVariables: { dynamicVariablePlaceholders: { ...p.variables } },
        prompt: {
          prompt,
          llm: opts.llm ?? DEFAULT_VOICE_LLM,
          temperature: 0.5,
          builtInTools: { endCall: { name: "end_call", params: { systemToolType: "end_call" } } },
          tools,
        },
      },
      tts: { voiceId: p.voiceId },
      conversation: { maxDurationSeconds: DRILL_MAX_SECONDS },
    },
    platformSettings: {
      // Browser sessions need a server-issued token, so the try-it page can't be hot-linked.
      auth: { enableAuth: true },
      callLimits: { dailyLimit: 300 },
      // Data handling from docs/SPEC.md: no voice recording, short retention.
      // Tell also deletes each conversation once its post-call webhook is processed.
      privacy: { recordVoice: false, deleteAudio: true, retentionDays: 1 },
      guardrails: {
        version: "1",
        focus: { isEnabled: true },
        promptInjection: { isEnabled: true },
      },
    },
  };
}
