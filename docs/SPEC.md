---
title: "Tell — scam-call drills that teach you to hear the tell"
labels: [ready-for-agent]
event: HackUTD 2026 "Zero Day" (24 h, due Sun Nov 8, 12:00 PM CT — confirm)
tracks: T-Mobile Safe Signal, NVIDIA "Use Nemotron Beyond a Chatbot"
---

# Tell — scam-call drills that teach you to hear the tell

## Problem Statement

Phone scams work because they happen live, under pressure, and often sound right: the caller knows your name, your bank, even your last purchase. People can recite "never share your PIN," yet still read a one-time code to a calm, convincing caller who already knows their details. Reading tips or watching a training video doesn't build that reflex. Large studies of embedded phishing training show almost no effect, mostly because people never engage with the material. People also overcorrect: someone who hangs up on everything misses real calls from their bank, carrier or delivery service. Nobody gives ordinary people a safe way to practice telling a real call from a scam, on their own phone, before the real thing happens.

## Solution

Tell is a web app that runs practice phone calls. The user picks themes (banking, shopping/delivery, phone provider) and a difficulty. Each drill starts with a scenario card: a recent event ("Yesterday you spent $23.40 at Chipotle") and fake secrets to protect (a date of birth, a home address, a card ending, a PIN, sometimes a one-time code that appears mid-call). Then the user's real phone rings. The AI caller is a scammer, a legitimate caller, or a "hijacked" caller who knows the real details but asks for a secret anyway. After hang-up the user answers "Could you tell?" (real or scam, plus confidence) and gets an after-call report. The report grades them against four portable rules, not against the specific scam:

1. Never share codes, PINs, passwords or SSN — whoever is calling.
2. Pressure is the tell — urgency, secrecy, or an odd payment method.
3. Knowing your details doesn't prove who's calling.
4. The move: hang up and call back on a number you already have.

A Nemotron Drill Planner agent chooses each drill, targeting the rule the user breaks most, and builds the persona. A Nemotron Debrief agent scores the call. A Today screen turns current FTC scam alerts into one-tap practice drills. A detector (TF-IDF baseline vs Nemotron) labels scam type and red flags, both in debriefs and in a paste-a-message Guardian screen. Tell tracks hit rate and false-alarm rate over time, so it can show learning without teaching paranoia.

Besides full drills, Tell has a deck of battle cards: one scammer line per card, a 3–5 turn practice round by voice or text, and the exact safest next action to say and do. The Debrief agent hands the user the card for the move that got them in their last drill.

## User Stories

### Onboarding and settings
1. As a new user, I want to sign up with only my first name and phone number, so that I can start practicing in under a minute.
2. As a new user, I want to verify my phone number before any call is placed, so that Tell never calls someone who didn't opt in.
3. As a new user, I want to pick which themes I practice (banking, shopping/delivery, phone provider), so that drills match the scams I worry about.
4. As a new user, I want to choose a difficulty (obvious, moderate, convincing), so that drills match my skill.
5. As a new user, I want to see the four rules once during onboarding, so that I know what I'm being graded on.
6. As a user, I want to change themes, difficulty and preferred voice later, so that practice stays relevant.
7. As a user, I want a clear explanation that every secret in Tell is fake and I must never say real details, so that I feel safe taking calls.
8. As a user, I want to turn on surprise mode with a time window, so that drills arrive when I'm not expecting them, like real scams.

### Starting a drill
9. As a user, I want a single "Start drill" button, so that practice takes one tap.
10. As a user, I want to see a scenario card before the call (theme, what happened, what I'm protecting), so that I have the context a real person would have.
11. As a user, I want the scenario card to look identical for scam, legit and hijacked calls, so that the card never gives the answer away.
12. As a user, I want the fake secrets on the card to be fresh for every drill, so that I can't memorize them.
13. As a user, I want my phone to ring within seconds of starting, so that the drill feels real.
14. As a user, I want calls to always come from the same Tell number, so that I recognize practice calls in my call log.

### During the call
15. As a user, I want the caller to sound like a real person with a consistent persona and company, so that practice transfers to real calls.
16. As a user, I want some callers to be genuinely legitimate, so that I learn when it's safe to engage, not just to hang up.
17. As a user, I want hijacked callers who know my real (card) details and still ask for a secret, so that I learn that knowing my details is not proof.
18. As a user, I want a one-time code to pop up in the app mid-call on hijacked drills, so that I practice the exact moment scammers exploit.
19. As a user, I want to see the claimed caller, a timer, the voice orb and the four rules on screen during the call, so that I stay oriented.
20. As a user, I want to say "stop drill" at any time to end the call immediately, so that I'm always in control.
21. As a user, I want the caller to break character if I start saying something that sounds like real personal data, so that I never leak anything real.
22. As a user, I want an End drill button in the app, so that I can stop without speaking.
23. As a user, I want scammers with believable, funny quirks, so that drills are fun enough to keep doing.

### Verdict and debrief
24. As a user, I want to answer "Could you tell?" (Real or Scam) and how sure I am after hang-up, so that my judgment is measured, not just my behavior.
25. As a user, I want an after-call report within seconds of hang-up, so that feedback arrives while the call is fresh.
26. As a user, I want to see which rules I kept or broke, with the moment in the call, so that I know exactly what to change.
27. As a user, I want the red flags the caller used marked on the transcript, so that I learn to hear them.
28. As a user, I want to learn who the caller really was (persona and call type) only after my verdict, so that the reveal teaches something.
29. As a user, I want a gentle, non-shaming explanation when I hang up on a legit call, including how I could have checked, so that I don't become afraid of every call.
30. As a user, I want the report to recommend my next drill based on my weakest rule, so that practice adapts to me.
31. As a user, I want to see the agent's steps (what it planned and why), so that I can trust the system isn't random.

### Progress
32. As a user, I want a progress view of scams caught over time, so that I can see myself improving.
33. As a user, I want my false-alarm rate (legit calls I rejected) shown beside it, so that I know I'm not just becoming paranoid.
34. As a user, I want to see which rules I keep breaking, so that I know what to focus on.
35. As a user, I want a gallery of personas I've faced, marked caught or missed, so that practice feels like progress.

### Today threats (news)
36. As a user, I want a Today screen with 3–4 current scams from official FTC alerts, so that I know what's going around.
37. As a user, I want each threat tagged with its theme and its red flags in a few bullets, so that I can understand it at a glance.
38. As a user, I want a "Practice this" button on each threat, so that I can drill against a scam that's in the news today.
39. As a user, I want a banner when a trending scam matches my themes, so that I'm warned about what affects me.

### Guardian
40. As a user, I want to paste a suspicious text or call transcript and get a verdict with honest confidence and next steps, so that Tell helps outside drills too.
41. As a user, I want the Guardian verdict to use the same four rules as my drills, so that advice is consistent everywhere.

### Safety and privacy
42. As a user, I want Tell to never ask me for, or store, real personal or financial data, so that using it carries no risk.
43. As a user, I want transcripts redacted before they're stored, so that an accidental slip isn't kept.
44. As a user, I want every persona to use fictional company names, so that Tell never impersonates a real business.

### Team, judges and evaluation
45. As a judge, I want to watch a live three-call demo (obvious scam, legit, hijacked) on a real phone, so that I can see the product work end to end.
46. As a judge, I want to see the Planner and Debrief agents' multi-step tool use live, so that I can tell Nemotron is more than a chatbot.
47. As a judge, I want detection accuracy for a baseline and for Nemotron, on held-out data and real scam calls, so that I can judge accuracy honestly.
48. As a judge, I want pilot results reported with n, hit rate and false-alarm rate on themes the participants never practiced, so that I can judge whether learning transfers.
49. As a team member, I want the demo sequence to be reproducible on demand, so that the stage demo doesn't depend on randomness.
50. As a team member, I want to swap in T-Mobile's synthetic data if it becomes available, so that we use the official set without rework.
51. As a team member, I want every persona checked against 8 receiver personalities before demo day, so that no persona breaks the rules on stage.

### Battle cards
52. As a user, I want to practice just the moment I keep failing, so that I build the reflex without a full call.
53. As a user, I want the exact words to say back to a scammer, so that I'm not stuck mid-call.
54. As a user, I want each card to explain why the line works on people, so that I understand the trick, not just the answer.
55. As a user, I want to practice a card by voice or by text, so that I can train even when I can't take a call.
56. As a user, I want the card for the move I fell for recommended after each drill, so that practice targets my weak spot.
57. As a user, I want to turn a Today threat into a battle card, so that I can rehearse against a scam that's in the news.
58. As a user, I want to see which cards I've mastered, so that I know I'm improving.
59. As a team member, I want every card checked automatically against simulated receivers, so that no card breaks on stage.

### Detection
60. As a judge, I want accuracy for a baseline and for Nemotron on real scam calls, not just synthetic data, so that I can trust the detection claim.
61. As a judge, I want to watch the risk meter rise during a live call, so that I can see detection happening in real time.
62. As a user, I want the detector to say "can't tell" when it's unsure, so that it never gives me false confidence.
63. As a user, I want my real bank's urgent calls not flagged as scams, so that I keep trusting legitimate callers.

### Try it without signing up
64. As a judge or first-time visitor, I want to try a drill in my browser with no signup and no phone number, by voice or by text, so that I see what Tell does in under 30 seconds.
65. As a visitor, I want a one-line intro before the try-it drill ("What would you say to Ray?") and a clear "AI practice caller" label, so that I know it's a safe simulation.
66. As a user, I want every drill capped in length (a set number of my replies or minutes, whichever comes first), so that a drill never drags and costs stay predictable.
67. As a visitor, I want the landing page to show real pilot results (n, hit rate, false-alarm rate before and after), so that I believe it works.

## Implementation Decisions

**Product rules**
- Call-type mix per session: about 60% scam, 25% legit, 15% hijacked. Hijacked maps to the "convincing" difficulty. The demo uses a fixed sequence: Derek (banking scam) → Dana (phone-provider legit) → Ray (phone-provider hijacked).
- The four rules live in one policy definition. Persona prompts, Debrief scoring, verdict copy and the Guardian all read from it.
- Scoring has two parts. Behavior: whether any fake secret appears in the user's turns (exact string match), whether they complied, verified, or hung up, and when. Judgment: whether the Real/Scam verdict was correct, weighted by confidence. Falling for a scam or hijacked call is a large penalty; rejecting a legit call is a small one.
- Progress metrics: hit rate (scams correctly called scam) and false-alarm rate (legit calls called scam), stored per drill as time-series.
- Anti-shortcut rules: a shared pool of four voices assigned randomly regardless of call type; one opening-line template for every type; mixed demeanor (hijacked callers are the warmest, some legit callers are brisk); an identical card layout for all types.
- Fictional brands only: Lonestar Bank, ParcelPoint, ShopNest, Nimbus Mobile.
- Drill caps: every drill (phone, browser voice or text) ends after 12 user replies or 3 minutes, whichever comes first. The cap and "you can end it at any time" are shown on the scenario card.
- Caller label: every persona is labelled "AI practice caller" in the app (never "scam" or "legit"), so the label is honest without giving away the call type.
- Try-it mode (no signup): a public page runs a drill in the browser by voice (ElevenLabs web session, same agent) or by text (Nemotron directly), with no phone number and no account. It offers three fixed personas, one per call type, ends in the same "Could you tell?" verdict and after-call report, and stores nothing beyond anonymous outcome counts. This is the judges' path; the real-phone drill stays the headline demo.
- Landing page: the tagline ("Every scam has a tell"), a Try-it button, a Start-drill signup, and the pilot's before/after hit rate and false-alarm rate with n, filled in from tonight's results.
- Scenario card secrets: every card carries a fake date of birth and a fake home address alongside the card ending, PIN and (on some drills) a one-time code. Scam personas ask for these identity details first, before payment details, because real scam calls ask for identity details far more often than for payment credentials.
- Persona quirks: every persona keeps its serious script beats, so the drill still teaches the four rules, and adds ONE comic quirk taken from real scam-baiting behavior:
  - Derek (bank scam): reads his script too literally and restarts it when interrupted.
  - Priya (delivery scam): keeps cheerfully lowering the "redelivery fee".
  - Kevin (SIM-swap scam): gets audibly stressed about his supervisor listening in.
  - Ray (hijacked, demo finale): too smooth; compliments you for being "so security-conscious" right before asking for the code.
  - Legit personas: mild realism only (a hold-music joke, typing sounds), never pushy.
  Quirks must never reveal the call type, so legit callers get quirks too.

**Modules**
- **Drill service (the main seam).** Interface: start a drill for a user (optionally from a threat), receive a post-call event, record a verdict, get a report, get progress. It coordinates everything below, and every external system sits behind an adapter so it can be replaced with a fake.
- **Drill Planner agent (Nemotron, multi-step with tools).** Tools: read the user's profile and rule history; search similar scam dialogues by vector similarity; fetch current threats; write the persona card; place the call. It outputs a persona card (below) and logs each step.
- **Debrief agent (Nemotron).** Input: the persona card, transcript and verdict. Output: rules kept or broken with timestamps, red flags hit, behavior and judgment scores, and the next recommended target rule. Each step is logged.
- **Policy and scoring.** Encodes the four rules, the exact-match leak check over fake secrets, and redaction of real-looking data (card-number and SSN patterns) before storage.
- **Voice adapter (ElevenLabs Agents).** Places outbound calls through the SIP-trunk outbound-call API with the persona passed as dynamic variables, and verifies and parses the post-call transcription webhook (HMAC signature; idempotent on the conversation ID because retries resend the same payload).
- **Telephony configuration (Photon Spectrum Voice).** The Photon iMessage line is imported into ElevenLabs as a SIP-trunk number: TLS to Photon's SIP server on port 5061, digest auth with the project ID and secret, media encryption disabled (Photon carries plain RTP), caller ID must be a line owned by the same project. Photon is the phone line only; it has no voice webhooks, so call results come from ElevenLabs.
- **LLM adapter (Nemotron via NVIDIA's OpenAI-compatible API).** Agents use a larger Nemotron (`nemotron-3-super-120b-a12b`, with `llama-3.3-nemotron-super-49b-v1.5` as backup). The live call tries a small fast model (`nvidia-nemotron-nano-9b-v2`) as ElevenLabs' custom LLM. If first-token latency is too high, the live call falls back to ElevenLabs' built-in model and Nemotron stays on the agents.
- **Detector.** Three versions behind one interface (TF-IDF baseline, Nemotron zero-shot, Nemotron + retrieval), each returning label, scam type, tactic-tagged red flags and confidence; see Detection below. Used by the Debrief agent, battle-card recommendations, the Guardian screen and the evaluation script.
- **Threat ingest.** Pulls FTC consumer alerts (primary) and NewsAPI headlines (secondary, free tier: 24-hour delay, 100 requests/day, development use only) on the server every few hours. Nemotron tags each item with a theme and red flags; results are cached.
- **Web app (Next.js, dark, Apple-clean).** Screens: onboarding, home (Start drill, Today, progress), scenario card, live call (voice orb, claimed caller, timer, rule strip, code pop-up, End drill), verdict, after-call report with persona reveal, agent log drawer, Guardian, settings.

**Persona card (decision shape, from the design pass)**
```json
{
  "persona_name": "Ray",
  "claimed_org": "Nimbus Mobile Security",
  "theme": "phone_provider",
  "call_type": "hijacked",
  "voice_id": "<shared pool>",
  "demeanor": "calm, authoritative",
  "card_facts": {"plan": "Unlimited Plus", "last_bill": "$71.18"},
  "fake_secrets": {"date_of_birth": "1991-03-14", "home_address": "418 Pecan Hollow Dr, Plano TX", "account_pin": "8302", "live_code": "551 274"},
  "script_beats": ["verify name", "cite last bill", "warn of port-out", "ask for live code", "press once if refused"],
  "red_flags": ["details_as_proof", "asks_for_code"],
  "rules_tested": [1, 3]
}
```
The card is sent to the voice agent as dynamic variables and saved on the drill, so the Debrief agent knows exactly what was planted.

**Data (TigerData / Tiger Cloud Postgres with TimescaleDB, pgvector and pgvectorscale)**
- Regular tables: users (first name, verified phone, themes, difficulty, voice, surprise window), drills (theme, call type, persona card, fake secrets, conversation ID, verdict, confidence), scam examples (dialogue, type, label, embedding with a StreamingDiskANN index).
- Hypertables: call turns, drill outcomes (behavior, judgment, hit/false-alarm flags), agent steps, threats.
- Seed data:
  - Scammer persona source: BothBosu/multi-agent-scam-conversation (Hugging Face, Apache-2.0). Columns: dialogue, personality, type, label. Scam types: ssn, refund, support, reward. Non-scam types: delivery, insurance, telemarketing, wrong. The Planner pulls 2–3 example dialogues per scam type into each persona prompt as script references.
  - Legit caller style: talkmap/telecom-conversation-corpus (200k synthetic telecom support calls, MIT) and talkmap/banking-conversation-corpus (300k, MIT). A few agent turns serve as style examples for the legit personas (Maria, Tom, Dana): calm, specific, never pushy. These are customer-initiated calls, so they are adapted to outbound.
  - Scammer flavor: 436-4/youtube-scam-conversations (20 real scam-baiting transcripts, Apache-2.0). Used for persona quirks and as held-out real calls in the pilot.
  - Detector train/test: BothBosu/scam-dialogue (1.28k train / 320 test), unchanged.
  - If T-Mobile's synthetic set arrives, it is swapped in behind the same loader.

**Battle cards**
Battle cards are short, focused practice rounds. Each card is one scammer move, and the user practices the safest next action against it, like sales battle cards but for scam calls. Full drills test the user; battle cards build the reflex for the exact moment they keep failing.
- Card fields: theme; tactic (authority, urgency, details-as-proof, reward, fear); the scammer line; the persona who delivers it; the safest next action (the exact words to say + what to do); the rule it trains (1–4); why it works on people (one line).
- Practice loop: the persona delivers the line and pushes back using its quirk. The user responds by voice (same ElevenLabs agent, short session) or by text (Nemotron directly). The round ends when the user reaches a safe action (refuses + verifies through a known number, or hangs up) or leaks a fake secret (exact-match check, same as drills).
- Scoring: pass/fail on safety, plus the number of turns taken. Mastered = 2 safe passes in a row.
- Deck for v1: 3 cards per theme (banking, shopping, phone provider) = 9 cards, written from the existing nine personas.
- Recommendation: the Debrief agent picks the card matching the tactic and rule the user broke in their last drill. "Practice this" on a Today threat can create a card through the Drill Planner.
- Storage: cards as regular rows; each practice attempt as a time-series row (user, card, pass/fail, turns, timestamp) feeding a mastery grid on the progress screen.
- Example card:
  - Theme: phone provider · Tactic: details-as-proof · Persona: Ray, Nimbus Mobile Security
  - Line: "I just texted you a code — read it back so I can cancel the port."
  - Safest next action: say "I don't share codes. I'll call Nimbus back on the number in my app," then hang up.
  - Trains: rule 1 + rule 4 · Why it works: he already knows your plan and bill, so he feels real.

**Detection**
We do not fine-tune or train Nemotron. Nemotron is used as-is, and its weights never change. The Hugging Face data has three jobs:
1. Train a tiny TF-IDF + logistic-regression baseline (seconds, scikit-learn). Its only purpose is to give Nemotron something to beat.
2. Act as an example pool for retrieval: for each call, fetch the 5 most similar labeled dialogues from TigerData (pgvector) and put them in Nemotron's prompt as examples.
3. Act as held-out test sets that produce the accuracy numbers.

- Data roles (strict split, no leakage):

  | Data | Role |
  | --- | --- |
  | BothBosu/scam-dialogue train split | Train the baseline + the retrieval example pool in TigerData |
  | BothBosu/scam-dialogue test split | Scoring only, never used as examples |
  | 436-4/youtube-scam-conversations + FTC robocall transcripts (wspr-ncsu/robocall-audio-dataset) | Real-call scoring only, never used as examples |
  | 30–50 hard negatives: urgent-sounding legit calls (real fraud alerts, delivery problems) generated with Nemotron + talkmap support calls | False-positive scoring only |
  | BothBosu/multi-agent-scam-conversation + talkmap corpora | Persona prompts only, not detection |

  Deduplicate across splits; the evaluation must assert that no test item is in the example pool.
- Three detector versions behind one interface, all returning label, scam type, red-flag spans tagged with tactics (authority, urgency, details-as-proof, reward, fear), and confidence:
  1. TF-IDF baseline.
  2. Nemotron zero-shot with structured output.
  3. Nemotron + retrieval (5 nearest labeled examples from pgvector). This is the production detector.
  If T-Mobile provides their baseline classifier, add it as a fourth comparison.
- Unsure band: below 60% confidence the detector says "Can't tell — verify by calling back on a number you already have" instead of guessing.
- Turn-by-turn scoring: the detector can run after each call turn and record the first turn where it flags correctly (time to detection).
- Spectator mode: during a live drill, a risk meter on the presenter screen only (never on the user's phone, so drills stay honest) rises turn by turn and shows tactic labels as red flags appear. Used in the stage demo.
- The detector feeds the Debrief agent (red flags on the transcript) and battle-card recommendations.

**API contract (shape, not routes)**
- Start drill → returns the drill ID and scenario card; the call is placed asynchronously.
- Post-call webhook → verified, idempotent; stores redacted turns and triggers Debrief.
- Submit verdict → Real/Scam + confidence (50/75/100).
- Get report → rules, flags, reveal, scores, next target, agent steps.
- Get progress → time series of hit rate, false-alarm rate, rule breaks.

## Testing Decisions

- **A good test** drives the system only through its public interface and asserts on externally visible results: the report, the progress numbers, what was stored, what the fake vendors were asked to do. It never asserts on prompts, internal function calls or intermediate data structures. Tests must survive a rewrite of the agents' internals.
- **Seam 1 — drill service, end to end (primary; most tests live here).** Real Postgres (Tiger, or local TimescaleDB with pgvector for CI). Fakes replace the voice adapter (records outbound-call requests and emits recorded post-call webhook payloads), the LLM adapter (returns fixed plans and scores for given inputs), the threat feeds, and the clock. Scenarios to cover:
  - A scam drill where the transcript contains a fake secret: behavior is scored as a leak, rule 1 is broken at the right timestamp, and hit rate stays unchanged.
  - A legit drill where the user says "scam": counted as a false alarm, small penalty, the "how you could have checked" explanation is present.
  - A hijacked drill where the user refuses the code and calls back: rules 1, 3 and 4 kept, counted as a hit.
  - A duplicate webhook delivery doesn't double-count outcomes.
  - A webhook with a bad signature is rejected and stores nothing.
  - A real-looking card number or SSN in the transcript is redacted before storage.
  - The Planner targets the user's most-broken rule and respects the type mix over many drills.
  - "Practice this" on a threat produces a drill whose persona traces back to that threat.
  - The demo seed produces the exact Derek → Dana → Ray sequence.
  - Calls are never placed to an unverified number.
  - A drill ends at the reply or time cap, and the report is still produced.
  - A try-it drill places no call, needs no account, and stores only anonymous outcome counts.
- **Seam 2 — detector evaluation script.** Given a dataset split, it scores every detector version (baseline, Nemotron zero-shot, Nemotron + retrieval, and T-Mobile's baseline if provided):
  - Accuracy, precision, recall, F1, false-positive rate and a confusion matrix, on (a) the synthetic test split, (b) real calls, (c) hard negatives.
  - Unseen-type test: example pool limited to ssn + refund, scored on support + reward, to show it learned tactics, not scripts.
  - Time to detection: average turn of first correct flag.
  - Calibration: bucket predictions by confidence and compare to actual accuracy.
  - Leakage check: fails if any test item appears in the example pool.
  Tests use a tiny labeled fixture with known answers to verify every metric.
- **Seam 3 — Persona QA (text only, no phone calls).** Nemotron plays each of 8 receiver personalities (aggressive, anxious, confused, distracted, greedy, polite, skeptical, and one more still to be chosen) against all 9 personas, for 72 text conversations. Checks run on the conversation transcript only:
  - Every scam and hijacked persona asks for at least one fake secret.
  - No legit persona ever asks for a secret.
  - "Stop drill" ends the conversation within one turn.
  - The persona breaks character when the receiver says something that looks like a real card number or SSN.
  - No real company names appear.
  - The opening line matches the shared template for every call type.
  Output: a pass/fail table per persona × personality, plus saved transcripts, which double as demo material and as evidence of Nemotron multi-step use for the NVIDIA track.
- **Battle cards** are tested through the drill service seam: start a card, send scripted user turns, assert the outcome (safe action ends the round as a pass; a leaked fake secret is caught as a fail; mastery flips after 2 consecutive passes; the Debrief recommendation matches the last broken rule).
- **Persona QA also covers battle cards:** every card runs against the 8 simulated receiver personalities (text only), checking that a safe response ends the round and a leak is detected.
- **No separate UI test seam.** The UI is checked by hand against the demo script. Optional smoke checks only if time allows.
- **Prior art:** none; the repo is empty. These seams set the pattern for later tests.

## Out of Scope

- Connecting real bank, calendar or telecom accounts (OAuth, Plaid, Nessie); personas use typed-in profile facts only.
- Intercepting or screening the user's real incoming calls in real time.
- Answering scammers on the user's behalf (scam-baiting).
- Caregiver accounts, scheduling for others, or multi-user households.
- Native mobile apps; Tell is a mobile-responsive web app.
- Inbound calls to the Tell number, and iMessage/SMS conversations through Photon.
- Languages other than English.
- User-created custom cards and sharing decks between users.
- Claims about retention or long-term behavior change; the pilot is same-session only.
- Production compliance (Photon business-profile registration, NewsAPI paid tier, consent and recording-law review per state).

## Further Notes

- **Transfer is the key claim to defend.** An 8-month randomized trial with about 19,500 UC San Diego Health employees found embedded phishing training reduced failure rates by only about 1.7%, mainly because people didn't engage with the material. Tell's answer is live voice practice with feedback in seconds, adapting to the rule you keep breaking. Tonight's pilot: 10–15 consenting hackers do a pre-test on held-out items (phone-provider calls, real scam clips, one legit call), then 3 drills on banking and shopping only, then a post-test on different held-out items. Report n, hit rate, false-alarm rate and rule-correct actions, and present the results honestly even if nothing moves.
- **Integration risks to clear in the first hour:** the phone ringing via ElevenLabs → Photon with two-way audio; each Nemotron model ID responding on the hosted endpoint; per-call voice override enabled in the ElevenLabs agent (fallback: one agent per voice); a public URL for the webhook.
- **Fallbacks:** Photon SIP fails → place calls from an ElevenLabs/Twilio number. Live-call Nemotron too slow → ElevenLabs built-in model. Webhook missing → poll the conversation by ID after hang-up.
- **Prior art: Scam Vaccine (scamvaccine.gov.sg, Singapore Open Government Products, from Hack for Public Good 2026).** From its public pages: an AI scammer talks to you by voice call or message (bank and police impersonation), there's a no-signup demo capped at 12 replies or 3 minutes, real users get safe versions of newly detected scam variants by call or WhatsApp, and a debrief lists the red flags and what to watch next. Its headline results are satisfaction numbers (100% wanted more exercises, 96% supported a rollout). Judges may know it, so the pitch says plainly where Tell differs:
  - **Legit and hijacked calls, not only scams.** Tell measures false alarms, so it can show people get better without becoming paranoid.
  - **Measured learning, not satisfaction.** Pre/post hit rate and false-alarm rate on themes participants never practiced.
  - **Adaptive practice.** The Planner targets the rule you break most, and battle cards drill the exact move that got you.
  - **Detection with real numbers.** Baseline vs Nemotron vs Nemotron + retrieval, on real calls and hard negatives, plus the live risk meter.
  - **Your real phone rings**, plus a no-signup browser mode matching theirs.
- **Three-minute stage run:** (1) hook: the one-line problem plus "Every scam has a tell"; (2) a judge's phone rings live with Derek, then Ray, with the spectator risk meter on the big screen; (3) the after-call report and the battle card it hands over; (4) one slide of results: pilot before/after and detection F1 on real calls vs baseline; (5) "try it now" QR code to the no-signup page. Rehearse with the demo seed, and have the text try-it mode ready as the fallback if the phone line fails on stage.
- **Detection pitch slide:** one big number (F1 on real calls, Nemotron + retrieval vs baseline); a small table of the 3 versions × synthetic / real / hard negatives / false-positive rate; a time-to-detection chart; one honesty line ("synthetic training data; real-call test set is small, n = …").
- **If time is short (detection):** keep the baseline, Nemotron + retrieval, real-call scoring, time to detection, the spectator meter and the unsure band. Drop the calibration plot and the unseen-type test.
- Diagrams live in `docs/img/`: architecture, persona matrix, and the live-call and reveal screens.
- No issue tracker is configured for this repo yet. This file stands in for the tracker issue, labeled `ready-for-agent`. GitHub Issues can replace it once the team sets them up.
