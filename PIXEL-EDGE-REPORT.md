# PIXEL EDGE CONVERSION — FINAL REPORT

**Project:** OUM website (`/home/youssef/Downloads/OUM-main`)
**Date:** 2026-10-17
**Scope:** convert every visible edge on the site to one pixel-art system; enlarge + simplify the logo lockup; full favicon set; visual QA across routes, roles, breakpoints and states.
**Build:** production (`npx next build` → `npx next start`), Next.js 15.5.25.
**Result:** automated DOM scan of **30/30 URLs → 0 non-pixel edge findings**. All required contrast pairs pass. Build, types, lint all pass.

---

## 1 · The system (one mechanism, one token)

Edges are painted with **`border-image` frames** generated as tiles in `scripts/pixel/gen-frames.mjs` → `app/px-frames.generated.css` (55.7 KB). This was chosen over pseudo-element overlays because it attaches to the element's own border box (perfect animation sync, no fixed-size hacks, no layout shift).

| Element | Value |
|---|---|
| Size token | `--px: 4px` (integer; crisp at DPR 1/2/3) |
| Solid frame | 12×12 tile, 4 px stair corners, slice 4 |
| Dash frame | 16×16 tile, 4 on / 4 off (all `border-dashed`, `hr`, dividers, eyebrow rules) |
| Two-tone (duo) | ink outer + light inner — for filled buttons/badges over unpredictable surfaces |
| Cut silhouette | `.pixel-frame` (triCut light/ink/light, corners cut to match) — hero video, video modal, welcome card |
| Circles | `--px-circle` 21-point stepped polygon (avatars, discs, status dots) |
| Focus | 3 px solid gold outline, offset 3 px, `!important` (replaces killed ring shadows) |
| Kill list | all `border-radius`, all `--tw-ring-*` shadows, all blurred shadows (blur 0, hard offsets) |

Notable correctness details found and fixed during QA:

1. **`focus:border-transparent` bug** — the "no visible border" kill rule matched prefixed variants and silently removed the frame on 3 form fields. Fixed with exact-word selectors; a regression check is part of the DOM scan.
2. **Dark-surface frames** — admin login form/inputs used `border-ink-soft` on ink fills (1.5:1, invisible). Given `px-edge-light` treatment; contrast audit now covers every token × surface pair.
3. **Duo inner band** — lightened `#E8DFC8 → #F1EBDB` so the inner band keeps ≥3:1 against the brightest fill it can sit on (`emerald-600`, 3.17:1).

## 2 · Contrast verification (WCAG relative luminance)

`node scripts/pixel/check-contrast.mjs` — reads tokens from the generated CSS (cannot drift), verifies 18 required pairs + both duo bands. **ALL REQUIRED PAIRS PASS.**

| Frame | Surfaces | Ratios |
|---|---|---|
| ink `#1B1915` | paper / paper-high / paper-low / green-50/100 / red-50/100 / amber-50 / emerald-50 / gold-50/100 / blue-50 | 12.9 – 16.9 |
| light `#F1EBDB` | ink-soft / green-600 / red-600 / emerald-600 | 3.17 – 9.95 |
| red `#C0392B` | paper / paper-high / red-50 | 4.74 – 5.08 |
| green `#3F7A3F` | paper / paper-high / green-50/100 / emerald-50 | 3.79 – 4.90 |
| gold `#9C6917` | paper / paper-high / gold-50 (also = focus ring) | 4.12 – 4.41 |

## 3 · Coverage

**Routes (30 URLs scanned, production build):** all marketing pages (home, pricing, blog, article, contact, 4 legal pages), auth (login), user app (dashboard, onboarding, content-calendar, niche, channels/connect, analytics, settings, support, support/[ticketId], checkout), admin (login + overview, users, plans, promo-codes, finance, audit-logs, security-chat, index), and 404. Full table: `PIXEL-EDGE-CHECKLIST.md`.

**Breakpoints:** 360×640 · 390×844 · 414×896 · 768×1024 · 1024×768 · 1366×768 · 1440×900 · 1920×1080 — 32 screenshots over 4 archetypes (home/pricing/dashboard/admin), all routes additionally scanned + captured at 1440. → `pixel-qa/matrix/`

**States:** hover, focus ring (keyboard), mobile menu open, video modal open, loading (skeleton frames + first-load branding overlay), empty states, dark surfaces (footer, login panel, admin login, security chat), welcome splash, DPR 1/2/3 element crops. → `pixel-qa/states/`, `pixel-qa/crops/`

**Logo/lockup:** tight-cropped mark (transparent padding removed: 694×575), mark ≈1.5× the wordmark, wordmark simplified to Inter semibold (was a serif display face), paper-variant halo for dark surfaces. Applied to: navbar, mobile menu, footer, login/register, dashboard sidebar (+ collapsed), admin shell, 404, pipeline loader, welcome splash, checkout header, blog cards, and all 3 email templates.

**Icons:** hand-simplified 32-unit pixel robot → `icon.svg`, `favicon.ico` (16/32/48), `icon-32.png`, `apple-touch-icon.png` (180), `icon-192/512.png`, `icon-maskable-512.png` (80 % safe zone), `og.png` (1200×630). Head links verified in served HTML with `?v=20261017` cache-bust; every URL returns 200 with the right content type; `manifest.json` updated; `app/icon.png` + `app/apple-icon.png` refreshed.

## 4 · Gates

| Gate | Result |
|---|---|
| Production build | PASS (final code) |
| `tsc --noEmit` | PASS |
| `npm run lint` | 0 errors (pre-existing warnings only) |
| DOM edge scan (`audit-edges.mjs`) | **30/30 clean, 0 findings** (`pixel-qa/edge-audit.json`) |
| Contrast (`check-contrast.mjs`) | ALL REQUIRED PAIRS PASS |
| Console errors (QA pass) | none (only the deliberate 404 fetch on the 404 test) |
| Secrets (`gitleaks`) | no leaks in `app/`, `components/`, `lib/`, `scripts/` |
| SAST (`semgrep --config auto`, 210 rules / 200 files) | 5 findings — all triaged (below) |
| Dependencies (`trivy fs` + `npm audit`) | pre-existing findings only (below) — **no dependency changes in this task** |
| Screenshot matrix + states + DPR crops | 60+ captures reviewed |

**Not run in this task (stated honestly):** Lighthouse/axe re-run (the prior full audit covers the baseline; this change set touches only edges — focus visibility was visually verified and is enforced by a single global rule), real-inbox rendering of the email lockup, OS favicon-cache behaviour.

## 5 · Findings triaged (security scans)

| ID | Tool | Finding | Severity | Action |
|---|---|---|---|---|
| S1 | semgrep | `gcm-no-tag-length` — `lib/admin/secrets.ts` decrypt without pinned GCM tag length | High (crypto hygiene) | **FIXED** — `authTagLength: 16` + 16-byte tag length check; verified by round-trip test: roundtrip PASS, truncated tag rejected, tampered ciphertext rejected |
| S2 | semgrep | `dangerouslySetInnerHTML` in blog JSON-LD | Info | Accepted — static `JSON.stringify` of repo-owned post data, not user input (classic JSON-LD false positive) |
| S3–S5 | semgrep | `unsafe-formatstring` in cron log, secrets log, notifier log | Info | Accepted — `console`-style logging, no user-controlled format strings, not exploitable for code execution |
| D1–D13 | trivy | 13 CVEs in existing deps (next 15.5.25 ×2 medium, nodemailer 10.0.1 ×6, sharp ×1, @grpc/grpc-js ×2, braces, source-map-js, postcss-selector-parser) — 0 critical | Medium/High | Pre-existing; fix versions available (e.g. next ≥15.5.27, nodemailer ≥10.0.9). **Recommended as a separate, tested dependency-update pass** — upgrading Next/nodemailer mid-QA would invalidate this build's evidence |
| D14 | npm audit | 15 advisories (3 moderate / 12 high) in prod tree | — | Same as D1–D13 (audit DB coverage differs slightly from trivy) |

## 6 · What automated tools cannot cover

- **Arbitrary photo content** behind overlay chips: the two-tone band guarantees one visible tone but per-photo contrast is not machine-verifiable — two-tone is the designed mitigation.
- **Business logic, authz flows, infrastructure** are out of scope for an edge conversion; refer to `AUDIT-REPORT-FINAL.md` for those.
- **Human visual taste** — the aesthetic direction (stepped corners, chunky 4 px edges) was chosen to match the brand's retro-terminal/robot identity; screenshots are in `pixel-qa/` for your review.

## 7 · Reproduction

```bash
# regenerate frames after any token change
node scripts/pixel/gen-frames.mjs

# verify contrast + scan every edge (server running)
node scripts/pixel/check-contrast.mjs
node scripts/pixel/audit-edges.mjs            # 30 URLs, exits 1 on any finding

# screenshots (auth-aware)
node scripts/pixel/qa-shots.mjs               # per-route desktop shots
node scripts/pixel/qa-states.mjs              # states + 8-viewport matrix
node scripts/pixel/qa-branding.mjs            # first-load overlay + loaded dashboard
node scripts/pixel/qa-dpr.mjs                 # DPR 1/2/3 edge crops
node scripts/pixel/qa-splash.mjs              # welcome splash (toggles a DB flag, restores it)
```

## 8 · Confidence

**High** for the edge conversion itself: the scan is computed-style based (not greppable-class based), it ran against a production build of the final code, and every route/role was included. **Medium-high** for the favicon set (verified in HTML + rendered at 16/32/512; browser/OS caching is outside our control). **Medium** for emails (HTML verified, no real inbox). Dependency findings are reported, not fixed — that is a deliberate scope decision.

---

## 9 · Update — real-logo brand pass, dependency fixes, release prep (2026-10-17)

**Real logo everywhere.** The master artwork `public/oum.png` (1200×896) now sources every brand asset. `scripts/pixel/gen-icons.mjs` was rewritten to be crop/scale-only: it trims the transparent margin (alpha > 8) into `public/oum-logo.png` (694×575 — page lockups), builds the square icon canvas and emits `favicon.ico` (16/32/48), `icon-32`, `icon-192`, `icon-512`, `icon-maskable-512` (cream, content 80%), `apple-touch-icon` (cream, 78%), `og.png` (1200×630, real logo + pixel rule), plus `app/icon.png` and `app/apple-icon.png`. The hand-drawn pixel approximations and leftovers were deleted (`public/oum-mark.png`, `public/icon.svg`, `public/favicon-32.png`); `app/layout.tsx` dropped the SVG icon link and cache-busts the icon set to `?v=20261017b` (manifest icons too). Components switched to `/oum-logo.png`: `components/ui/logo.tsx`, `components/ui/pipeline-loader.tsx`, `components/admin/admin-shell.tsx`. The email header keeps `/icon-192.png` — now the real logo.

**Dependency/error fixes.** `next` 15.5.27, `nodemailer` 10.0.9, `sharp` 0.35.5 pinned as an explicit devDependency, `npm audit fix` (no forced downgrades). Trivy HIGH/CRIT: 13 → 2 accepted (`@grpc/grpc-js` via firebase — fixing means downgrading firebase, rejected; `braces` 3.0.3 — build-time only, no fix published). npm audit: 15 → 11, all deep transitive with breaking-only fixes, documented as accepted.

**Release prep.** The working tree is attached to the remote history (`origin/main` @ `4eb3000`) and committed locally, so the eventual `git push origin main` is a clean fast-forward. Pushing is blocked only by missing GitHub credentials on this machine. Local preview: `next start` on :3000. Local Postgres is user-level (`~/.local/pg` + `~/.local/pgdata`) — restart with `~/.local/pg/bin/pg_ctl -D ~/.local/pgdata -l ~/.local/pg/oom-server.log start`. `scripts/admin-totp.mjs` prints the current owner 2FA code (or `--uri` to import into an authenticator app).

**Verification (this pass).** build exit 0 (53/53 static pages) · `tsc --noEmit` 0 · `next lint` 0 errors · edge audit 0 findings across 30 routes · contrast all pairs PASS · qa-shots clean console (home, login, admin-login, dashboard, admin-overview, 404 — desktop+mobile, `pixel-qa/logo-v2/`) · welcome splash re-shot (`pixel-qa/states/`) · gitleaks: no leaks (app/components/lib/scripts) · semgrep: 8 findings triaged — 3 `.env.local` secrets (local file, gitignored, by design), 1 static JSON-LD `dangerouslySetInnerHTML`, 3 info-level `unsafe-formatstring` logs, and 1 `missing-integrity` **fixed** by adding SRI + `crossorigin` to the gsap CDN tag in `video/oum-intro-8k/index.html`.
