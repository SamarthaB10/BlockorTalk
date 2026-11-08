---
name: Block or Talk
description: A paper landing and a black passbook for practice calls.
colors:
  landing-paper: "#efece6"
  landing-ink: "#141414"
  landing-dim: "#625f59"
  gradient-amber: "#ffb347"
  gradient-orange: "#ff8a3d"
  gradient-coral: "#ff5a5f"
  gradient-pink: "#ff3d8b"
  challenge-bg: "#000000"
  challenge-ink: "#f7f5ef"
  challenge-paper: "#eeeae1"
typography:
  landing-display:
    fontFamily: "Schibsted Grotesk, sans-serif"
    fontSize: "clamp(42px, 5.25vw, 92px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-.035em"
  landing-label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: ".04em"
  challenge-display:
    fontFamily: "Sora, system-ui, sans-serif"
    fontWeight: 500
rounded:
  challenge-card: "16px"
  landing-frame: "0px"
spacing:
  mobile-edge: "16px"
  landing-nav-height: "52px"
---

# Block or Talk: the day as a passbook

A black field with warm-white type. The visual structure comes from a ledger and a conversation, with the exported cat sprites as the only live-call colour. Call identity never controls colour or motion.

Sora, self-hosted with its license, supplies the wordmark and display hierarchy. The system face carries readable body copy. DotGothic16, subset and self-hosted with its license, is reserved for measured quantities: money, time and codes. Font loading uses swap and system fallbacks.

One outlined caller surface anchors the board. The ledger and tasks are open, ruled records rather than additional boxes. The neutral companion belongs beside the ledger. On mobile the caller comes first and all four moves remain in a sticky bottom dock. Touch targets remain at least 44px tall.

The intro is a large, restrained two-line proposition beside the sprite, followed by the two concrete tasks and the choice of voice or text. The reveal continues with identity slips, evidence records, and labelled rule outcomes. No decorative gradients, neon, glass, background grids or unrelated illustration.

Motion communicates actual activity. Sprites retain their native canvas and colourways, pause offscreen and in hidden tabs, and use still frames for reduced motion. Earned stamps and reveal transitions use the shared motion foundation. Focus remains visible without jumping the page to the reply field.

## Front landing: paper and sprite display

The front page follows the supplied three-section reference: background #efece6, ink #141414, vertical guides at 17/50/83%, thin rules, fixed announcement and navigation, a right section rail, orange-to-pink conic frame accents, Schibsted Grotesk display type and IBM Plex Mono labels. Fonts are self-hosted from the supplied font sources, with their licenses.

A fixed Three.js 0.160.0 scene renders into reserved grid space in each landing section and carries a charcoal pedestal and the original opaque PNG frames on an unmodified black display. Scroll selects each section’s scene; the renderer follows its reserved bounds so the object never covers copy. The three scenes show the purple Planner, red Detector and green Debrief respectively; these are system roles, not caller trust indicators. The final panel presents the four actual practice rules instead of fictional testimonials. Every launch link leads to /challenge; operational diagnostics live at /health.

Mobile stacks the same 3D scene between the headline and supporting copy, simplifies navigation, and keeps the menu in document flow. Motion can be paused in the footer; OS reduced motion disables typing, carousel autoplay, floating, pointer parallax and spatial entrances. A static sprite display remains if WebGL cannot initialize. No caller details or user data are sent to the scene.

The conversation pane uses one shared palette for every caller: background #100e19, incoming bubbles #251e35 with #f1ecff text, player bubbles #143039 with #e0faff text, secondary copy #bdb0d7, primary action #cbb4ff, and focus/connection accent #a8e8ef. Speaker labels remain visible; colour never encodes caller trust. The voice orb shares the violet/cyan palette. Other challenge surfaces retain the black passbook treatment.

## Pixel phone

Every scenario card carries the same original pixel phone (`app/components/PixelPhone.tsx`): a 20×32 SVG grid drawn with crisp edges in graphite #0b0b10, soft white #f2f0ea, periwinkle #9c9bff with shade #7473e0, and a cyan #6fd8e8 screen showing spaced signal bars and a two-frame waveform. Widths stay multiples of 20px so art pixels stay whole: 60px on scenario cards, 40px in lists and on Play. All callers share one phone, so the art never hints at call type; it replaces mascots on caller cards. Hover or focus is an incoming call: the phone lifts 3px with a soft periwinkle shadow, the screen brightens to #a9f0fa, the phone buzzes in short bursts, the waveform steps between frames and the signal pixel blinks once. Pressing a card answers it: the phone tilts up toward you and the screen lights fully. Reduced motion keeps it still.

## Scenarios: the retro contacts phone

The Scenarios view is one old candybar phone in the pixel-phone palette: a periwinkle body with a graphite outline, a speaker grille, a "BLOCK·TALK" mark, and a cyan dot-matrix LCD set in IBM Plex Mono (DotGothic16 is a digits-only subset). The LCD shows a status bar (signal, CONTACTS, battery), topic groups as inverted tabs (All, Money, Work, Shopping & prizes, Phone & tech, Government), and the address book A to Z with letter headers. The selected contact is an inverted bar. Each real caller shares its topic with a scam caller, so a group never hints at call type.

The physical keys work. The soft keys are blank and their labels sit on the LCD (Shuffle and Open in the list; Back and Call on a contact). Up and down move the selection, left and right switch topic, OK opens the contact, green calls it by voice, red returns to the full list, and 2 to 9 jump to names by letter as on an old phone. 1, *, 0 and # are decorative. Shuffle blinks a random contact for 900 ms, then starts its voice call. An opened contact shows the "AI practice caller" label, its public fact, Play by voice and the team-only Call my phone.

Rows near the pointer slide in a springy wave: each row has its own spring (K 70, C 12.5, four sub-steps per frame, dt capped at 50 ms), leans slightly with its velocity, and the loop stops when every row settles. The list rises in on load, and keys press down 2px. Reduced motion removes the wave, the entrances, the blink and the key travel.
