# Season call engine

`createCallHandlers` accepts authentication, service and speech adapters. The service accepts the scenario lookup, planner, clock, random draw, store and required finish adapter. `client.ts` and `types.ts` are browser-safe; server modules must never be imported by browser code.

POST `/api/play/calls` with `{type:"start",scenarioId}` returns `{call}` (201). GET `/api/play/calls/[id]` refreshes the call and its deadline. POST that path accepts `reply` with `text`, `end`, `own-app`, `caller-link`, or `verdict` with `Real`, `Scam` or `Unverified`. `speech` returns audio for the stored latest caller line, including the initial disclosure. Multipart `audio` returns `{text}` for review; it never sends the reply. Speech failures leave text actions available. Mutations require the same Origin and a valid Player session; all responses are uncached.

`authenticatePlayer` reads `tell_player` (64 lowercase hex characters), hashes it with SHA-256, and checks `player_sessions` expiry. `currentSeason` reads the most recently started Season. Missing configuration/schema returns an unavailable response, with no invented Player or Season. The Players/Season migration is owned elsewhere and is not recreated here.

The SQL store locks the stable `players` row before counting and reserving Scored starts, including unfinished calls. The production clock is evaluated after that lock, so waits across Central midnight or a Season end use the reservation time. Each start draws a fresh Version. A call has at most four replies or three minutes. GET persists expiry; expired replies are rejected. The stored scenario snapshot keeps the call stable when catalog content changes.

## Finish adapter contract for BS-07

`FinishCall = (tx: Transaction, call: CallRecord) => Promise<Record<string, unknown>>` is required. `Transaction` exposes the already-open PostgreSQL client's `query`; it holds the owned call row lock. The completed input includes the call ID, Player/Season IDs, Version, Scored flag, scenario snapshot, redacted replies with step numbers and leak labels, normalized leak labels, own-app Verify events, Verdict and end time.

Use **this transaction** for all call moments, totals, Season score and analysis writes. Do not open another transaction to update the locked call, commit/roll back `tx`, or perform irreversible external side effects in the adapter. If labeling uses a vendor, bound its time; retries after rollback may invoke it again. The engine sets the Verdict, caches the returned result in `calls.state`, and marks the phase complete in the same transaction. Concurrent/duplicate Verdicts replay that saved result without invoking the adapter again. Failed adapters roll back, allowing retry. The adapter owns scoring columns (`moments`, `right`, `wrong`, `blokbuks_delta`, `scored_by`, `outcome`); the engine does not overwrite them.

Production intentionally returns 503 on Verdict until BS-07 supplies this adapter to `createProductionCallHandlers`. No scores are fabricated. Planning works without a model, corpus or vendor key through spoken fixed fallback lines; the fourth line always comes from the stored approved request/safe next step. The planner sends no secret values to Nemotron. The phishing caller link is exposed only once its third caller line has been delivered, and opening it never creates a Verify event.
