# Tell

*Every scam has a tell.*

Tell trains people to spot phone scams by calling their real phone with AI callers. Some are scams, some are legitimate, and some are "hijacked" callers who know your details but still want your code. You decide if each call is real before you give anything away. Built at HackUTD 2026 for the T-Mobile Safe Signal and NVIDIA Nemotron tracks.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Architecture: [docs/img/architecture.png](docs/img/architecture.png)
- Personas: [docs/img/persona-matrix.png](docs/img/persona-matrix.png)
- Screens: [docs/img/persona-screens.png](docs/img/persona-screens.png)

Stack: Next.js · NVIDIA Nemotron · ElevenLabs Agents · Photon Spectrum Voice · TigerData

## Run locally

Install Node.js 24 and run `npm install`. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `DATABASE_URL_DIRECT`, `NVIDIA_API_KEY`, and `ELEVENLABS_API_KEY`. Use the pooled database URL for the app and the direct URL for migrations. Keep this file private.

Run `npm run migrate` to apply the migrations using `DATABASE_URL_DIRECT` from `.env.local`. Run `npm run dev` and open the local URL shown in the terminal. The health page reports whether the database is reachable and whether the two vendor keys are present; it does not check whether the vendor keys are valid.

Run `npm test` for the health checks and `npm run typecheck` for the type check. For Cloudflare, set the three runtime variables `DATABASE_URL`, `NVIDIA_API_KEY`, and `ELEVENLABS_API_KEY` as Worker secrets. Run migrations separately with the direct URL.
