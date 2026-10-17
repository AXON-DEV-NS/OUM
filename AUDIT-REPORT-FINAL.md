# OUM — Final Audit Report (Phases 2–5)

**Date:** 2026-10-17
**Scope:** Local run, full visual crawl, skill-driven deep audit (security / database / billing / performance), and direct application of fixes.
**Companion document:** `AUDIT-REPORT.md` (Phase 1 structural audit — items marked "Remediated" there stay remediated).

---

## 1. Environment & Boot (Phase 2)

| Item | Result |
| --- | --- |
| Node.js | Portable v24.22.0 (`~/.local/node`, symlinked to `~/.local/bin`) — no sudo needed |
| PostgreSQL | Portable 17.11 at `~/.local/pg`, running on `127.0.0.1:5432`, DB `oum`, user `oum` (trust auth) |
| Migrations | All 5 migrations applied, including new `20261017090000_audit_indexes` |
| Seed data | Demo creator (`demo-creator-001`), channel "Tech Frontiers", 6 content items, promo `LAUNCH40`, support ticket, audit/security events |
| Dev server | `next dev` on :3000, heap-capped (`--max-old-space-size=1024`) after an OOM-adjacent stall |
| Type check | `npx tsc --noEmit` → **0 errors** |
| Security headers | Verified on pages and `/api` (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) |

Note: the machine has 3.7 GB RAM, which caused a mid-crawl stall (swap thrash + 100–380 s dev compiles). After restarting with a capped heap everything compiled normally. The crawl script now supports `AUDIT_SKIP_EXISTING=1` to resume safely.

---

## 2. Visual Inventory (Phase 3)

Full-page screenshots of every route at **desktop 1920×1080** and **mobile 390×844** in `./audit-screenshots/`, plus `crawl-report.json` with per-route HTTP status and console errors.

Coverage: marketing (landing, pricing, blog, article, contact, 4 legal pages), auth (login, signup, checkout), creator dashboard (dashboard, onboarding, channels, niche, calendar, analytics, settings, support, ticket detail), admin gateway (login, overview, users, plans, promo codes, finance, audit logs, security chat), and the 404 surface.

Auth simulation: a signed `session` JWT for the creator, and a real owner login (password + TOTP) for the admin panel.

Visual defects found by the crawl (both fixed — see §3):
- `content-calendar` rendered raw missing-message errors for weekday headers (console errors on all viewports).
- Pricing page logged a false 401 in the console for guest probes.

---

## 3. Findings & Fixes (Phases 4–5)

### 3.1 Critical

| # | Finding | Location | Status |
| --- | --- | --- | --- |
| C1 | **Session-token confusion.** `getSession()` accepted *any* JWT signed with the session secret — including magic-link tokens (`{email, type:"magic-link"}`) which carry **no `userId`**. Requests then hit Prisma with `where: { userId: undefined }`, which **collapses the filter** and can expose other users' content. Middleware `hasSession()` had the same hole. | `lib/auth/session.ts`, `middleware.ts` | **Fixed** — sessions now carry `type:"session"`; `getSession()` + `hasSession()` reject any other token type and any missing string `userId`/`email`. Admin session got the same treatment. Regression-tested: magic-link-shaped token → 307/`authenticated:false`; legacy token → 307; proper session → 200. |
| C2 | **Promo races and silent full-price charge.** `/api/subscribe` validated a promo via read-then-increment (two concurrent checkouts could exceed `maxUses`), and the checkout page never sent the applied code at all — users saw a discount but were charged full price. | `app/api/subscribe/route.ts`, `lib/admin/data.ts`, `app/[locale]/checkout/page.tsx` | **Fixed** — atomic compare-and-swap `redeemPromoCode()` (3 retries); a supplied-but-unusable code now returns 409 instead of charging full price; checkout now sends `promoCode` with the order and displays server-confirmed amounts. |
| C3 | **Checkout collects raw PAN/CVC with no real processor.** PCI-sensitive form in the page + copy implying real payment ("receipt sent", "charged today", "256-bit TLS"). | `app/[locale]/checkout/page.tsx` | **Mitigated** — honest sandbox labeling throughout (banner already existed; success screen no longer claims a receipt was emailed, amounts labeled "simulated", card details never stored/charged). **Open:** replace with Stripe Elements / hosted checkout before taking real money (see §4). |

### 3.2 High

| # | Finding | Location | Status |
| --- | --- | --- | --- |
| H1 | Missing `contentCalendar.days.*` i18n keys (Sun–Sat) — runtime MISSING_MESSAGE errors in production logs and console. | `messages/en.json`, `app/[locale]/(dashboard)/content-calendar/page.tsx:358` | **Fixed** — added `days.sun`…`days.sat`. |
| H2 | **Review-action race.** Read-then-write in `applyReviewAction` let concurrent approve/reject both pass the state check and double-apply. | `lib/services/content.ts` | **Fixed** — transactional compare-and-swap (`INVALID_STATE` for the loser, 409 from the API). |
| H3 | **Generation pipeline double-run.** Two concurrent generate calls could both run the paid DeepSeek/Higgsfield pipeline for the same item. | `lib/services/content.ts` | **Fixed** — atomic claim to `GENERATING` (IDEA branch) and a 2-minute generation lease for `SCRIPT/GENERATING` (stale runs still retryable). |
| H4 | **Yearly plans were charged as 30-day periods** regardless of billing interval. | `app/api/subscribe/route.ts` | **Fixed** — yearly = 365 days, monthly = 30. |
| H5 | **Lapsed subscriptions kept access forever** — an `ACTIVE` row was trusted without checking `currentPeriodEnd`. | `lib/billing/subscription-service.ts` | **Fixed** — active requires `currentPeriodEnd > now`. |
| H6 | Magic-link sign-in created a session **before** the user row existed, with a fake `userId` (`base64url(email)`) — dashboard queries by id returned nothing. | `app/api/auth/magic-link/verify/route.ts` | **Fixed** — user row is ensured first; session carries the real DB id (Google/OTP flows already did this). |
| H7 | **`grantFreeAccess` accepted unvalidated input**: unknown `userId` crashed with an FK 500 after partial writes; arbitrary `planId`/`durationDays` accepted. | `lib/admin/data.ts` + 2 admin routes | **Fixed** — plan allow-list (`STARTER/GROWTH/AGENCY`), duration bounds (1–3650), user existence check, grant+subscription in one transaction, 400/404 error mapping in routes. |

### 3.3 Medium

| # | Finding | Location | Status |
| --- | --- | --- | --- |
| M1 | Email templates interpolated user input into HTML unescaped (contact/ticket/reply emails) — HTML injection into owner inbox. | `lib/email/notifier.ts` | **Fixed** — `escapeHtml()` applied to every interpolation; body logging gated to non-production. |
| M2 | `/api/billing/status` returned 401 for guests → false console errors on public pages (observed on `/pricing` in the crawl log). | `app/api/billing/status/route.ts`, pricing page probe | **Fixed** — 200 `{authenticated:false}`; pricing checks the flag; dashboard consumers unaffected (additive shape). |
| M3 | **No indexes** on hot foreign keys/composites (sessions, channels, content items, tickets, audit logs…). | `prisma/schema.prisma` + migration | **Fixed** — 18 indexes added and applied to the DB. |
| M4 | Dead duplicate `/api` block in middleware (unreachable). | `middleware.ts` | **Fixed** — removed. |
| M5 | Admin grant endpoints crashed with raw 500 on invalid payloads. | admin `site-free` / user `offer` routes | **Fixed** — mapped to 400/404 with clear messages. |

### 3.4 Verified clean

- CSRF origin check on mutations, rate limiting on auth/subscribe/content endpoints, route-gate isolation for the admin panel (owner-only), welcome/onboarding overlays, session revocation on sign-out, security headers.

---

## 4. Open Items (Decisions Required — Not Auto-Fixed)

1. **No real payment provider** — Stripe (or equivalent) + webhooks + idempotency keys is a product/infra decision. Until then the sandbox labeling is the honest state.
2. **Checkout PCI surface** — replace raw card fields with Stripe Elements/hosted checkout when going live.
3. **Yearly price semantics** — `lib/plans.ts` `yearlyPrice` values are per-month equivalents; confirm whether checkout should charge `yearlyPrice × 12` (likely) or a flat yearly number.
4. **Admin lockout DoS** — TOTP/password brute-force lockout can also lock out the real owner; consider IP allow-list or alerting instead of hard lockout.
5. **OTP account enumeration trade-off** — verify endpoint responses should stay generic.
6. **Schema debt** — `Channel.niche` (string) vs `nicheId` drift; `TicketMessage.userId` / `MistakeLog.channelId` lack FK constraints; audit-log writes are best-effort (fire-and-forget).
7. **Dev-store parity** — the in-memory fallback store diverges from Prisma behavior; keep it dev-only.

---

## 5. Verification Evidence

- `npx tsc --noEmit` → exit 0.
- Session exploit regression: `type:"magic-link"` token on `/dashboard` → `307`; token without `type` → `307`; proper `type:"session"` token → `200`. `/api/billing/status` with the crafted token → `{"authenticated":false,"hasAccess":false}` (no data), with a real session → full access object.
- Promo CAS: `redeemPromoCode()` implemented with `updateMany` compare-and-swap; subscribe returns `409 promo_unavailable` instead of charging.
- Migration `20261017090000_audit_indexes` applied; Prisma client regenerated.

---

## 6. Re-Running the Audit

```bash
# Postgres (portable)
LD_LIBRARY_PATH="$HOME/.local/pg/lib" "$HOME/.local/pg/bin/postgres" -D "$HOME/.local/pgdata" &

# Dev server (heap-capped)
export PATH="$HOME/.local/bin:$PATH"
set -a; source .env.local; set +a
NODE_OPTIONS="--max-old-space-size=1024" npm run dev

# Screenshots (resumable)
AUDIT_SKIP_EXISTING=1 node scripts/audit-screenshots.mjs
```

---

## Appendix — Screenshot Inventory (60 files, 30 routes × 2 viewports)

All in `./audit-screenshots/<name>-<desktop|mobile>.png`; per-route status/console data in `crawl-report.json`.

| Group | Routes (desktop + mobile each) |
| --- | --- |
| Marketing (9) | `01-landing`, `02-pricing`, `03-blog`, `04-blog-article`, `05-contact`, `06-legal-privacy`, `07-legal-terms`, `08-legal-refund`, `09-legal-cancellation` |
| Auth & checkout (3) | `10-login`, `11-checkout`, `11b-signup` |
| Creator dashboard (9) | `12-dashboard`, `13-onboarding`, `14-channels-connect`, `15-niche`, `16-content-calendar`, `17-analytics`, `18-settings`, `19-support`, `20-support-ticket` |
| Admin gateway (8) | `21-admin-login`, `22-admin-overview`, `23-admin-users`, `24-admin-plans`, `25-admin-promo-codes`, `26-admin-finance`, `27-admin-audit-logs`, `28-admin-security-chat` |
| Error surface (1) | `29-not-found` (HTTP 404 — expected) |

Final crawl result: **60/60 captured, every route HTTP 200** except the intentional 404 page. Console errors only on `29-not-found` (the expected 404 response) — the previously observed pricing 401 and content-calendar MISSING_MESSAGE noise are gone.

