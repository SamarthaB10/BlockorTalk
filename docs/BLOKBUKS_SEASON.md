# Blokbuks Season: agreed design

Decided in the grilling session on Nov 7, 2026, for the HackUTD deadline (Sun Nov 8, 12:00 PM CT). Terms follow `GLOSSARY.md`. Decisions with lasting weight: `docs/adr/0001`, `docs/adr/0002`.

## Scope tonight

Ships working: email signup, 10 Call scenarios, Blokbuks scoring, results screen, Player analysis, Leaderboard with Season countdown, Carrier insights. Shown but stubbed: prize claims. Untouched: `/challenge`, `/try-it`, `/presenter` (the stage demo). The Challenge does not earn Blokbuks.

## Players

- Signup with email and nickname (3–20 characters, unique, basic profanity blocklist). The Leaderboard shows the nickname, never the email.
- An HttpOnly random session cookie, stored in TigerData, lasts 30 days. Entering an existing email on a new device signs in without verification. **Known gap:** anyone who knows an email can sign in as that Player. Prize claims require email verification and confirming 18+ and US residence.
- All Player data lives in TigerData Postgres. Cloudflare runs the app and holds only the cookie.

## Call scenarios

Ten Categories, each with a real and a scam Version picked at random on every play. Brands are fictional.

| # | Category | Main Tactic |
|---|---|---|
| 1 | Bank fraud alert | Details as proof |
| 2 | Delivery or customs fee | Urgency |
| 3 | Holiday gift card or travel deal | Reward |
| 4 | Business invoice or CEO wire | Authority |
| 5 | Phishing link texted mid-call | Urgency |
| 6 | Tech support | Fear |
| 7 | Government (IRS or SSN) | Authority |
| 8 | Prize or sweepstakes | Reward |
| 9 | Crypto or investment | Reward |
| 10 | Phone carrier port-out | Details as proof |

Tactics are a first pass; adjust per script.

- Every Version has four caller steps: who and why, a credible detail, pressure (the Tactic), and the ask. A scam's ask is a fixed, approved request for a fictional secret; a real caller's ask is a safe next step.
- Nemotron writes steps 1–3 on each play from 5 prompt-split examples retrieved from both corpora (Kaggle and BothBosu) by Category keywords and the Version's Call type. If a Category has fewer than 5 examples of that Call type, fill with the nearest examples of the same Call type from any Category.
- Stored in a TigerData `call_scenarios` table: Category, Tactic, fictional org, card facts, fake secrets and step outlines.
- Play reuses the `/practice` path: ElevenLabs reads the caller's lines and the Player types or records replies. A call ends after 4 replies, 3 minutes, End call, or "stop drill".
- The Call type never reaches the browser before the Verdict.
- No dataset citations on Player screens. Attribution lives on a Credits page. The Kaggle licence is CC BY-NC-ND 4.0: fine for this educational hackathon, but a real T-Mobile launch needs the author's permission or another dataset.

## Scoring

The Scorekeeper labels each reply with a Move (Probe, Protect, Verify, Disconnect, Leak, Comply) and quotes the words behind it. Code awards Blokbuks; keyword rules take over if the model fails ("scored by rules").

| What happens | Blokbuks |
|---|---:|
| Correct Verdict | +100 |
| Wrong Verdict (including calling a real caller a scam) | −50 |
| Unverified, then checked through your own app | +100 |
| Protected a secret | +25 |
| Verified through your own app | +25 |
| Leaked a secret | −100 |

- Scored moments are the replies to steps 2–4, plus the Verdict. Each is right or wrong.
- Players start at 0, and the total never drops below 0.
- Five Scored calls per day; calls beyond that are practice and worth 0 B.
- Leaderboard ties are broken by accuracy, then by who reached the score first.

## Results screen

1. The Call type ("This was a scam call").
2. Each Scored moment with ✓/✗, the Player's words and one plain sentence of why.
3. "4 right · 1 wrong".
4. Blokbuks change, new total and rank change.
5. Scored calls left today.

## Player analysis (`/me`)

First shown after 2 calls and rewritten after every call; practice calls count too. Sections: Commonly missed (top 2 by Tactic and Category, with counts), What you do right, Real callers you rejected, Try next (one Call scenario aimed at the weakest spot). Code computes the counts; the Player analyst writes the sentences.

## Season and Leaderboard

Season 1 starts when deployed and ends 55 hours later. The start, end and prizes live in a `seasons` table: 1st an iPhone 18, 2nd a week of free data, 3rd a $50 gift card. Prizes are shown as "provided by sponsor · rules apply". When the Season ends, scoring stops, the Leaderboard freezes, and the top 3 see a claim stub.

## Carrier insights (`/insights`)

- Totals only, by Category × Tactic × outcome. Groups under 5 Players are hidden. No emails, nicknames, transcripts or per-Player rows.
- Locked by `TELL_INSIGHTS_SECRET`, typed once and then kept in a cookie. CSV export.
- The Insights analyst reads totals only, and rewrites its summary on open when the current one is more than 15 minutes old.
- A seed script adds rows marked `synthetic = true`, behind a clearly labelled "Synthetic demo data" toggle that defaults to real.

## Pages

`/` (landing and signup), `/play` (10 cards, Blokbuks, Scored calls left, countdown), `/play/[id]` (call and results), `/me`, `/leaderboard`, `/insights`, Credits. The old generated-call flow and battle cards on `/practice` fold into `/play`.

## Look

Blokbuks appear as a bold "B" in the app's typeface, white on the dark theme: **B 250**. No coin art and no colour coding. Not childish, never fear-mongering, readable for older adults (`PRODUCT.md`).

## Build order

Branch `feature/blokbuks-season`, cut from `main`:

1. Database tables and signup
2. Call scenarios and the call engine
3. Scorekeeper and the Blokbuks table
4. Results screen
5. Player analysis
6. Leaderboard and Season
7. Carrier insights and synthetic data

Tests come first where a mistake costs money or privacy: the Blokbuks table, the 5-a-day cap, the hide-under-5 rule, and the Call type staying out of the browser.
