# Block or Talk

*Every scam has a tell.*

Block or Talk trains people to spot phone scams by talking to AI callers. Some callers are scams, some are legitimate, and some are "hijacked": they know your real details and still want your code. You decide whether each call is real before you give anything away. Built at HackUTD 2026 for the T-Mobile Safe Signal and NVIDIA Nemotron tracks.

**Live:** https://blockortalk.blockortalk.workers.dev

## Inside the app

| Where | You get |
|---|---|
| `/dashboard` → **Scenarios** | 18 practice calls by browser voice: Yui, Ren, Kai and Aki, plus 14 everyday scams (bank alert, customs fee, IRS, tech support, wrong number and more). Each catalog caller is randomly real or a scam, decided on the server. |
| `/dashboard` → **News** | Current FTC consumer alerts. **Practice this call** asks the Drill Planner to pick the closest scenario and starts it by voice. |
| `/challenge` | The Challenge day: $1,000, two tasks and three calls. Keep your money, finish your tasks, then see the detective reveal and rewind one decision. |
| `/leaderboard`, `/me` | Blokbuks standings and your own call analysis. |
| `/insights` | Carrier insights: totals only, never single calls. |
| `/presenter` | The audience risk meter for a stage run. See [docs/PRESENTER.md](docs/PRESENTER.md). |
| `/health` | Whether the database is reachable and the vendor keys are present. |

Every caller is labelled "AI practice caller", opens with a fixed recording disclosure, and ends after 12 replies or 3 minutes. Nothing on screen hints at a call's type before the reveal. All brands and secrets are fictional.

## How it works

- **Voice.** ElevenLabs Agents run the callers over WebRTC in the browser. Fake secrets reach the agents as dynamic variables, never as prompt overrides. Persona prompts stay on the server.
- **Code decides, the agent explains.** Money, tasks, leaks and rule outcomes are computed in code. Nemotron agents choose drills (Drill Planner), explain results (Debrief agent) and flag tactics (Detector), and each one falls back to a fixed path that is labelled when it runs.
- **Detection.** A TF-IDF baseline, a Nemotron zero-shot detector, and Nemotron with retrieval over a train-only pgvector index. Numbers are in [docs/DETECTION_RESULTS.md](docs/DETECTION_RESULTS.md).

Stack: Next.js app router on Vite (vinext), Cloudflare Workers, Postgres with pgvector (TigerData), NVIDIA Nemotron, ElevenLabs Agents.

Product spec: [docs/SPEC.md](docs/SPEC.md). Product and design truth: [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md). Contributor and agent guide: [AGENTS.md](AGENTS.md).

## Run locally

1. Install Node.js 24 (see `.nvmrc`) and run `npm ci`.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT` (direct, for migrations), `NVIDIA_API_KEY` and `ELEVENLABS_API_KEY`. Keep this file private.
3. Run `npm run migrate` to apply `migrations/*.sql` in order.
4. For Workers dev, copy `.env.local` to `.dev.vars` and run `chmod 600 .dev.vars`.
5. Run `npm run dev` and open the URL it prints.

## Test

```bash
npm run typecheck
npm test                                      # node:test + vitest
npx vitest run tests/dashboard-scenarios.test.ts   # one file
python -m unittest tests.test_detection       # detection checks, no downloads
```

Database tests run only when `TEST_DATABASE_URL` points at a disposable Postgres. Each test creates and drops its own schema; without the variable they are skipped. CI runs the full suite against Postgres 17.

The detection evaluation needs Python 3.12: `pip install -r requirements.txt`, then `python -m detection.evaluate --detectors baseline`. It downloads the dialogue data into `data/cache` on first use. See [docs/DETECTION.md](docs/DETECTION.md) for the zero-shot and retrieval detectors.

## Deploy

The app deploys as the `blockortalk` Cloudflare Worker from `main`. Set these as Worker secrets:

| Secret | Needed for |
|---|---|
| `DATABASE_URL` | everything stored: Challenge days, calls, leaderboard |
| `NVIDIA_API_KEY` | Nemotron agents and the detector |
| `ELEVENLABS_API_KEY` | browser voice and phone calls |
| `TRY_IT_SECRET` | try-it sessions |
| `TELL_TOOL_SECRET` | agents reporting mid-call beats and reading training examples |
| `ELEVENLABS_WEBHOOK_SECRET` | the signed post-call transcript webhook |
| `ELEVENLABS_PHONE_NUMBER_ID` | Call my phone (ElevenLabs ID of the imported Twilio number) |
| `ELEVENLABS_PHONE_PROVIDER` | `twilio` (or `sip_trunk` for Photon) |
| `TELL_TEAM_PHONES` | E.164 team phones allowed for Call my phone |

These names must also be listed in `cloudflare.config.ts` as `bindings.secret()` or `wrangler secret put` will refuse them. Twilio SID/token/number stay in `.env.local` for `npm run voice:import-twilio` only — they are not Worker secrets.

```bash
npx wrangler secret put DATABASE_URL --name blockortalk
```

Run migrations from your machine with the direct URL. Branch previews have no secrets, so database and vendor routes fail there by design.

### Voice agents

`npm run voice:provision` creates or updates the ElevenLabs agents and writes their IDs to `config/voice-agents.json`. It is safe to re-run. `npm run voice:connect-data` adds the protected training-examples tool once the Worker route and tool secret are configured; see [docs/GROUNDED_PRACTICE.md](docs/GROUNDED_PRACTICE.md).

### Calling a real phone (team only)

**Call my phone** rings a real phone via ElevenLabs → Twilio. Only numbers in `TELL_TEAM_PHONES` are dialled. Browser **Play by voice** does not need Twilio.

**Free trial path**

1. [Twilio trial](https://www.twilio.com/try-twilio): get a free Voice number. Under **Verified Caller IDs**, verify the personal phone you want to ring (trial can only dial verified numbers).
2. [ElevenLabs](https://elevenlabs.io) Agents free plan (includes call minutes). Create an API key.
3. Put `ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` in `.env.local`, then run:

```bash
npm run voice:import-twilio
```

   Or import in the ElevenLabs UI: Phone Numbers → Import → Twilio.
4. Set `ELEVENLABS_PHONE_NUMBER_ID` to the printed ID, `ELEVENLABS_PHONE_PROVIDER=twilio`, and `TELL_TEAM_PHONES` to your verified E.164 number(s), e.g. `+15125550123`.
5. Copy `.env.local` to `.dev.vars` (`chmod 600`), restart `npm run dev`. For production: `npx wrangler secret put … --name blockortalk` for the same three phone secrets plus `ELEVENLABS_API_KEY`.

"Only team test phones can get a call right now" means the number isn't in `TELL_TEAM_PHONES`. "Phone calls aren't set up yet" means `ELEVENLABS_PHONE_NUMBER_ID` is missing. Twilio trial accounts can only call numbers verified in Twilio. Set `ELEVENLABS_PHONE_PROVIDER=sip_trunk` only for the Photon line.

## More docs

- [docs/STAGE.md](docs/STAGE.md): the three-minute stage run and its fallbacks
- [docs/TRY_IT.md](docs/TRY_IT.md): the no-signup try-it page
- [docs/BLOKBUKS_SEASON.md](docs/BLOKBUKS_SEASON.md): Seasons, Blokbuks and scoring
- [docs/PERSONA_QA.md](docs/PERSONA_QA.md): caller persona checks
- [lib/insights/README.md](lib/insights/README.md): Carrier insights
