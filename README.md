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

Run `npm test` for the health checks and `npm run typecheck` for the type check. The detection baseline is separate: install Python 3.12, run `pip install -r requirements.txt`, then run `python -m detection.evaluate --detectors baseline`. That command downloads the dialogue files into `data/cache` on first use, trains the TF-IDF baseline, and prints synthetic-test metrics, the real-call detection rate, and the hard-negative false-alarm rate. The hard negatives shipped in `data/` are team-written fraud-alert and delivery calls plus ten talkmap support calls. `python -m unittest tests.test_detection` runs the metric and leakage checks without those downloads. For the zero-shot and production retrieval detectors, train-only embedding setup, and the full three-way comparison, see [the detection guide](docs/DETECTION.md). For Cloudflare, set the three runtime variables `DATABASE_URL`, `NVIDIA_API_KEY`, and `ELEVENLABS_API_KEY` as Worker secrets. Run migrations separately with the direct URL.

## Challenge day in text (issues #5 and #6)

Open `/challenge`. Play Yui, Ren, then Kai. End each call and give a verdict,
then select Next call. Real books Yui's interview; Unverified plus the candidate
portal also books it. Sharing Ren's fictional gift-card code costs $350.
Kai's code appears after the third reply. Sharing it costs $650 and fails the
bank task. Spaces, punctuation and spoken digits count as sharing a code.
Money posts after the verdict. A verdict alone never moves money.

After Kai's call, open Corvanta Bank and select Call Corvanta. Finish the short
text chat with Aki to resolve the bank task. A callback cannot undo a code leak.
The result shows the balance, both tasks and all three verdicts. A perfect day
ends at $1,000 with the interview booked and the bank alert resolved.

Run `npm run migrate` before playing. For local Workers development, copy the
private `.env.local` file to the ignored `.dev.vars` file, restrict it to the
owner (`chmod 600 .dev.vars`), then restart `npm run dev`. Workers reads its local
secrets from `.dev.vars`. Migration 002 adds `tell_challenges`.
The database stores the day, each call result and timestamped Verify events together.
A private browser cookie restores the current day after reload for 24 hours.
Play again starts a new day and keeps the previous record. This Challenge page
stores transcripts; it is not the anonymous try-it route, which has a different
storage policy.

The callers use approved text beats. Yui follows the recruiter script: confirm Alex, confirm Tuesday
at 10 AM, point to the candidate portal, then close. Nemotron selects from approved
lines for the current beat. The gift-card code is 4729 in this text day, as required by issue #6; voice defaults are separate. This keeps secret requests and call-type disclosures
out of its replies. The default model is `nvidia/nemotron-3.5-bolt-e4b`;
set the optional server variable `NVIDIA_MODEL` to change it. The Nano model named
in the original spec returned HTTP 410 during this task. If the model fails or
returns an invalid choice, the call uses a fixed line and labels the script path.
No call is placed and ElevenLabs is not used by this page.

For the drill-service tests, set `TEST_DATABASE_URL` to a disposable Postgres
connection and run `node --test tests/challenge.test.mjs`. Each test makes and
removes its own schema; the account must have permission to create schemas.
Without this variable, database tests are skipped. CI starts Postgres and runs
these tests. Use `npm test` for the complete suite and `npm run typecheck` for types.

Manual checks: play each verdict path, check the portal, type `stop drill`, send
12 replies, wait three minutes, and reload during the call and after the verdict.
The board must keep its balance, tasks and verdict. The portal must show Tuesday
at 10 AM and say Bluebonnet never charges for equipment.
