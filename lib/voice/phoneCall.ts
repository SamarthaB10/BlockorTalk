import { SCENARIOS } from "../practice/catalog";
import { VoiceRequestError, type ScenarioAgentKey, type VoiceAdapter } from "./adapter";
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
      const local = err instanceof VoiceRequestError ? err.message : "";
      const code = (err as { statusCode?: unknown })?.statusCode;
      console.error("phone call failed", typeof code === "number" ? code : "no status", local);
      if (/ELEVENLABS_PHONE_NUMBER_ID|No valid ElevenLabs agent ID/.test(local)) return json({ error: "Phone calls aren’t set up yet." }, 503);
      return json({ error: "The call didn’t go through. Try again in a moment." }, 502);
    }
  };
}
