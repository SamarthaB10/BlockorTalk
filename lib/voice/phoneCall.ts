import { SCENARIOS } from "../practice/catalog";
import { VoiceRequestError, VoiceUpstreamError, type ScenarioAgentKey, type VoiceAdapter } from "./adapter";
import { CHALLENGE_CALLER_IDS, type ChallengeCallerId } from "./callers";
import { SCENARIO_VARIABLE_NAMES, scenarioVoiceVariables } from "./scenarioVoice";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const drawScenarioAgent = (): ScenarioAgentKey => (Math.random() < 0.5 ? "scenario_real" : "scenario_scam");

/** E.164 from what a person types. A bare 10-digit number is read as US. */
export function phoneNumber(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const digits = value.replace(/[\s().-]/g, "");
  const e164 = /^\d{10}$/.test(digits) ? `+1${digits}` : /^1\d{10}$/.test(digits) ? `+${digits}` : digits;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** Pull a short vendor message for logs / safe UI hints. Never returns API keys or tokens. */
function vendorText(err: unknown): string {
  const body = err instanceof VoiceUpstreamError ? err.body : (err as { body?: unknown })?.body;
  if (typeof body === "string") return body;
  const detail = (body as { detail?: unknown } | null | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const msg = (detail as { message?: unknown }).message;
    const code = (detail as { code?: unknown }).code;
    const status = (detail as { status?: unknown }).status;
    return [typeof code === "string" ? code : "", typeof status === "string" ? status : "", typeof msg === "string" ? msg : ""]
      .filter(Boolean)
      .join(" ");
  }
  if (err instanceof VoiceRequestError) return err.message;
  return "";
}

/** Map vendor / local failures to a short UI error. Keeps secrets and raw vendor dumps out of the browser. */
export function phoneCallUserError(err: unknown): { error: string; status: number } {
  const local = err instanceof VoiceRequestError ? err.message : "";
  if (/ELEVENLABS_PHONE_NUMBER_ID|No valid ElevenLabs agent ID/.test(local)) {
    return { error: "Phone calls aren’t set up yet.", status: 503 };
  }
  const code = err instanceof VoiceUpstreamError ? err.statusCode : (err as { statusCode?: unknown })?.statusCode;
  const text = vendorText(err).toLowerCase();
  if (code === 401 || code === 403) return { error: "Voice API key was rejected. Check ELEVENLABS_API_KEY on the Worker.", status: 502 };
  if (/unverified|not verified|trial/.test(text)) {
    return { error: "Twilio trial can only dial Verified Caller IDs. Verify this phone in Twilio, then retry.", status: 502 };
  }
  if (/phone.?number|agent_phone|phnum|not found|invalid.*agent/.test(text) || code === 404) {
    return { error: "Phone line or agent ID looks wrong. Re-check ELEVENLABS_PHONE_NUMBER_ID and that provider is twilio.", status: 502 };
  }
  if (/sip|trunk/.test(text) && /twilio|provider/.test(text)) {
    return { error: "Phone provider mismatch. Set ELEVENLABS_PHONE_PROVIDER=twilio on the Worker.", status: 502 };
  }
  if (/Outbound call failed:/.test(local)) {
    return { error: "ElevenLabs refused the dial. Check Twilio call logs and the imported number in ElevenLabs.", status: 502 };
  }
  return { error: "The call didn’t go through. Try again in a moment.", status: 502 };
}

/**
 * POST { callerId, to }: an agent rings a real phone. Team testing only: it dials nothing but the
 * numbers in TELL_TEAM_PHONES, which stand in for the SMS verification the spec needs before Tell
 * may call anyone else.
 */
export function phoneCallHandler(deps: { voice: VoiceAdapter; teamPhones: readonly string[]; drawScenarioAgent?: () => ScenarioAgentKey }) {
  const team = new Set(deps.teamPhones.map(phoneNumber).filter((n): n is string => Boolean(n)));
  return async function POST(req: Request): Promise<Response> {
    if (req.headers.get("origin") !== new URL(req.url).origin) return json({ error: "Use the dashboard to place a call." }, 403);
    let body: { callerId?: unknown; to?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const to = phoneNumber(body?.to);
    if (!to) return json({ error: "Enter a phone number, for example (512) 555-0123." }, 400);
    const callerId = typeof body.callerId === "string" ? body.callerId : "";
    const challenge = SCENARIOS.find(item => item.id === callerId && CHALLENGE_CALLER_IDS.includes(callerId as ChallengeCallerId));
    const catalog = challenge ? null : scenarioVoiceVariables(callerId);
    if (!challenge && !catalog) return json({ error: "Choose a scenario to call with." }, 400);
    if (!team.has(to)) return json({ error: "Only team test phones can get a call right now." }, 403);
    try {
      await deps.voice.placeCall(challenge
        ? { callerId: challenge.id, toNumber: to, phoneVerified: true, variables: challenge.voiceVariables }
        : { callerId: (deps.drawScenarioAgent ?? drawScenarioAgent)(), toNumber: to, phoneVerified: true, variables: catalog!, variableNames: SCENARIO_VARIABLE_NAMES });
      // Nothing about the agent goes back: for a catalog call it would reveal the Version.
      return json({ calling: true });
    } catch (err) {
      const code = err instanceof VoiceUpstreamError ? err.statusCode : (err as { statusCode?: unknown })?.statusCode;
      const text = vendorText(err);
      console.error("phone call failed", typeof code === "number" ? code : "no status", text.slice(0, 240));
      const out = phoneCallUserError(err);
      return json({ error: out.error }, out.status);
    }
  };
}
