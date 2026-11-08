import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** One turn of a finished call, as ElevenLabs reports it. */
export interface CallTurn {
  role: "agent" | "user";
  message: string;
  timeInCallSecs: number;
}

export interface PostCallTranscript {
  conversationId: string;
  agentId: string;
  status: string;
  durationSecs: number | null;
  turns: CallTurn[];
}

export interface PostCallDeps {
  /** HMAC secret ElevenLabs shows when the workspace webhook is created. */
  secret: string;
  /**
   * Atomically claims a conversation ID. Returns false if it was already
   * processed: ElevenLabs retries resend the same payload.
   */
  claim(conversationId: string): Promise<boolean>;
  /** Undoes a claim when storing failed, so the ElevenLabs retry is processed. */
  release(conversationId: string): Promise<void>;
  /**
   * Hands the transcript to the drill service, which redacts real-looking data
   * before storing and then triggers the Debrief agent.
   */
  onTranscript(t: PostCallTranscript): Promise<void>;
  /** Deletes the conversation from ElevenLabs once stored (docs/SPEC.md data handling). */
  deleteConversation(conversationId: string): Promise<void>;
  /** Signature verifier; defaults to the ElevenLabs SDK helper. */
  verify?: (rawBody: string, signature: string, secret: string) => Promise<unknown>;
}

const sdkVerify = (rawBody: string, signature: string, secret: string) =>
  // constructEvent only checks the signature locally; it makes no API call.
  new ElevenLabsClient({ apiKey: "unused-for-signature-check" }).webhooks.constructEvent(
    rawBody,
    signature,
    secret,
  );

function parseTranscript(event: any): PostCallTranscript | null {
  if (event?.type !== "post_call_transcription") return null;
  const d = event.data ?? {};
  if (typeof d.conversation_id !== "string" || !d.conversation_id) return null;
  const turns: CallTurn[] = (Array.isArray(d.transcript) ? d.transcript : [])
    .filter((t: any) => (t?.role === "agent" || t?.role === "user") && typeof t.message === "string")
    .map((t: any) => ({
      role: t.role,
      message: t.message,
      timeInCallSecs: Number(t.time_in_call_secs ?? 0),
    }));
  return {
    conversationId: d.conversation_id,
    agentId: String(d.agent_id ?? ""),
    status: String(d.status ?? ""),
    durationSecs:
      typeof d.metadata?.call_duration_secs === "number" ? d.metadata.call_duration_secs : null,
    turns,
  };
}

/**
 * POST handler for the ElevenLabs post-call webhook. Web-standard
 * Request → Response, so a Next.js route file can re-export it.
 */
export function postCallWebhookHandler(deps: PostCallDeps) {
  const verify = deps.verify ?? sdkVerify;
  return async function POST(req: Request): Promise<Response> {
    const raw = await req.text();
    const signature = req.headers.get("elevenlabs-signature") ?? "";
    let event: unknown;
    try {
      if (!deps.secret) throw new Error("webhook secret not configured");
      event = await verify(raw, signature, deps.secret);
    } catch {
      return new Response("invalid signature", { status: 401 });
    }

    const transcript = parseTranscript(event);
    // Other event types (audio, call-initiation failures) are acknowledged and ignored.
    if (!transcript) return new Response("ignored", { status: 200 });

    if (!(await deps.claim(transcript.conversationId))) {
      return new Response("duplicate", { status: 200 });
    }
    try {
      await deps.onTranscript(transcript);
    } catch {
      await deps.release(transcript.conversationId);
      return new Response("store failed", { status: 500 });
    }
    try {
      await deps.deleteConversation(transcript.conversationId);
    } catch {
      // Best effort: retention is already 1 day on the agent, so a failed delete still expires.
    }
    return new Response("ok", { status: 200 });
  };
}
