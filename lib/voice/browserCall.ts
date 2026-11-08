import { Conversation } from "@elevenlabs/client";
import { callVariables } from "./adapter";
import type { ChallengeCallerId } from "./personas";

export type TurnRole = "agent" | "user";

export interface BrowserCallHandle {
  /** The End button. */
  end(): Promise<void>;
  /** 0..1 microphone level, 0 before connect. */
  inputLevel(): number;
  /** 0..1 caller level, 0 before connect. */
  outputLevel(): number;
  conversationId(): string | undefined;
}

/** The slice of the SDK session this wrapper uses. */
export interface BrowserSessionLike {
  endSession(): Promise<void>;
  getInputVolume?(): number;
  getOutputVolume?(): number;
}

export type StartSessionFn = (options: any) => Promise<BrowserSessionLike>;

export interface BrowserCallOptions {
  callerId: ChallengeCallerId;
  conversationToken: string;
  /** Scenario-card values; validated against the caller's declared variables. */
  variables: Record<string, string>;
  onTurn(turn: { role: TurnRole; message: string }): void;
  onEnded(info: { reason: string }): void;
  /** Microphone permission was denied: offer text mode. */
  onMicDenied(): void;
  /** Defaults to the SDK's Conversation.startSession. */
  startSession?: StartSessionFn;
}

function isMicDenial(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | string | undefined;
  const name = typeof e === "object" ? e?.name : undefined;
  const msg = typeof e === "string" ? e : (e?.message ?? "");
  return name === "NotAllowedError" || /NotAllowedError|permission denied|microphone.*(denied|blocked)/i.test(msg);
}

/**
 * Starts a WebRTC call to a Challenge agent. Only the conversation token and
 * dynamic variables are sent; no prompt or voice overrides (spec decision).
 */
export async function startBrowserCall(opts: BrowserCallOptions): Promise<BrowserCallHandle | undefined> {
  const dynamicVariables = callVariables(opts.callerId, opts.variables);
  const start: StartSessionFn = opts.startSession ?? ((o) => Conversation.startSession(o));

  let session: BrowserSessionLike | undefined;
  let convId: string | undefined;
  let finished = false;
  let denied = false;

  const finish = (reason: string) => {
    if (finished || denied) return;
    finished = true;
    opts.onEnded({ reason });
  };
  const deny = () => {
    if (denied || finished) return;
    denied = true;
    opts.onMicDenied();
  };

  try {
    session = await start({
      conversationToken: opts.conversationToken,
      connectionType: "webrtc",
      dynamicVariables,
      onConnect: ({ conversationId }: { conversationId: string }) => {
        convId = conversationId;
      },
      onMessage: (m: { message: string; role?: string; source?: string }) => {
        if (denied) return;
        const role: TurnRole = (m.role ?? (m.source === "ai" ? "agent" : "user")) === "agent" ? "agent" : "user";
        opts.onTurn({ role, message: m.message });
      },
      onDisconnect: (d: { reason?: string; message?: string }) => {
        if (d?.reason === "error" && isMicDenial(d.message)) return deny();
        finish(d?.reason ?? "disconnected");
      },
      onError: (message: string) => {
        if (isMicDenial(message)) return deny();
        finish("error");
      },
    });
  } catch (err) {
    if (isMicDenial(err)) {
      deny();
      return undefined;
    }
    finish("error");
    throw err;
  }

  if (denied) {
    await session?.endSession().catch(() => {});
    return undefined;
  }

  const live = session;
  return {
    end: () => live.endSession(),
    inputLevel: () => live.getInputVolume?.() ?? 0,
    outputLevel: () => live.getOutputVolume?.() ?? 0,
    conversationId: () => convId,
  };
}
