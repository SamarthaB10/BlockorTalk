import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "blockortalk",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-08",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DATABASE_URL: bindings.secret(),
      NVIDIA_API_KEY: bindings.secret(),
      ELEVENLABS_API_KEY: bindings.secret(),
      TRY_IT_SECRET: bindings.secret(),
      // Voice / phone (Call my phone + post-call + agent tools)
      TELL_TOOL_SECRET: bindings.secret(),
      ELEVENLABS_WEBHOOK_SECRET: bindings.secret(),
      ELEVENLABS_PHONE_NUMBER_ID: bindings.secret(),
      ELEVENLABS_PHONE_PROVIDER: bindings.secret(),
      TELL_TEAM_PHONES: bindings.secret(),
    },
  }),
});
