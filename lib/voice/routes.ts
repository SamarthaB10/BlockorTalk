import type { VoiceAdapter } from "./adapter";
import { browserSessionHandler } from "./browserSession";
import type { PostCallTranscript } from "./transcript";
import { postCallWebhookHandler } from "./webhook";

/** A live call event the app reacts to (code pop-up, risk meter, call-failed buttons). */
export interface VoiceEvent {
  id: number;
  conversationId: string;
  kind: string;
  detail?: string;
  at: string;
}

/** Persistence the voice routes need; Postgres in the app, faked in tests. */
export interface VoiceStore {
  /** Idempotent on conversation ID in one atomic write. */
  saveTranscript(t: PostCallTranscript): Promise<"stored" | "duplicate">;
  addEvent(e: Omit<VoiceEvent, "id" | "at">): Promise<void>;
  listEvents(conversationId: string, afterId: number): Promise<VoiceEvent[]>;
}

export interface VoiceRouteDeps {
  voice: VoiceAdapter;
  store: VoiceStore;
  /** Shared secret the agents' report_beat tool sends (Worker secret TELL_TOOL_SECRET). */
  toolSecret: string;
  /** HMAC secret of the ElevenLabs post-call webhook (Worker secret ELEVENLABS_WEBHOOK_SECRET). */
  webhookSecret: string;
}

// 13-19 digits, allowing the separators speech-to-text inserts (spaces, commas, dots, dashes).
const CARD_CANDIDATE = /\b\d(?:[ ,.-]{0,2}\d){12,18}\b/g;
const SSN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;

/** The checksum every real card number passes; run-together fake secrets almost never do. */
function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Real-looking card numbers and SSNs never reach storage (docs/SPEC.md, Policy and
 * scoring). Only Luhn-valid digit runs count as card numbers, so a player reading
 * several fake secrets in a row keeps them in the transcript for the leak check.
 */
export function redact(text: string): string {
  return text.replace(CARD_CANDIDATE, redactCardsInRun).replace(SSN, "[redacted SSN]");
}

const CARD_REDACTED = "[redacted card number]";

/**
 * A digit run can hold a card number plus neighbouring values ("4111 1111 1111 1111, 123").
 * Try spans of whole spoken groups (13-19 digits, card prefix 3-6, Luhn-valid), longest
 * first, left to right. Digit-by-digit speech has no groups, so the whole run is tried.
 */
function redactCardsInRun(run: string): string {
  const groups = [...run.matchAll(/\d+/g)].map((g) => ({ start: g.index!, end: g.index! + g[0].length, digits: g[0] }));
  if (groups.every((g) => g.digits.length === 1)) {
    const all = groups.map((g) => g.digits).join("");
    return /^[3-6]/.test(all) && luhnValid(all) ? CARD_REDACTED : run;
  }
  let out = "";
  let cursor = 0;
  let i = 0;
  while (i < groups.length) {
    let matched = -1;
    for (let j = groups.length - 1; j >= i; j--) {
      const digits = groups.slice(i, j + 1).map((g) => g.digits).join("");
      if (digits.length >= 13 && digits.length <= 19 && /^[3-6]/.test(digits) && luhnValid(digits)) {
        matched = j;
        break;
      }
    }
    if (matched < 0) {
      i++;
      continue;
    }
    out += run.slice(cursor, groups[i]!.start) + CARD_REDACTED;
    cursor = groups[matched]!.end;
    i = matched + 1;
  }
  return out + run.slice(cursor);
}

export function createVoiceRoutes(deps: VoiceRouteDeps) {
  const postCall = postCallWebhookHandler({
    secret: deps.webhookSecret,
    store: (t) =>
      deps.store.saveTranscript({
        ...t,
        turns: t.turns.map((turn) => ({ ...turn, message: redact(turn.message) })),
      }),
    onCallFailed: ({ conversationId, reason }) =>
      deps.store.addEvent({ conversationId, kind: "call_failed", detail: reason }),
    deleteConversation: (id) => deps.voice.deleteConversation(id),
  });

  /** GET ?conversation_id=…&after=<last event id>: the app polls this during a call. */
  async function events(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id") ?? "";
    if (!conversationId) return Response.json({ error: "conversation_id required" }, { status: 400 });
    const cursor = Number.parseInt(url.searchParams.get("after") ?? "0", 10);
    const after = Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
    const list = await deps.store.listEvents(conversationId, after);
    return Response.json({ events: list }, { headers: { "Cache-Control": "no-store" } });
  }

  const session = browserSessionHandler({ voice: deps.voice });

  return { session, postCall, events };
}
