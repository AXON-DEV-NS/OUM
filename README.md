# OUM

Autonomous AI-powered YouTube channel manager. Research, script drafting, compliance checks, asset generation, and scheduled publishing — creators stay in control with 1-click review.

## Features

- **Multi-Stage AI Pipeline**: Connect channel → Niche research & search intelligence → DeepSeek script drafting & compliance review → Media asset synthesis → Scheduled YouTube publishing.
- **Creator Dashboard**: Live metrics, content calendar, script review with feedback loop (Mistake Log), channel analytics, and support tickets.
- **Admin Control Gateway (`/oum-hq-secure-gateway`)**:
  - Secure owner access gated by TOTP 2FA, scrypt password hashing, and brute-force lockouts.
  - Plan pricing overrides, dynamic promo code generation, free access grants, and guardian security monitoring.
  - Direct persistence into Neon PostgreSQL (`prisma/schema.prisma`).
- **Security & Hygiene**:
  - Edge middleware route isolation.
  - Strict Content-Security-Policy (CSP), Cross-Origin-Opener-Policy (COOP), HSTS, and X-Frame-Options.
  - Serverless-persistent rate limiting via Upstash Redis and PostgreSQL security events.
  - Channel ownership enforcement on all multi-tenant routes to prevent IDOR.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) (App Router, React 19)
- **Database & ORM**: PostgreSQL (Neon) with [Prisma ORM 5](https://www.prisma.io)
- **Styling**: Tailwind CSS with custom editorial design system (Fraunces & Inter)
- **AI Engines**: DeepSeek (reasoning & scripting), Tavily/Serper (search intelligence), Higgsfield/ElevenLabs (media synthesis)
- **Rate Limiting**: Upstash Redis with PostgreSQL fallback
- **Authentication**: JWT session cookies with timing-safe verification, YouTube OAuth 2.0 with AES-256-GCM encrypted tokens

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and populate required keys:
   ```bash
   cp .env.example .env.local
   ```

3. **Initialize Database**:
   ```bash
   npx prisma db push
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

## Production Pipeline (13 stages, S0 → S12)

The engine in `src/pipeline/` moves every run through 13 gated stages — research → script → storyboard → assets → render → SEO → final QA → human approval → private-first publish → timeline checks → learning. The guarantees live in code, never in a prompt:

- **Fail Early / Fail Cheap**: tier order (`text < image < video < publish`) is enforced before every stage; budget floors stop doomed runs before any spend.
- **Deterministic checks, not vibes**: zod contracts + code checklists decide pass/fail; `src/skills/` holds the modular skill arsenal (50 skills: 46 implemented, 4 explicitly deferred to wave 2).
- **The judge is never the writer**: QA2/QA3 judge skills must run on a different model family; without two keys the run parks (it never "self-approves").
- **Private first**: S10 uploads private, schedules, parks until the slot, then verifies and flips public explicitly.
- **Holds are typed**: `timing`/`provider` holds self-heal on the next tick; `qa`/`budget`/`gate`/`judge` holds move only through a human decision.

```bash
npm test        # engine + checks + registry tests (offline, stub providers, no keys needed)
```

Pipeline API (session-protected):

| Route | Purpose |
| --- | --- |
| `GET/POST /api/pipeline/runs` | list recent runs / queue a new run (channel, path, budget cap) |
| `GET /api/pipeline/runs/[id]` | run + stages + QA evidence + ledger + notifications |
| `POST /api/pipeline/runs/[id]/advance` | advance the run (bounded steps, guarded) |
| `POST /api/pipeline/runs/[id]/decision` | human approve / reject / resume / retry |
| `GET/POST /api/cron/pipeline-tick` | catch-up tick: repairs stale stages, wakes due runs, prunes old notifications (Bearer `CRON_SECRET` in production) |

Vercel Hobby allows one cron invocation per day, so the tick is built for catch-up — nothing is lost between invocations. For minute-level wakeups (S10/S11 timing), either upgrade the plan or point an external pinger (for example cron-job.org) at `/api/cron/pipeline-tick` with the `Authorization: Bearer $CRON_SECRET` header.

Owner notifications are written in-app and best-effort mirrored to Telegram when `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` are set. Database backups: `node scripts/pipeline/db-backup.mjs` (keeps the newest 10 dumps).

## Admin Setup

To initialize or update the admin credentials and TOTP secret:
```bash
node scripts/setup-admin.mjs "<your-secure-password>"
```
Copy the generated values into `.env.local` and import the TOTP secret into your authenticator app.

If you do not have the authenticator app at hand, print the current 6-digit
code directly on this machine (reads `ADMIN_TOTP_SECRET` from `.env.local`):
```bash
node scripts/admin-totp.mjs          # current code
node scripts/admin-totp.mjs --uri    # otpauth:// URI to import into an app
```
