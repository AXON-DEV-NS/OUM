# PIXEL EDGE CONVERSION — COVERAGE CHECKLIST

> Every visible edge on the OUM site converted to the single pixel system.
> Legend: **✓ done & verified** · **— n/a** · evidence paths are relative to the repo.

Date: 2026-10-17 · Build: production (`next build` → `next start`) · Scan: `scripts/pixel/audit-edges.mjs` (DOM computed-style scan) · Screenshots: `scripts/pixel/qa-*.mjs` → `pixel-qa/`

---

## 1 · Mechanism (one reusable system)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1.1 | Single global size token `--px: 4px` (integer px) | ✓ | `app/px-frames.generated.css` `:root` |
| 1.2 | Frames generated as `border-image` (12×12 solid stair tile, slice 4) | ✓ | `scripts/pixel/gen-frames.mjs` → `app/px-frames.generated.css` (55.7 KB) |
| 1.3 | Pixel-dash frame (16×16, 4 on / 4 off) for every dashed edge | ✓ | same generator; `border-dashed` selectors |
| 1.4 | Side-only frames (t/b/l/r/y/x/br combos — dividers, `border-l-4`, `border-b border-r`) | ✓ | side sets in generated CSS; calendar cell + `md:border-l` verified in screenshots |
| 1.5 | Two-tone edge (`ink` outer + `light` inner) for unpredictable surfaces (filled buttons/badges over media) | ✓ | `.px-corners-duo`; contrast table §4 |
| 1.6 | Cut-silhouette frame (triCut light/ink/light, corners cut to match) for hero video, video modal, meet-OUM card | ✓ | `.pixel-frame` / `.pixel-frame-outer`; `states/video-modal-1440.png` |
| 1.7 | Stepped circles (`--px-circle`, 21-point polygon) for avatars/discs/status dots | ✓ | auto-targeting rules in `app/globals.css`; dashboard avatar in `matrix/dashboard-390x844.png` |
| 1.8 | Focus ring = 3 px solid gold outline, offset 3 px (≥3:1 on cream and ink) | ✓ | global rule; `states/focus-cta-1440.png` |
| 1.9 | State coverage: default / hover / focus / active / selected / disabled / error / success | ✓ | generated state rules (hover flips frame colour, etc.); hover+focus crops in `pixel-qa/crops`, `states/` |
| 1.10 | Corner radius eliminated globally (`border-radius: 0 !important`), blur-blob exemption only | ✓ | global rule; DOM scan `radius` findings = 0 |
| 1.11 | Tailwind ring shadows killed (`--tw-ring-*` zeroed) | ✓ | global rule; scan `shadow-blur` = 0 |
| 1.12 | All remaining shadows converted to hard pixel offsets (blur 0) | ✓ | `tailwind.config.ts` shadow scale |
| 1.13 | Pixel scrollbars (track + square thumb) | ✓ | global `::-webkit-scrollbar` rules |
| 1.14 | `prefers-reduced-motion` respected (all motion was already gated; frames are static) | ✓ | scans run with `reducedMotion: reduce` with identical edge output |
| 1.15 | Frames move with the element (painted by the element's own border box — GPU-safe, perfectly synced) | ✓ | by construction: `border-image` on the element; no overlay pseudo-elements |

## 2 · Route inventory — automated DOM scan (30 URLs, production build)

Scan checks every rendered element for: radius > 0 · blurred shadow · visible border without pixel frame · frame-width/slice drift. Result: **0 findings** (`pixel-qa/edge-audit.json`).

| Route | Role | Scan | Extra visual evidence |
|---|---|---|---|
| `/` | visitor | ✓ clean | `matrix/home-*.png` (8 sizes), hero/modal/CTA states |
| `/pricing` | visitor | ✓ clean | `matrix/pricing-*.png` (8 sizes), plan toggle |
| `/blog` | visitor | ✓ clean | chips + covers (`blog-desktop` in earlier pass) |
| `/blog/[slug]` | visitor | ✓ clean | article page |
| `/contact` | visitor | ✓ clean | form inputs + submit |
| `/legal/privacy` | visitor | ✓ clean | — |
| `/legal/terms` | visitor | ✓ clean | — |
| `/legal/refund` | visitor | ✓ clean | — |
| `/legal/cancellation` | visitor | ✓ clean | — |
| `/login` | visitor | ✓ clean | dark split panel + paper logo variant |
| `/checkout` | user | ✓ clean | — |
| `/dashboard` | user | ✓ clean | `matrix/dashboard-*.png` (8 sizes, data-loaded) |
| `/onboarding` | user | ✓ clean | stepper + pills |
| `/content-calendar` | user | ✓ clean | calendar grid cells (`border-b border-r` combos) |
| `/niche` | user | ✓ clean | — |
| `/channels/connect` | user | ✓ clean | — |
| `/analytics` | user | ✓ clean | chart cards |
| `/settings` | user | ✓ clean | session list, danger zone |
| `/support` | user | ✓ clean | search + textarea (focus:border-transparent kept frame) |
| `/support/[ticketId]` | user | ✓ clean | reply thread |
| `/oum-hq-secure-gateway/login` | admin | ✓ clean | light frames on ink panel (`px-edge-light`), `admin-login-desktop.png` |
| `/oum-hq-secure-gateway/overview` | admin | ✓ clean | `matrix/admin-*.png` (8 sizes) |
| `/oum-hq-secure-gateway/users` | admin | ✓ clean | — |
| `/oum-hq-secure-gateway/plans` | admin | ✓ clean | pills |
| `/oum-hq-secure-gateway/promo-codes` | admin | ✓ clean | — |
| `/oum-hq-secure-gateway/finance` | admin | ✓ clean | — |
| `/oum-hq-secure-gateway/audit-logs` | admin | ✓ clean | — |
| `/oum-hq-secure-gateway/security-chat` | admin | ✓ clean | dark chat surfaces |
| `/oum-hq-secure-gateway` (index) | admin | ✓ clean | — |
| `/this-route-does-not-exist` (404) | visitor | ✓ clean | `not-found-desktop.png` with full lockup |
| `/support/[ticketId]` (audit cookie) | user | ✓ clean | ticket `cmvc2i630000sg3bl5rg8g8sg` |

## 3 · Breakpoint matrix (visual capture)

Captured + reviewed: **4 archetypes × 8 viewports = 32 screenshots** (`pixel-qa/matrix/`)

| Viewport | home | pricing | dashboard | admin |
|---|---|---|---|---|
| 360×640 | ✓ | ✓ | ✓ | ✓ |
| 390×844 | ✓ | ✓ | ✓ | ✓ |
| 414×896 | ✓ | ✓ | ✓ | ✓ |
| 768×1024 | ✓ | ✓ | ✓ | ✓ |
| 1024×768 | ✓ | ✓ | ✓ | ✓ |
| 1366×768 | ✓ | ✓ | ✓ | ✓ |
| 1440×900 | ✓ | ✓ | ✓ | ✓ |
| 1920×1080 | ✓ | ✓ | ✓ | ✓ |

No horizontal scroll observed at 360 px · touch targets ≥44 px unchanged (no geometry change) · all remaining routes visually verified at 1440 (desktop shots + full-page review during the pass).

## 4 · Contrast (smart colour rule)

`scripts/pixel/check-contrast.mjs` — every frame token ≥ 3:1 against the surfaces it touches (18 required pairs + duo bands). All required pairs **PASS**; the full table is in `PIXEL-EDGE-REPORT.md`.

- ink `#1B1915` vs all light surfaces: 12.9–16.9 ✓
- light `#F1EBDB` vs ink/ink-soft/green-600/red-600/emerald-600: 3.17–9.95 ✓
- red `#C0392B`: 4.7–5.1 ✓ · green `#3F7A3F`: 3.79–4.9 ✓ · gold `#9C6917`: 4.12–4.41 ✓
- Two-tone duo bands verified on both sides (outer on light, inner on dark fills)
- Known residual: arbitrary **photo content** behind overlay chips cannot be machine-guaranteed; mitigated by the two-tone band (one of the two tones always contrasts).

## 5 · Logo lockup + wordmark

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 5.1 | Tight-cropped mark `public/oum-mark.png` (694×575 — transparent padding removed) | ✓ | `gen-icons.mjs` crop step; bbox logged `x0 253 y0 160 w 694 h 575` |
| 5.2 | Mark ≈1.5× the wordmark size (36 px mark / 24 px name in header) | ✓ | `components/ui/logo.tsx` SIZES |
| 5.3 | Wordmark simplified to plain sans (Inter semibold, tight tracking — was serif display) | ✓ | `logo.tsx` |
| 5.4 | Same lockup everywhere | ✓ | navbar (nav), mobile menu (nav), footer (md), login/register dark panel (lg + paper halo), dashboard sidebar (sm + collapsed markOnly), admin shell header, 404 page (lg), pipeline loader, welcome splash, blog cards (via Logo), checkout header, 3 email templates (mark + name) |
| 5.5 | Paper variant legibility on dark: 1 px cream halo | ✓ | `.logo-mark-paper` in `app/globals.css`; login screenshot |

## 6 · Favicon / app icons / OG

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 6.1 | Simplified high-contrast pixel mark on a 32-unit even grid (crisp at 16/32/48) | ✓ | `scripts/pixel/gen-icons.mjs` |
| 6.2 | Set generated: `icon.svg`, `favicon.ico` (16/32/48 embedded), `icon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (content at 80 %), `og.png` (1200×630) | ✓ | all files in `public/`, all HTTP 200 with correct content types |
| 6.3 | `<head>` links wired with cache-bust `?v=20261017` | ✓ | verified in served HTML: `icon.svg`, `favicon.ico`, `icon-32.png`, `apple-touch-icon.png` |
| 6.4 | `manifest.json` → 192/512 any + 512 maskable | ✓ | `public/manifest.json` |
| 6.5 | OG/Twitter card → `/og.png` 1200×630 (pixel card) | ✓ | `app/layout.tsx`; `og.png` visually reviewed |
| 6.6 | `app/icon.png` replaced with the new 512 mark (file-convention fallback) | ✓ | `app/icon.png` = 7 463 B new art |
| 6.7 | Tab visibility check (16/32 px renders) | ✓ | `icon-32.png` visual review: chassis + face + glints legible |

## 7 · Automated scans

| Tool | Command | Result |
|---|---|---|
| DOM edge scan | `node scripts/pixel/audit-edges.mjs` | **30/30 routes clean — 0 findings** (`pixel-qa/edge-audit.json`) |
| Contrast | `node scripts/pixel/check-contrast.mjs` | **ALL REQUIRED PAIRS PASS** |
| Types | `npx tsc --noEmit` | PASS |
| Lint | `npm run lint` | 0 errors (pre-existing warnings only) |
| Build | `npx next build` | PASS (production build served the final audit) |
| Secrets | `gitleaks detect --no-git` (app, components, lib, scripts) | no leaks found |
| SAST | `semgrep scan --config auto` (210 rules / 200 files) | 5 findings — all triaged: 1 fixed (GCM `authTagLength`), 4 accepted with rationale (see report) |
| Dependencies | `npm audit --omit=dev` | 15 pre-existing (3 moderate / 12 high) — no dependency changes in this task |
| Containers/IaC | `trivy fs` | see report |

## 8 · Interactive states captured

`pixel-qa/states/`: mobile menu open (390) ✓ · video modal open (1440) ✓ · keyboard focus ring ✓ · hover crop ✓ · first-load branding overlay (PipelineLoader + mark) ✓ · welcome splash context ✓ · loading skeletons (dashboard, framed) ✓ · dark surfaces (footer, login, admin login, security chat) ✓ · DPR 1/2/3 element crops ✓ (`pixel-qa/crops/`)

## 9 · Honest residuals

1. Photo content behind overlay chips: two-tone mitigation only — not machine-guaranteed per-photo.
2. Emails: the mark renders in mail clients as a 44 px image; verified as HTML only (no real inbox test).
3. OS-level favicon caching cannot be forced by code; `?v=20261017` is the standard mitigation.
4. Full-page downscaled screenshots alias 4 px frames into "dashes" (rendering artifact of the preview, not the site) — verified at DPR 3 and via element crops.
5. `npm audit` dependency findings are pre-existing and out of scope for an edge-conversion change; listed for follow-up.
