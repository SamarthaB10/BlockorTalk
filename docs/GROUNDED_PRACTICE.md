# Dataset-based practice

This path connects the labelled Hugging Face corpus to the app: Tiger DB stores the examples, Nemotron generates a caller script from five retrieved examples, and ElevenLabs speaks the caller lines and transcribes recorded replies. Open `/practice`. The API is `/api/practice/generated`. The existing scripted `/api/practice` route remains separate.

## Source and split

The source is [BothBosu/scam-dialogue](https://huggingface.co/datasets/BothBosu/scam-dialogue), already used by the detector. It contains synthetic conversations labelled scam (`1`) or non-scam (`0`) and uses Apache-2.0. This feature does not use the linked [teeconnie Kaggle dataset](https://www.kaggle.com/datasets/teeconnie/scam-and-non-scam-call-conversation-dataset): that source lists CC BY-NC-ND 4.0 and says it is not intended for testing against real users.

The import preserves the published 80/20 split. It never moves evaluation examples into the prompt pool. The existing loader removes two known duplicate training rows, leaving 1,278 prompt examples and 320 held-out examples (approximately 80% and 20%). Both groups are balanced by label: 639/639 and 160/160. Duplicate checks run before writing; a unique content hash also prevents the same normalized conversation from appearing in both groups in the database.

`practice_examples` records the source, label, type, split and content hash. `practice_datasets` publishes a complete import only after all stored rows match the checked corpus. Embeddings are reused from `detection_examples`, with the same corpus fingerprint and `nvidia/nemotron-3.5-embed-1b` at 1,024 dimensions. Repeating the import verifies and reuses the data. It does not request embeddings again when the index is complete.

Runtime retrieval requires BOTH `practice_examples.split = 'prompt'` and `detection_examples.split = 'train'`, with matching IDs, text and labels. Held-out examples cannot enter this query. The 80% is the eligible example pool; each prompt uses five examples, not the entire pool.

The labels are ground truth for the original dataset conversations. A new scenario is generated content, with a planned label and script checks. Matching that planned label is a practice result, not evidence of held-out detector accuracy. The existing `python -m detection.evaluate` command measures detector predictions against the untouched evaluation labels. No Nemotron weights are trained by this feature.

## Import

Use Python with the existing `requirements.txt` dependencies. The script chooses `.venv/bin/python` if present; set `PYTHON` for another interpreter.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run practice:index
```

The command loads `.env.local` through Node, uses `DATABASE_URL_DIRECT`, and applies the additive practice migration. It downloads the corpus through the existing loader. If Python cannot find a trusted certificate store, set `SSL_CERT_FILE` to a trusted CA bundle; do not disable TLS verification. Database errors are reported without connection strings.

The same migration can be applied through `npm run migrate`. That alone does not populate the dataset; run the import before starting practice.

## App and speech

- Finance and seasonal packages use the same neutral interface and can each produce either caller label.
- The server selects the planned label, retrieves five examples with that label and asks Nemotron to write the questions and a separate explanation.
- The browser receives only the current transcript and source counts before the verdict. It receives the planned label, explanation and source IDs only after the verdict.
- The planner receives the same fictional card facts as the player. For a scam plan, code supplies an explicit final request for the one-time code, so a safe warning about codes cannot be graded as a scam.
- The four-turn script is generated once. Replies advance the script; this is not an adaptive live ElevenLabs Agents conversation. Nemotron's generated questions are spoken through ElevenLabs TTS.
- A call ends after four replies, three minutes, End call, or `stop drill`. Recorded replies stop at 20 seconds and must be checked and sent by the player.
- Fake-secret matches are scored before text redaction. Likely personal details are removed before storage using the shared `safeText` function.
- The scenario and transcript are stored in `practice_sessions` and restored with a private cookie. Tell does not store audio. ElevenLabs receives audio for transcription and text for speech; its own retention settings still apply.
- Speech failure leaves text mode available. Model errors, malformed scripts and rate limits return an explicit error; they do not silently invent a scenario or report success.

Models: `nvidia/nemotron-3.5-super-vl-120b-a12b` for planning (`NEMOTRON_PRACTICE_MODEL` can override it), `eleven_flash_v2_5` for speech, `scribe_v2` for transcription, and Matilda's voice ID already used by Yui. There is no new agent provisioning and no real-phone call.

## Cloudflare

The page and API run in the existing vinext Worker. Runtime needs `DATABASE_URL`, `NVIDIA_API_KEY` and `ELEVENLABS_API_KEY`. They remain server-only. The import uses the direct database connection locally, before deployment. Credentials and dataset downloads stay out of Git. No new package dependency is required.

The current Worker is `tell-health`. Check its secret names and the Git-connected build before rollout. Building or opening the PR does not prove that this route has been deployed. A merge can trigger Workers Builds; use the PR checks and deployment result to establish the actual state.
