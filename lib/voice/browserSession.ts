import type { VoiceAdapter } from "./adapter";
import { CHALLENGE_CALLER_IDS, type ChallengeCallerId } from "./personas";

export interface BrowserSessionDeps {
  voice: VoiceAdapter;
}

const NO_STORE = { "Cache-Control": "no-store" };

/** POST handler: issues a WebRTC session token for one Challenge caller. */
export function browserSessionHandler(deps: BrowserSessionDeps) {
  return async function POST(req: Request): Promise<Response> {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid json" }, { status: 400, headers: NO_STORE });
    }
    const callerId = body?.callerId;
    if (typeof callerId !== "string" || !CHALLENGE_CALLER_IDS.includes(callerId as ChallengeCallerId)) {
      return Response.json({ error: "unknown caller" }, { status: 400, headers: NO_STORE });
    }
    try {
      const { agentId, conversationToken } = await deps.voice.createBrowserSession({
        callerId: callerId as ChallengeCallerId,
      });
      return Response.json({ agentId, conversationToken }, { headers: NO_STORE });
    } catch {
      return Response.json({ error: "voice session unavailable" }, { status: 502, headers: NO_STORE });
    }
  };
}
