# Design Engineering Audit: Block or Talk (current main)

**Perspective**: Design Engineer
**Date**: 2026-11-08
**Plan**: No plan file. Audited the shipped UI on `main` (3305b4c) against `DESIGN.md`, `PRODUCT.md` and `app/globals.css`.

## Plan Summary
The app has two visual systems: a paper landing and dashboard, and a black "passbook" for the Challenge, Play, Me and Leaderboard. This audit checks whether they read as one product.

## Files Reviewed
| File | Visual Role | Risk |
|------|-------------|------|
| app/globals.css | Token foundation (black passbook) | Low |
| app/landing/landing.css, Landing.tsx | Paper landing ("nova") | Medium |
| app/dashboard/dashboard.css, Dashboard.tsx, HubBoard.tsx, Welcome.tsx | Paper practice hub | High |
| app/challenge/challenge.css, ChallengeBoard.tsx, VoiceOrb.tsx, reveal.css | Challenge board and reveal | Medium |
| app/components/AppShell.tsx, app-shell.css | Season shell (Play, Me, Leaderboard) | High |
| app/play/[id]/CallScreen.tsx, play.css, results.css | Season call and results | Medium |
| app/me/me.css, app/leaderboard/season.css | Analysis and standings | Low |

## Verdict: APPROVE WITH CHANGES

## Critical Issues (Must Fix)
| # | Issue | File(s) | Impact | Fix |
|---|-------|---------|--------|-----|
| 1 | Two product names ship at once. Landing and hub say "Block or Talk"; AppShell, the Challenge running head ("TELL"), the footer and PRODUCT.md say "Tell". | AppShell.tsx, ChallengeBoard.tsx, Dashboard.tsx, Landing.tsx | Judges and users see a rename halfway through the demo. | Pick one name and set it in one constant used by every header, footer and `<title>`. |
| 2 | Three different navigation sets. Landing: Dashboard, Leaderboard, Scenarios, News + Challenge. Hub: Home, Scenarios, News, Leaderboard. AppShell: Play, Me, Leaderboard. | Landing.tsx, Dashboard.tsx, AppShell.tsx | People lose their place: "Me" and "Play" vanish on the hub, and "Scenarios" vanishes in the Season shell. | One shared header component with one nav list, used by both paper and passbook pages. |
| 3 | The dashboard bypasses the token system: 75 raw hex values against 4 `var()` uses. It also uses three different "paper" colours (#efece6 landing, #eeece8 hub, #eeeae1 token). | dashboard.css, landing.css, globals.css | The pages drift visually and theme changes need many edits. | Add paper tokens (`--paper-field`, `--paper-ink`, `--paper-dim`, `--paper-line`, `--brand-gradient`) to globals.css and use them in hub and landing. |
| 4 | The Challenge shows the call's context (what you know, what to protect, which number to trust) as one 14px muted `.limits` line. This is the information the whole game is about. | ChallengeBoard.tsx, challenge.css | Players miss the setup, which weakens rule 3 ("knowing your details isn't proof") and rule 4 (call back). | Give it a labelled three-part block: What you know / You protect / Number you trust (see the canvas "5 · On the call"). |

## Recommendations
| # | Issue | File(s) | Why | Fix |
|---|-------|---------|-----|-----|
| 1 | `.hub-card:hover` lifts every card, including plain articles that aren't links. | dashboard.css | It promises a click that does nothing. | Lift only cards that are a whole link, or move the hover to the card's CTA. |
| 2 | In voice mode Probe and Protect are disabled but still say "…, out loud". | ChallengeBoard.tsx | Greyed buttons look broken. | Keep them enabled as hints (show the line to say) or hide them in voice mode. |
| 3 | Three type stacks: Schibsted + Plex Mono (landing), Sora (hub), system-ui (Challenge, Play, Me). | landing.css, dashboard.css, challenge.css, play.css | The hub and the board look like different apps. | Paper pages: Schibsted for display, Plex Mono for labels. Passbook: Sora for display, DotGothic16 only for money, time and codes, as DESIGN.md says. |
| 4 | When a Season call completes, the page says "The results view is not available yet." | CallScreen.tsx | It's a dead end at the most important moment. | Link to `/play/results/[callId]` or show the summary inline. |
| 5 | The code toast is `position: fixed; top: 96px`. It floats over the tasks column, away from the caller it belongs to. | challenge.css | The eye has to jump across the board mid-call. | Anchor it to the caller surface's top right. |
| 6 | The welcome dialog enters in 350ms. | dashboard.css | It runs over the 300ms limit set for UI motion. | Use 240ms with `--ease-out`. |

## Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| 1 | Reuse the landing's conic orange-to-pink frame as a 2–3px top edge on primary paper CTAs. | One brand accent that connects landing, hub and standings. |
| 2 | Put DotGothic16 on the hub's Season clock and Blokbuks. | DESIGN.md reserves it for money, time and codes. |
| 3 | Show the Planner cat on the hub and the Debrief cat on Me/Reveal. | Matches SPRITES_USAGE.md roles and keeps callers mascot-free. |

## Design System Compliance
The black passbook pages (globals.css, reveal.css, season.css, results.css, me.css) use tokens well. The paper pages don't: dashboard.css has 75 raw hex values and its own focus colour (#a23e0b). landing.css keeps a local token set (`--field`, `--text`, `--dim`) that globals.css doesn't know about. Moving those into shared paper tokens would fix most of the drift.

## Visual State Coverage
| Component/Element | Hover | Focus | Active | Disabled | Loading | Empty | Error | Dark Mode |
|-------------------|-------|-------|--------|----------|---------|-------|-------|-----------|
| Hub cards | ⚠ lifts non-links | ✓ | — | — | ✓ alerts text | ✓ | ✓ | n/a (paper only) |
| Hub nav buttons | ✓ | ✓ | ✗ | — | — | — | — | n/a |
| Challenge buttons / moves | ✓ | ✓ | ✓ scale .97 | ⚠ voice-mode copy | ✓ "Starting…" | — | ✓ | ✓ (always dark) |
| Code toast | — | — | — | — | — | — | — | ✓ |
| Season header (AppShell) | ✓ | ✓ | — | — | ✓ | ✓ sign in | ✓ retry | ✓ |
| Play call screen | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Play complete state | — | — | — | — | — | ✗ dead end | — | ✓ |
| Leaderboard | — | ✓ | — | — | ✓ | ✓ | ✓ retry | ✓ |

## Verdict Details
- Design Token Fidelity: CONCERNS (paper pages bypass tokens)
- Visual State Coverage: CONCERNS (Play complete, voice-mode moves)
- Dark Mode Parity: PASS (the app is fixed light paper plus fixed dark passbook by design, not themed)
- Animation Quality: PASS (transform/opacity, reduced motion handled; one 350ms entrance)
- Visual Consistency: CONCERNS (two names, three navs, three type stacks)

Companion mockups for every screen: the "Block or Talk screens" page of the team design canvas.
