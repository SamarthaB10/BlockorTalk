# Retrieval detector (issue #7)

The detection lane exposes `detect(text)` on `TfidfBaseline` and `NemotronDetector`.
`NemotronDetector(client)` is zero-shot; `NemotronDetector(client, pool)` uses the
five nearest labeled training dialogues from pgvector. `open_detectors(corpus)`
constructs all three with the same corpus. Call it once per server process/session,
then reuse the detectors. Vendor calls run on the server; no key goes to the browser.
This ticket does not attach the detector to the game, Debrief stub, or risk meter.

## Set up and run

Install Python 3.12 and `pip install -r requirements.txt`. Export `NVIDIA_API_KEY`,
`DATABASE_URL` (pooled runtime connection) and `DATABASE_URL_DIRECT` (index load).
The commands below assume those environment variables are set. From this repo,
Node 24 can instead pass the ignored `.env.local` values to Python without printing
them:

```powershell
node --env-file=.env.local -e "const r=require('node:child_process').spawnSync('python',['-m','detection.index'],{stdio:'inherit',env:process.env}); process.exit(r.status ?? 1)"
```

With exported variables, the equivalent commands are:

```text
python -m detection.index
python -m detection.evaluate --workers 4 --output data/cache/comparison.json
python -m detection.evaluate --detectors baseline
python -m detection.evaluate --limit 5 --output data/cache/smoke.json
python -m detection.detect < transcript.txt
```

The index command applies the additive `007_detection_examples.sql` migration
(also supported by `npm run migrate`) and embeds the full checked training split.
It resumes missing rows after interruption. It never inserts held-out transcripts.
The migration creates a 1,024-dimension vector column and HNSW cosine index.
Retrieval uses exact cosine ordering for this small pool, avoiding approximate
index filtering that can return fewer than five examples when corpus versions coexist.
The pool ID fingerprints training membership, labels, sources, and embedding model.
Every retrieved row is checked against the current training manifest, including its text.

The default comparison scores all held-out items with all three detectors. `--limit`
is a reproducible smoke sample per split (seed 7), explicitly labeled as such. The
full corpus is leakage-checked before sampling. Historical issue #3 fixture commands
without `--detectors` retain their canned binary report; use `--detectors all` to
exercise the new confidence-aware comparison. Neither path trains Nemotron.

The live detector model defaults to `nvidia/nemotron-3.5-super-vl-120b-a12b`;
`NEMOTRON_DETECTOR_MODEL` overrides it. Embeddings use
`nvidia/nemotron-3.5-embed-1b` at 1,024 dimensions with `passage` for training and
`query` for retrieval. Older E5 and Llama embedding hosted endpoints returned
HTTP 410 during verification on November 7, 2026. The 3.5 endpoint returned
HTTP 500 for multi-input requests; the adapter uses bounded parallel single-input
requests and preserves order.
See [NVIDIA's embedding API](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-embed-1b)
and [pgvector's index documentation](https://github.com/pgvector/pgvector#hnsw).

## Result and scoring

```json
{
  "label": "scam",
  "scam_type": "impersonation",
  "red_flags": [{"tactic": "urgency", "span": {"start": 0, "end": 9, "text": "right now"}}],
  "confidence": 0.9,
  "message": null
}
```

Tactics are restricted to authority, urgency, details-as-proof, reward, and fear.
Spans use Unicode code-point offsets, end exclusive, in the original transcript;
JavaScript consumers must convert to UTF-16 offsets before slicing emoji-containing
strings. Every span is anchored to an exact quote. The model never supplies offsets.
At confidence below 0.6, or with malformed/unsupported output, the detector emits
`label: null`, `scam_type: null`, no red flags and the exact message:
`Can't tell — verify by calling back on a number you already have`.
Transport failures fail the command with a nonzero exit code rather than inventing
a result. No vendor body or database exception is printed.

The baseline's confidence comes from logistic regression. Its binary training
labels cannot teach scam types, so its `scam_type` is null and its tactic spans are
explicit keyword explanations, not learned tactic predictions.

Reports include synthetic accuracy, precision, recall, F1 and confusion matrix;
real-call detection rate; hard-negative false-alarm rate; median detection seconds
including query embedding/retrieval; and abstention counts for every split.
Abstentions never count as correct and remain in rate denominators. When present,
the confusion matrix adds an uncertain column (rows legit/scam; columns legit/scam/uncertain).
A low false-alarm rate must be read beside coverage: abstaining on everything is
not evidence of a useful detector. Saved JSON contains source, transcript hash,
actual label, result and duration for each scored item; no keys or full input text.
Real-call data is all scams, so no real-call F1 is claimed. Public YouTube material
may have appeared in Nemotron pretraining.

## Verification

```text
python -m unittest tests.test_detection tests.test_detectors
npm run typecheck
npm test
```

Set `TEST_DATABASE_URL` to a Postgres instance with pgvector installed (for example
`pgvector/pgvector:pg17`). Retrieval tests create and remove their own schema. No
live NVIDIA calls run in automated tests; they fake only vendor boundaries. The
dedicated detection workflow runs the real pgvector test in CI.
Before closing #7, run the full comparison and check the production detector on
an obvious scam, an urgent legitimate alert, and an ambiguous one-line message.
Publish the measured report and median times on the issue, including abstentions.
