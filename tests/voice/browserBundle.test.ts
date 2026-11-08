import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// What actually ships to the player's browser for a voice call.
async function browserBundle(): Promise<string> {
  const out = await build({
    entryPoints: ["lib/voice/browserCall.ts"],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  return out.outputFiles[0]!.text;
}

describe("browser voice bundle", () => {
  it("carries no persona prompts, so the page can't reveal who is a scam", async () => {
    const js = await browserBundle();
    for (const giveaway of [
      "You are Kai",
      "You are Ren",
      "fake equipment-deposit scam",
      "This is the legitimate bank",
      "Training-drill rules",
      "hijacked",
    ]) {
      expect(js, giveaway).not.toContain(giveaway);
    }
  }, 30_000);
});
