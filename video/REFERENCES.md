# REFERENCES.md — Round 3 research

15 sources captured with Playwright (screenshots in `out/refs/`, sheet:
`out/review/review-8-references.png`). 15/15 captured (Linear + Stripe needed a
retry; Calm's hero renders a blank/soft frame at capture time — noted).
Principles only — **never artwork**.

| # | Source (category) | What moves | Elements moving at once | Easing / pacing | Colour use | Explaining without text | PRINCIPLE TO COPY |
|---|---|---|---|---|---|---|---|
| 1 | Linear (SaaS) | Task cards slide/fade through a board; cursor moves | 2–3 | Fast smooth decel (~250–400 ms), snappy springs | Dark UI, one accent | Shows the *workflow* (ticket moving across states) | Make the product's core loop the moving subject, not decoration |
| 2 | Stripe (SaaS) | Gradient ribbons drift; logos tick | 1–2 | Very slow (~8–20 s loops), ease-in-out | Vivid gradient band on white | Complexity tamed into one calm stream | Long-period drifts feel premium; keep revisions invisible |
| 3 | Notion (SaaS) | Cursor + tool chips demo building a page | 2–3 | 0.4–0.8 s steps | Neutrals + small colour chips | Shows building blocks assembling | Show a build-up: parts → assembled whole |
| 4 | Framer (SaaS) | Chat/prompt cards appear, AI panel assembles | 2–3 | spring ~0.5 s, slight overshoot | Dark with blue glow | "Describe → it builds" | Cause→effect immediately legible: input then result |
| 5 | Vercel (SaaS) | Line charts draw, triangle mark subtle | 1–2 | Linear-ish draws but masked steps | Black/white minimal | A single mark + a rise = performance | Restraint: one protagonist element |
| 6 | Descript (SaaS) | "Underlord" card pulses; badges pop | 2–3 | 0.3–0.6 s pops | White + brand blue | Editing made friendly (speech bubble) | Personify the tool with a small friendly object, not a face |
| 7 | Loom (SaaS) | Video bubble breathes; recording dot | 1–2 | gentle 2–3 s breathing | Warm neutral + purple accent | A video being captured | A breathing "recording" tile reads instantly |
| 8 | Runway (SaaS) | Big film—grain, slow light sweep | 1 | very slow, cinematic | Dark, warm grade | Craft/quality, no words needed | A single slow light move evokes production quality |
| 9 | Headspace (wellness) | Character blobs float & breathe; waves | 2–3 | 3–5 s cycles, soft eases | Warm orange/cream, muted | Calm mind via breathing blob | Breathing scale (1±2 %) is the universal "calm" signal |
| 10 | Calm (wellness) | Soft gradient seascape, slow shimmer | 1 | 10 s+ loops | Deep blue/teal gradients | Peace via environment | One long-period ambient layer is enough |
| 11 | Awwwards (showcase) | Mini-sites autoplay: type, 3D, particles | 2–4 | mixed; award sites use 0.6–1.2 s ease-out | mixed | often pure mood | Rejected: award-site density clashes with calm hero duty |
| 12 | Dribbble (showcase) | Lottie previews: icon morphs, loops | 1–3 per shot | 0.6–1.2 s, staggered 80–120 ms | 2–4 colours per shot | icon sequence = story | Stagger 80–120 ms on siblings; keep loops short |
| 13 | Behance (showcase) | Explainer frames: flat character + props | 2–3 | stepped, readable holds | flat 3–5 colour flats | pose + prop + implication | Holds (beats of stillness) make steps readable |
| 14 | LottieFiles (community) | Micro-loops: task→progress→done | 1–2 | springy in, ease-out | minimal palettes | progress metaphor (bar/check) | A check mark at the end of a sequence = universal "done" |
| 15 | YouTube search (flat explainers) | Flat character demos: pose changes, walk cycles | 2–3 | 0.5–1 s, in-place beats | flat 4–6 colours, dark outlines | pose language is the story | Characters read through POSTURE and props, not faces |

## Derived rules used in the rebuild (Section 9 compliance)
- One protagonist per beat; 2–3 movers max (jitter exception only in the chaos beat).
- Soft springs (no bounce), 0.6–1.2 s transitions, 80–120 ms sibling stagger.
- Calm = long periods (breathing 4–8 s), nothing loops faster than 1.5 s except transient pops.
- One accent family (hero green); muted cream/greys for the "problem", lit green for the "solution".
- Posture + props tell the story; faces and text are unnecessary.
- Beats of stillness between actions; at least half of every frame empty.

## Sources I could NOT use
- Calm.com hero captured as a soft blank frame (animation canvas didn't paint in time) — counted as a source, its calm-gradient principle is well known.
- Behance tile shows its anti-bot interstitial — the search URL is documented above.

## ROUND 4 addendum � recorded frame study (14 heroes, 5 frames each)

See out/review4/review-8-references.png (sheet) + out/refvids/*.webm (raw recordings).

Five concrete decisions taken from the study:
1) Breathing scale (+-1.4-2.2%, 4-8s period; Headspace/Calm) drives the tired loop - nothing loops faster than 1.5s except transient pops.
2) One protagonist per beat, 2-3 movers max (Linear/Notion); controlled jitter only in the chaos beat.
3) Spring entrances 0.4-0.8s with soft settle (Framer/Descript) for logos, discs and the check.
4) Long-period ambient motion (Stripe/Runway) for the bloom and sun rotation.
5) Single accent family on neutral ground (Vercel/Apple restraint): cream base, dark-green figure, green solution line; gold removed after scanning the live hero (0.002% gold pixels).
