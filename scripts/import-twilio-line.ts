/**
 * Imports a Twilio Voice number into ElevenLabs for "Call my phone".
 *
 * Free path: Twilio trial number + ElevenLabs Agents free call minutes.
 * Trial Twilio can only dial numbers you verified under Verified Caller IDs.
 *
 *   node --env-file=.env.local --import tsx scripts/import-twilio-line.ts
 *
 * Reads (never pass these on the command line, never commit them):
 *   ELEVENLABS_API_KEY
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   E.164, e.g. +15125550123
 *
 * Prints the ElevenLabs phone-number ID for ELEVENLABS_PHONE_NUMBER_ID.
 * Keep ELEVENLABS_PHONE_PROVIDER=twilio (the default).
 */
import { elevenLabs } from "../lib/voice/client";

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main() {
  const phoneNumber = required("TWILIO_PHONE_NUMBER");
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) throw new Error("TWILIO_PHONE_NUMBER must be E.164");

  const client = elevenLabs();
  const existing = await client.conversationalAi.phoneNumbers.list({ provider: "twilio" });
  const already = existing.find((p) => p.phoneNumber === phoneNumber);
  if (already) {
    console.log(`Already imported: ELEVENLABS_PHONE_NUMBER_ID=${already.phoneNumberId}`);
    return;
  }

  const res = await client.conversationalAi.phoneNumbers.create({
    provider: "twilio",
    phoneNumber,
    label: "Block or Talk · Twilio trial",
    sid: required("TWILIO_ACCOUNT_SID"),
    token: required("TWILIO_AUTH_TOKEN"),
  });
  console.log(`Imported: ELEVENLABS_PHONE_NUMBER_ID=${res.phoneNumberId}`);
  console.log("Set ELEVENLABS_PHONE_PROVIDER=twilio and add your verified phone to TELL_TEAM_PHONES.");
}

main().catch((err) => {
  // Never print the request (it carries the Twilio token).
  console.error(err?.body ?? String(err?.message ?? err));
  process.exit(1);
});
