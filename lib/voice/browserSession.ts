import { VoiceRequestError, type ScenarioAgentKey, type VoiceAdapter } from "./adapter";
import { CHALLENGE_CALLER_IDS, type ChallengeCallerId } from "./callers";
import { isVoiceScenario } from "./scenarioVoice";

export interface BrowserSessionDeps {
  voice: VoiceAdapter;
  /** Picks which shared catalog agent answers. The choice stays on the server. */
  drawScenarioAgent?: () => ScenarioAgentKey;
}

const NO_STORE = { "Cache-Control": "no-store" };
const drawScenarioAgent = (): ScenarioAgentKey => (Math.random() < 0.5 ? "scenario_real" : "scenario_scam");

/** POST handler: issues a WebRTC session token for a Challenge caller or a voiced catalog scenario. */
export function browserSessionHandler(deps: BrowserSessionDeps) {
  return async function POST(req: Request): Promise<Response> {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid json" }, { status: 400, headers: NO_STORE });
    }
    const callerId = body?.callerId;
    const challenge = typeof callerId === "string" && CHALLENGE_CALLER_IDS.includes(callerId as ChallengeCallerId);
    const catalog = typeof callerId === "string" && isVoiceScenario(callerId);
    if (!challenge && !catalog) {
      return Response.json({ error: "unknown caller" }, { status: 400, headers: NO_STORE });
    }
    try {
      const sessionCaller = challenge ? callerId as ChallengeCallerId : (deps.drawScenarioAgent ?? drawScenarioAgent)();
      const { agentId, conversationToken } = await deps.voice.createBrowserSession({ callerId: sessionCaller });
      // A catalog session omits the agent id: it would tell the browser which agent answered.
      return Response.json(catalog ? { conversationToken } : { agentId, conversationToken }, { headers: NO_STORE });
    } catch (err) {
      // Only the numeric status leaves the server: it tells a bad key (401) from a
      // missing agent (404) without exposing the vendor's message.
      const code = (err as { statusCode?: unknown })?.statusCode;
      const upstreamStatus = typeof code === "number" ? code : undefined;
      // The vendor's error code (e.g. invalid_agent_id) names the cause in the Worker log.
      // Its message text, the key and the token are never logged or returned.
      const detail = (err as { body?: { detail?: { code?: unknown; param?: unknown } } })?.body?.detail;
      const vendorCode = typeof detail?.code === "string" ? detail.code : undefined;
      const param = typeof detail?.param === "string" ? detail.param : undefined;
      const local = err instanceof VoiceRequestError ? err.message : undefined;
      console.error("browser voice session failed", upstreamStatus ?? "no status", vendorCode ?? local ?? "", param ?? "");
      return Response.json(
        { error: "voice session unavailable", ...(upstreamStatus ? { upstreamStatus } : {}) },
        { status: 502, headers: NO_STORE },
      );
    }
  };
}
