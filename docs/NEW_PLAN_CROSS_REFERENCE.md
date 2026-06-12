# NEW PLAN vs CODEBASE — CROSS-REFERENCE
# Generated: June 2026

---

## CURRENT CODEBASE STATE (Before Cross-Reference)

| Metric | Value |
|--------|-------|
| Backend tests | **860 passing** (56 files) |
| Backend TS errors | **0** |
| Backend ESLint warnings | **0** |
| Backend build | **PASS** |
| Frontend tests | **147 passing** (13 files) |
| Frontend TS standalone | **0 errors** |
| Frontend build (`tsc -b`) | **FAIL** — 3 errors (Church.tsx, PublicRecords.tsx) |
| Frontend pages | **43** (3 stubs, 1 redirect, 15 minimal, 24 substantial) |
| Backend routes | **29 files**, extensive APIs |
| Backend services | **32 files** |
| Backend middleware | **14 files** |
| Backend migrations | **29 files** |
| GitHub Actions CI | **8-layer pipeline** with deploy+smoke |
| Docker compose | All 3 (base, dev, prod) |
| Nginx config | Both dev + prod with SSL, WS, rate zones |
| Legal docs | 15 files in `docs/legal/` |

---

## PHASE 0 — Project Foundation

**Plan asks for:** GitHub repo, monorepo structure, backend scaffold (Express+TS), frontend scaffold (Vite+React+TS), env config, Docker (local), CI/CD.

### Status: ✅ DONE (and exceeded)

| Task | Status | Notes |
|------|--------|-------|
| GitHub repo (private) | ✅ | Exists |
| Monorepo structure | ✅ | `backend/`, `frontend/`, `docs/`, `scripts/`, `k6/`, `monitoring/` |
| `.gitignore` | ✅ | Configured |
| `README.md` | ✅ | Exists |
| `LICENSE` | ✅ | BSL 1.1 |
| Backend npm init + TS | ✅ | strict: true, noUnusedLocals/Parameters true |
| Express installed | ✅ | |
| Folder structure | ✅ | config, controllers, middleware, models, routes, services, utils, queues, scripts, types |
| Server boots 0 errors | ✅ | `npm run dev` works |
| ESLint + Prettier | ✅ | 0 warnings |
| Testing framework | ✅ | Vitest (not Jest as plan says — 860 tests) |
| `.env.example` | ✅ | With all variable names |
| Frontend Vite + React + TS | ✅ | Installed |
| Frontend folder structure | ✅ | components, pages, hooks, context, utils, types, assets, styles |
| React Router | ✅ | v7 (plan says v6 — upgraded) |
| Tailwind CSS | ✅ | Installed and configured |
| Environment validation | ✅ | `envValidator.ts` validates all vars on boot |
| Docker compose (local) | ✅ | PostgreSQL 16 + Redis 7 |
| CI/CD | ✅ | 8-layer pipeline (secret scan → semgrep → backend test → frontend test → trivy → deploy → smoke test) |

**Note:** The plan says "Jest" but the project uses **Vitest** — functionally equivalent, better DX.

---

## PHASE 1 — Database + Migrations

**Plan asks for:** 30 tables across 30 migrations, 4 seed files.

### Status: ✅ DONE (29 migrations, exceeded spec)

The plan's 30-table spec vs actual:

| Plan Table | Actual | Status |
|-----------|--------|--------|
| 001: users | ✅ Merged with stats/status/settings/onboarding into `users` table | ✅ Better — fewer joins |
| 002: user_stats | Merged into `users` | ✅ |
| 003: user_status | Managed via `jail_until`, `hospital_until` on `users` | ✅ |
| 004: user_settings | Merged into `users` | ✅ |
| 005: user_onboarding | `onboarding_completed` column on users | ✅ |
| 006: auth_access_log | ✅ `auth_access_log` table | ✅ |
| 007: idempotency_keys | ✅ (key length 128, nullable user_id) | ✅ |
| 008: banned_users | Ban flags on `users` | ✅ |
| 009: trust_scores | ✅ Trust fields on users + `trust_recovery_log` | ✅ |
| 010: fingerprints | ✅ `device_fingerprints` | ✅ |
| 011: crimes | ✅ Extended (is_federal, outcome_weights, energy_cost, specials) | ✅ Exceeded |
| 012: crime_log | Crime details managed via user stats | ⚠️ Partial |
| 013: jail_log | Managed via `jail_until` timestamp | ⚠️ Simplified |
| 014: hospital_log | Managed via `hospital_until` | ⚠️ Simplified |
| 015: factions | ❌ Not built — **gangs** exist instead | ⚠️ Different |
| 016: faction_members | ❌ — gang_members exists | ⚠️ |
| 017: messages | ❌ Not built | ❌ |
| 018: forums | ✅ Built as `forums` table | ✅ |
| 019: forum_posts | ✅ Built | ✅ |
| 020: items | ✅ Items table + 1700000023000_seed-items | ✅ |
| 021: user_inventory | ✅ | ✅ |
| 022: market_listings | ✅ | ✅ |
| 023: bank_transactions | ✅ | ✅ |
| 024: referrals | Referral fields on users | ⚠️ Simplified |
| 025: payment_tiers | ✅ `user_tier_enum`, tier columns on users | ✅ |
| 026: admin_audit_log | ✅ | ✅ |
| 027: game_config | ❌ Not built (config managed via env vars) | ❌ |
| 028: announcements | ❌ Not built | ❌ |
| 029: game_tick_log | ❌ Not built (logged via logger) | ❌ |
| 030: scheduled_jobs | BullMQ Redis-backed | ⚠️ Different approach |

**Additional tables built** (beyond plan):
- `crime_specials`, `user_crime_progress`, `user_crime_specials`
- `uac_violations`, `support_tickets`
- `gym`, `pvp_attacks`, `travel`, `jobs`, `properties`, `casino` tables
- `gangs`, `gang_members`, `gang_wars`, `linked_gangs`
- `forum_categories`, `forum_threads`, `forum_posts`
- `calendar_events`, `newspaper_articles`, `missions`

**Seeds:**
| Plan Seed | Actual | Status |
|-----------|--------|--------|
| 001: 25 crimes (5×5) | ✅ 25 crimes seeded | ✅ |
| 002: game_config | ❌ Not built | ❌ |
| 003: 50 items | ✅ Items seeded | ✅ |
| 004: admin user | ❌ Manual process | ❌ |

---

## PHASE 2 — Backend Core — Auth

**Plan asks for:** Firebase setup, auth middleware, auth service (register/login/logout/delete/export), 10 auth routes, Google SSO, rate limiting, 16 tests.

### Status: ✅ DONE (exceeded in some areas, different approach in others)

| Plan Task | Actual | Status |
|-----------|--------|--------|
| Firebase project created | ✅ | |
| Email/password provider | ✅ | |
| Google SSO provider | ✅ | |
| Firebase Admin SDK | ✅ | |
| verifyFirebaseToken middleware | ✅ | 14 middleware files |
| requireAdmin middleware | ✅ | + requireModerator added |
| requireOnboarded middleware | ✅ | |
| registerUser() | ✅ via `/auth/sync` (Firebase-first) | ⚠️ Different flow |
| loginUser() | ✅ Firebase handles auth, backend syncs | ⚠️ |
| logoutUser() | ✅ | |
| deleteAccount() | ✅ GDPR delete endpoint | |
| exportAccountData() | ✅ GDPR export endpoint (3/day rate limit) | |
| POST /auth/register | ✅ via `/sync` | ✅ |
| POST /auth/login | ✅ Firebase managed | ✅ |
| POST /auth/logout | ✅ | |
| POST /auth/refresh | ✅ Firebase handles | ✅ |
| POST /auth/verify-email | ✅ Firebase handles | ✅ |
| POST /auth/resend-verification | ✅ Firebase handles | ✅ |
| POST /auth/forgot-password | ✅ Firebase handles | ✅ |
| POST /auth/reset-password | ✅ Firebase handles | ✅ |
| DELETE /auth/delete-account | ✅ GDPR endpoint | ✅ |
| GET /auth/export-data | ✅ GDPR endpoint | ✅ |
| Google SSO flow | ✅ | |
| Rate limiting on auth | ✅ authSyncLimiter, authMeLimiter, etc. | ✅ |
| Tests | ✅ Covered across middleware tests | ✅ |

**Additional:** MFA routes (`/mfa/status`, `/mfa/instructions`, `/mfa/log-change`), Turnstile CAPTCHA verification, UAC challenge system, username availability check endpoint, onboarding-complete endpoint.

---

## PHASE 3 — Backend Core — Game Engine

**Plan asks for:** Crime service, crime engine, jail service, hospital service, tests (Week 1) + Stat service, nerve service, game tick, BullMQ queues, WebSocket, tests (Week 2). Target: 519+ tests.

### Status: ✅ DONE (860 tests total — exceeded)

| Week 1 | Actual | Status |
|--------|--------|--------|
| getCrimes() | ✅ | |
| attemptCrime() | ✅ Full flow with pre-flights | |
| Crime pre-flight checks | ✅ Not jailed, not hospitalized, nerve, level | |
| Weighted outcome | ✅ crypto.randomInt | |
| Reward/penalty apply | ✅ | |
| Nerve deduct | ✅ | |
| XP award | ✅ | |
| Crime history paginated | ✅ via crime stats | |
| Crime stats | ✅ Success rate, total earned | |
| Crit fail negative (t3-5) | ✅ | |
| Debt mechanic | ✅ Negative cash state | |
| Sanity cap | ✅ Max single crime reward | |
| Jail service (jailUser) | ✅ | |
| Bust out of jail | ❌ Stub/coming soon | ❌ |
| Hospital service (admit) | ✅ | |
| Release from jail/hospital | ✅ Auto via game tick | |
| Tests (Week 1) | ✅ Covered | |

| Week 2 | Actual | Status |
|--------|--------|--------|
| getUserStats() | ✅ | |
| updateStats() atomic | ✅ Row-level lock | |
| levelUp() | ✅ XP threshold check | |
| allocateStatPoints() | ❌ Not built | ❌ |
| Nerve service | ✅ Tier-aware regen | |
| Game tick (60s) | ✅ 7 parallel sub-tasks | |
| Circuit breaker | ✅ 3 failures → 5min pause | |
| Partial failure tracking | ✅ Alert at threshold | |
| Slow tick alert (>30s) | ✅ | |
| Tick log | ✅ Logged via logger | |
| Never runs in test mode | ✅ NODE_ENV check | |
| BullMQ queues | ✅ 5 workers (trust, backup, idempotency, email, payment) | ✅ |
| WebSocket service | ✅ Socket.IO with auth, rooms, events | ✅ |
| Reconnection handling | ✅ Exponential backoff | ✅ |
| Heartbeat (ping/pong) | ✅ 30s | ✅ |
| Tests (Week 2) | ✅ Covered | |

**Additional:** PvP attack system, gym training, job system, travel system, property system, casino, missions, loyalty/church, leaderboard, newspaper, calendar events, forum, gang system (create/join/leave/kick), gang wars, linked gangs/alliances, support tickets.

---

## PHASE 4 — Backend Core — Economy

**Plan asks for:** Bank service (deposit/withdraw/transfer/balance/history), market service (list/buy/cancel/listings), inventory service (get/use/drop), referral service, routes, tests.

### Status: ✅ DONE (exceeded)

| Task | Actual | Status |
|------|--------|--------|
| Bank deposit (atomic) | ✅ | |
| Bank withdraw (balance check) | ✅ | |
| Bank transfer (tax, no jailed) | ✅ 5% tax | |
| Bank balance | ✅ | |
| Bank history paginated | ✅ | |
| POST /bank/deposit | ✅ | |
| POST /bank/withdraw | ✅ | |
| POST /bank/transfer | ✅ Idempotent | |
| GET /bank/balance | ✅ | |
| GET /bank/history | ✅ | |
| Market listItem | ✅ | |
| Market buyItem (atomic) | ✅ | |
| Market cancelListing | ✅ | |
| Market getListings (search/filter) | ✅ | |
| Market getMyListings | ✅ | |
| POST /market/list | ✅ | |
| POST /market/buy/:listingId | ✅ Idempotent | |
| DELETE /market/listing/:listingId | ✅ | |
| GET /market/listings | ✅ | |
| GET /market/my-listings | ✅ | |
| Inventory getInventory (paginated) | ✅ | |
| Inventory useItem | ✅ | |
| Inventory dropItem | ✅ | |
| Referral generateCode | ✅ | |
| Referral applyCode | ✅ | |
| Referral stats | ✅ | |
| Tests | ✅ 860 total | |

**Additional economy features** beyond plan: Casino (coinflip/roulette/slots), property system (buy/collect income), stock market, travel system, job pay system, attack loot.

---

## PHASE 5 — Backend Hardening

**Plan asks for:** Security middleware (rate limiting, Helmet, CSP, CORS, request size, IP allowlist, bot detection, honeypot), anti-cheat systems (trust engine, behavior analysis, fingerprinting, VPN detection, shadow ban, hard ban, idempotency), global error handler, graceful shutdown, Nginx config, tests.

### Status: ✅ DONE (exceeded)

| Task | Actual | Status |
|------|--------|--------|
| Rate limiting (Redis-backed) | ✅ Global 100/min, auth 10/15min, game 30/min, crime 30/min, memory fallback | |
| Helmet.js | ✅ | |
| CSP hardened | ✅ | |
| CORS (frontend domain) | ✅ | |
| Request size limiting | ✅ 100kb JSON body | |
| IP allowlist (admin) | ✅ | |
| Bot detection (user-agent) | ✅ In Nginx config | |
| Honeypot routes | ✅ 14 honeypot routes | |
| Trust engine | ✅ 14 violation types, 5 tiers | |
| Behavior analysis | ✅ Timing, earnings, hours, success rate | |
| Browser fingerprinting | ✅ SHA256 dual-hash | |
| VPN detection | ✅ IP reputation, fail-open, 6h cache | |
| Shadow ban (4 tiers) | ✅ Delay, reduced rewards, failures, frozen | |
| Hard ban | ✅ Firebase revoke + DB flag | |
| Idempotency | ✅ SETNX lock, 30s TTL, nullable user_id | |
| Global error handler | ✅ PG mapping, Zod formatting, Sentry, no stack leaks | |
| Graceful shutdown | ✅ SIGTERM, drain, close pools, exit 0 | |
| Nginx config | ✅ Prod config with rate zones, bot blocking, WebSocket proxy, SSL | |
| Tests | ✅ | |

**Additional:** Turnstile CAPTCHA, UAC challenge system, immunity checks (cached), request ID (UUID v7) on every request, violation logging, dual-cache (Redis hot + DB cold) for bans, `rateLimiter.ts` with 18 named limiters.

---

## PHASE 6 — Backend Testing + Lock

**Plan asks for:** 600+ tests, 0 TS errors, 0 ESLint warnings, lock backend files, CI/CD green.

### Status: ✅ DONE (exceeded)

| Metric | Plan Target | Actual | Status |
|--------|-------------|--------|--------|
| Tests | 600+ | **860** (56 files) | ✅ Exceeded by 43% |
| TypeScript errors | 0 | **0** | ✅ |
| ESLint warnings | 0 | **0** | ✅ |
| Lint-staged | — | ✅ | |
| Backend locked per COMPLETED.md | ✅ | All files listed in COMPLETED.md | ✅ |

**Lock status from existing COMPLETED.md:**
```
backend/src/middleware/*     — all 14 files
backend/src/services/*       — all 12 files (at time of lock)
backend/src/controllers/*    — locked
backend/src/routes/*         — all 11 files (at time of lock)
backend/src/utils/*          — all 12 files
backend/src/config/*         — all 8 files
backend/src/models/*         — both files
backend/src/queues/*         — all 3 files
backend/src/scripts/*        — all 7 files
nginx.conf, nginx.prod.conf  — locked
docker-compose.yml, dev, prod — locked
```

**Note:** Since lock, new files have been added (routes, services) — this is correct per the "new features = new files" rule.

---

## PHASE 7 — Frontend Foundation

**Plan asks for:** Design system (colors, typography, base components), routing, API client, auth context, WebSocket context, layout.

### Status: ✅ DONE (exceeded)

| Task | Actual | Status |
|------|--------|--------|
| Dark theme (crime aesthetic) | ✅ #0a0a0f bg, #8b5cf6 purple primary | |
| Color palette | ✅ Exact plan colors | |
| Typography | ✅ Inter font | |
| Base components: Button | ✅ | |
| Base components: Input | ✅ Forms have validation | |
| Base components: Card | ✅ Via Shell layout | |
| Base components: Badge | ✅ | |
| Base components: Modal | ✅ + ConfirmModal | |
| Base components: Toast | ✅ ToastContainer | |
| Base components: Spinner | ✅ Skeleton component | |
| Base components: Progress bar | ✅ Stat bars in Shell | |
| Base components: Countdown | ✅ Countdown.tsx | |
| Base components: Avatar | ✅ Via player display | |
| React Router | ✅ v7 (plan said v6) | |
| All 30+ routes | ✅ 43 page files | |
| ProtectedRoute | ✅ | |
| AdminRoute | ✅ | |
| API client (Axios) | ✅ With token refresh, interceptors, 10s timeout | |
| Typed API calls | ✅ 26 service files with TypeScript interfaces | |
| AuthContext | ✅ AuthContext + AuthProvider + useAuth hook | ✅ |
| WebSocket context | ✅ Socket.IO client with auto-reconnect | ✅ |
| AppLayout (sidebar) | ✅ Shell.tsx — 421 lines | ✅ |
| AuthLayout | ✅ Separate layout for auth pages | ✅ |
| Bottom nav (mobile) | ✅ In Shell.tsx | ✅ |
| Error boundary | ✅ ErrorBoundary wrapping entire app | ✅ |
| Notification bell | ✅ In Shell.tsx | ✅ |

**Additional:** PageTransition animations, OdometerNumber animated counter, Icon component, EmptyState, SkipNav (accessibility), FocusTrap hook, Firebase Auth integration with Google SSO, React Query hooks, PostHog analytics, FingerprintJS.

---

## PHASE 8 — Frontend — Auth Flow

**Plan asks for:** Landing page, Register page, Login page, Email verification, Forgot password, Onboarding flow.

### Status: ✅ DONE (exceeded)

| Task | Actual | Status |
|------|--------|--------|
| Landing page | ✅ 214 lines — hero, features, CTA, crime preview, stats | |
| Register page | ✅ 656 lines — username/email/password/terms/age gate/Google SSO | |
| Login page | ✅ 392 lines — email/password/Google SSO/forgot password | |
| Email verification | ✅ Firebase handles + resend rate limited | |
| Forgot password | ✅ Firebase handles | |
| Onboarding (5 steps) | ✅ 197 lines — welcome/rules/privacy/first crime/referral | |
| Age gate | ✅ 18+ verification component | |
| Cookie banner | ✅ GDPR-compliant with granular opt-in | |
| Legal pages | ✅ 318 lines covering TOS, Privacy, Cookies, Refund, Rules | |

**Additional:** Contributor page, Black Card page, About page, Google SSO with email collision handling.

---

## PHASE 9 — Frontend — Core Game UI

**Plan asks for:** Dashboard with stat bars, Crimes page with tier grouping and result modals, Jail/Hospital pages with countdowns, Profile page, Settings page.

### Status: ✅ DONE (exceeded — but 3 frontend build errors exist)

| Week 1 | Actual | Status |
|--------|--------|--------|
| Dashboard stat bars | ✅ Real-time via WebSocket | ✅ |
| Quick stats (level, XP, cash) | ✅ | ✅ |
| Current status chip | ✅ Active/jailed/hospitalized | ✅ |
| Activity feed (recent crimes) | ✅ | ✅ |
| Quick crime button | ✅ | ✅ |
| Announcement banner | ✅ | ✅ |
| Crimes tier grouping | ✅ 5 tiers: Street/Hustle/Racket/Cartel/Syndicate | ✅ |
| Crime cards with details | ✅ Name, nerve cost, reward, success rate | ✅ |
| Tier tabs | ✅ | ✅ |
| Locked tiers grayed out | ✅ | ✅ |
| Attempt button → loading → result modal | ✅ | ✅ |
| Result modal with animations | ✅ Special/success/failure/crit_fail states | ✅ |
| Nerve bar real-time update | ✅ | ✅ |
| Insufficient nerve = disabled | ✅ | ✅ |
| Cannot attempt if jailed/hospitalized | ✅ Redirects | ✅ |

| Week 2 | Actual | Status |
|--------|--------|--------|
| Jail page with countdown | ✅ 161 lines — auto-redirect on release | ✅ |
| Hospital page with countdown | ✅ 161 lines — auto-redirect on release | ✅ |
| All actions disabled while jailed | ✅ | ✅ |
| "Bust out" coming soon | ✅ | ✅ |
| Profile page (/profile/:username) | ✅ 149 lines — stats, crime history, badges | ✅ |
| Settings page | ✅ 237 lines — account, notifications, privacy, danger zone | ✅ |

**⚠️ ISSUE:** 3 frontend build errors (`tsc -b`):
- `Church.tsx:35` — `maxHappiness` doesn't exist on `User` type
- `Church.tsx:75` — `selectedDonation` possibly null
- `PublicRecords.tsx:69` — `Icon` component has no `style` prop

These prevent production builds but don't affect `tsc --noEmit` (standalone).

---

## PHASE 10 — Frontend — Advanced UI

**Plan asks for:** Bank, market, inventory, messages, factions, forums, leaderboard — all functional.

### Status: ⚠️ MOSTLY DONE (messages missing, factions = gangs)

| Page | Plan Requires | Actual | Status |
|------|-------------|--------|--------|
| Bank page | Deposit/withdraw/transfer/history | ✅ 337 lines — full banking UI | ✅ |
| Market page | Browse/buy/list/cancel | ✅ 269 lines — full market UI (BlackMarket.tsx) | ✅ |
| Inventory page | Grid, use, drop, list | ✅ 144 lines — item grid with actions | ✅ |
| Messages page | Inbox, compose, read, delete | ❌ **Not built** — no messages page | ❌ |
| Factions page | Browse, create, join, leave | ✅ **Gangs** — 64 lines — gangs.memberlist, join/leave/kick | ⚠️ As gangs, not factions |
| Forums page | Threads, create, reply | ✅ 107 lines + ForumThread.tsx (93 lines) | ✅ |
| Leaderboard page | Tabs by category, highlight user | ✅ 98 lines — ranking/leaderboards | ✅ |

**Stub pages remaining:**
| Page | Lines | Status |
|------|-------|--------|
| Company.tsx | **5** | ❌ ComingSoon stub |
| Events.tsx | **5** | ❌ ComingSoon stub |
| City.tsx | **5** | ❌ ComingSoon stub |

**Note:** The plan's "factions" system is implemented as **gangs** — slightly different but same concept.

---

## PHASE 11 — Payments + Legal

**Plan asks for:** Lemon Squeezy integration, 2 products (Contributor $7.99/mo, Black Card $4.99), webhook, upgrade page, legal pages, GDPR implementation.

### Status: ⚠️ BACKEND DONE, FRONTEND PARTIAL

| Task | Actual | Status |
|------|--------|--------|
| Lemon Squeezy account | Created (backend config exists) | ✅ |
| Contributor product ($7.99/mo) | ✅ In TIER_CONFIG | ✅ |
| Black Card ($4.99 one-time) | ✅ In TIER_CONFIG | ✅ |
| Checkout links integrated | ✅ Backend generates Lemon Squeezy checkout URL | ✅ |
| Webhook endpoint | ✅ POST /webhooks/lemonsqueezy — HMAC-signed, processes subscription_created/renewed/cancelled/expired and order_created | ✅ |
| Upgrade page | ❌ **Not built** — BlackCard.tsx and Contributor.tsx are informational only, no purchase UI | ❌ |
| Legal pages | ✅ 318 lines Legal.tsx + 15 docs in `docs/legal/` | ✅ |
| GDPR cookie consent | ✅ CookieBanner.tsx with granular opt-in | ✅ |
| Age gate | ✅ AgeGate.tsx 18+ verification | ✅ |
| Data export | ✅ GDPR export endpoint (3/day) | ✅ |
| Account deletion | ✅ GDPR delete endpoint (3/day) | ✅ |

---

## PHASE 12 — Admin Panel

**Plan asks for:** Overview stats, user management (search, view, ban/shadow/unban), game management (crime editor, game config, announcements), monitoring (tick log, error log, auth log, honeypot hits, queue status).

### Status: ✅ DONE (exceeded — but missing game config editor and announcements)

| Task | Actual | Status |
|------|--------|--------|
| Overview stats | ✅ Dashboard with user counts, ban counts, violations, new IPs | ✅ |
| Search users | ✅ By username or email | ✅ |
| User detail view | ✅ Full profile: violations, fingerprints, linked accounts, crimes, transactions, IP history, trust log | ✅ |
| Hard ban | ✅ + Firebase revoke + IP blacklist | ✅ |
| Soft ban | ✅ Shadow ban (4 tiers) | ✅ |
| Remove ban | ✅ Unban + restore trust | ✅ |
| Force logout | ✅ Firebase revoke session | ✅ |
| Manually jail/release | ✅ Admin jailing/release via user management | ✅ |
| Give/remove cash | ✅ `adjustMoney` endpoint | ✅ |
| Crime editor | ❌ Not built | ❌ |
| Game config editor | ❌ Not built (no game_config table) | ❌ |
| Announcements | ❌ Not built | ❌ |
| Game tick log | ✅ Queue stats, worker statuses, tick info | ✅ |
| Error log | ❌ No Sentry iframe/log viewer in admin | ❌ |
| Auth access log | ✅ Via `getViolations()` | ✅ |
| Honeypot hits | ✅ Via violation log | ✅ |
| BullMQ queue status | ✅ `getQueueStats()` endpoint | ✅ |
| Multi-account detection | ✅ Fingerprint-based grouping | ✅ Exceeded |
| Earnings anomalies | ✅ Velocity analysis | ✅ Exceeded |

---

## PHASE 13 — Harden + Anti-Cheat Verify

**Plan asks for:** Manual abuse testing (13 scenarios), UI hardening (ComingSoon, error boundaries, loading states, debt state UI), performance (Lighthouse > 80, images, code splitting, bundle < 500kb gzipped), mobile audit.

### Status: ⚠️ BACKEND HARD, FRONTEND PARTIAL

| Abuse Scenario | Status | Notes |
|---------------|--------|-------|
| Commit faster than nerve allows | ✅ Rate limited + nerve check | ✅ |
| Same crime twice simultaneously | ✅ Idempotency (SETNX lock) | ✅ |
| Access admin as regular user | ✅ requireAdmin middleware | ✅ |
| Negative transfer amount | ✅ Zod validation | ✅ |
| Buy your own listing | ✅ Logic prevents | ✅ |
| List item you don't have | ✅ Inventory check | ✅ |
| Jail yourself | ✅ Server-side only | ✅ |
| Expired idempotency key | ✅ TTL enforced | ✅ |
| Bypass rate limits (concurrent) | ✅ Redis-backed, atomic | ✅ |
| SQL injection | ✅ Parameterized queries + sanitize middleware | ✅ |
| XSS via inputs | ✅ CSP + sanitize middleware | ✅ |
| Access another user's data | ✅ IDOR protection | ✅ |
| Crime while jailed (API direct) | ✅ Pre-flight check on attempt | ✅ |

| UI Hardening | Status | Notes |
|-------------|--------|-------|
| ComingSoon on stub pages | ✅ 3 stubs use ComingSoon | ✅ |
| Error boundaries | ✅ ErrorBoundary on every page | ✅ |
| Loading states | ✅ Skeleton + Spinner | ✅ |
| Double-submit prevention | ✅ Disabled during submission | ✅ |
| Negative money rejection | ✅ Client-side validation | ✅ |
| Max length enforced | ✅ Input validation | ✅ |
| Debt state warning | ❌ **Not built** — no debt banner | ❌ |

| Performance | Status | Notes |
|------------|--------|-------|
| Lighthouse > 80 | ❌ Not measured | ❌ |
| Images optimized (WebP) | ❌ Not checked | ❌ |
| Code splitting (lazy) | ✅ React.lazy on all pages | ✅ |
| Bundle size < 500kb | ❌ Not measured | ❌ |

| Mobile Audit | Status | Notes |
|-------------|--------|-------|
| 375px (iPhone SE) | ❌ Not verified | ❌ |
| 390px (iPhone 14) | ❌ Not verified | ❌ |
| 768px (iPad) | ❌ Not verified | ❌ |
| Sidebar → bottom nav | ✅ Shell.tsx responsive | ✅ |
| Tap targets > 44px | ❌ Not verified | ❌ |
| No horizontal scroll | ❌ Not verified | ❌ |

---

## PHASE 14 — Load Testing

**Plan asks for:** k6, Artillery, clinic.js. Scenarios: ramp-up (0→500), crime spike, WebSocket (500 concurrent), 24h soak. Pass criteria: p95 < 500ms, error < 0.1%, no memory leak, WebSocket stable.

### Status: ⚠️ SCRIPTS EXIST, TESTS NOT RUN

| Task | Actual | Status |
|------|--------|--------|
| k6 installed | ✅ (script exists) | ✅ |
| Ramp-up test (0→500) | ❌ Not run | ❌ |
| Crime spike test | ✅ Script written (500 concurrent) | ⚠️ Not run |
| WebSocket load test | ❌ Not built | ❌ |
| 24h soak test | ❌ Not built | ❌ |

---

## PHASE 15 — Security Audit

**Plan asks for:** OWASP ZAP, Burp Suite, sqlmap, npm audit. Manual tests: auth bypass, SQLi, XSS, IDOR, rate limit bypass, business logic.

### Status: ⚠️ SCRIPTS EXIST, FULL AUDIT NOT DONE

| Task | Actual | Status |
|------|--------|--------|
| OWASP ZAP full scan | ❌ Not run | ❌ |
| npm audit | ❌ Not run in this session | ❌ |
| Manual auth bypass tests | ✅ Anti-cheat layers tested in Phase 13 | ⚠️ Informal |
| Manual SQL injection tests | ✅ Sanitize middleware + parameterized queries | ⚠️ |
| Manual XSS tests | ✅ CSP + sanitize | ⚠️ |
| Manual IDOR tests | ✅ Authorization checks | ⚠️ |
| Manual business logic tests | ✅ Various scenarios tested | ⚠️ |

---

## PHASE 16 — VPS + Deployment

**Plan asks for:** Hetzner CX22, server hardening, Docker stack, Nginx SSL, DNS (Cloudflare), frontend (Cloudflare Pages), CI/CD, backups, monitoring.

### Status: ⚠️ CONFIG READY, NOT DEPLOYED

| Task | Actual | Status |
|------|--------|--------|
| Hetzner VPS purchased | ❌ Blocked — needs credit card | ❌ |
| Server hardening | ❌ Not done | ❌ |
| Production Docker stack | ✅ `docker-compose.prod.yml` ready | ✅ |
| Nginx SSL config | ✅ `nginx.prod.conf` ready (Let's Encrypt) | ✅ |
| DNS Cloudflare | ✅ Domain: undercity.online | ✅ Config ready |
| Frontend Cloudflare Pages | ✅ Config ready | ✅ |
| CI/CD auto-deploy | ✅ GitHub Actions deploy.yml with rollback | ✅ |
| Backups | ✅ Hetzner snapshots configured | ✅ Config ready |
| Monitoring | ✅ UptimeRobot, Sentry, PostHog configured | ✅ Config ready |

---

## PHASE 17 — Staging + Internal QA

**Plan asks for:** Full QA checklist on live VPS: auth, core game loop, economy, social, admin, mobile.

### Status: ❌ NOT DONE (requires VPS from Phase 16)

---

## PHASE 18 — Beta

**Plan asks for:** 4-week beta (50→200→500→close), Discord, feedback, monitoring.

### Status: ❌ NOT DONE (requires Phases 16-17)

---

## PHASE 19 — Pre-Launch Polish

**Plan asks for:** Bug fixes, Lighthouse audit, security check, email templates, maintenance page, final backup.

### Status: ❌ NOT DONE (requires Phases 16-18)

---

## PHASE 20 — PUBLIC LAUNCH

**Plan asks for:** Dec 15, 2026 — ProductHunt, Reddit, Twitter, Discord, email blast. Target: 5,000 players.

### Status: ❌ NOT YET
- Target date: December 15, 2026
- Current: June 2026
- Launch sequence, content, and channels are documented in existing `docs/LAUNCH_CHECKLIST.md` and `MARKETING.md` (in new plan)

---

## GLOBAL SUMMARY

| Phase | Theme | New Plan Status | Real Codebase Status |
|-------|-------|----------------|---------------------|
| **0** | Project Foundation | 🔲 | ✅ DONE |
| **1** | Database + Migrations | 🔲 | ✅ DONE (exceeded) |
| **2** | Backend Core — Auth | 🔲 | ✅ DONE |
| **3** | Backend Core — Game Engine | 🔲 | ✅ DONE (exceeded) |
| **4** | Backend Core — Economy | 🔲 | ✅ DONE (exceeded) |
| **5** | Backend Hardening | 🔲 | ✅ DONE (exceeded) |
| **6** | Backend Testing + Lock | 🔲 | ✅ DONE (exceeded) |
| **7** | Frontend Foundation | 🔲 | ✅ DONE (exceeded) |
| **8** | Frontend — Auth Flow | 🔲 | ✅ DONE (exceeded) |
| **9** | Frontend — Core Game UI | 🔲 | ✅ DONE (⚠️ 3 build errors) |
| **10** | Frontend — Advanced UI | 🔲 | ⚠️ MOSTLY DONE (messages missing, 3 stubs) |
| **11** | Payments + Legal | 🔲 | ⚠️ Backend done, frontend partial |
| **12** | Admin Panel | 🔲 | ✅ DONE (exceeded, missing editor) |
| **13** | Harden + Anti-Cheat | 🔲 | ⚠️ Backend hard, frontend partial |
| **14** | Load Testing | 🔲 | ⚠️ Scripts exist, not run |
| **15** | Security Audit | 🔲 | ❌ Not done |
| **16** | VPS + Deployment | 🔲 | ⚠️ Config ready, not deployed (blocked: credit card) |
| **17** | Staging + Internal QA | 🔲 | ❌ Not done |
| **18** | Beta | 🔲 | ❌ Not done |
| **19** | Pre-Launch Polish | 🔲 | ❌ Not done |
| **20** | PUBLIC LAUNCH 🚀 | 🔲 | ❌ Dec 15, 2026 target |

---

## KEY GAPS TO FILL (Priority Order)

### 🔴 Critical (blocks launch)
1. **Frontend build broken** — 3 TS errors in Church.tsx and PublicRecords.tsx
2. **Messages/Inbox page** — completely missing (no frontend page)
3. **Debt state UI warning banner** — not built
4. **VPS purchase + deployment** — blocked by credit card (Phase 16)
5. **Staging + Internal QA** — cannot happen without VPS (Phase 17)

### 🟡 Important
6. **Upgrade page** — no purchase/checkout UI exists (Phase 11)
7. **Game config editor** — no admin backend (Phase 12)
8. **Announcements system** — no admin backend
9. **`game_config` table** — not in database
10. **Crime editor** — not in admin panel
11. **3 stub pages** — Company, Events, City (Phase 10)

### 🟢 Nice to Have
12. Lighthouse audit + performance optimization (Phase 13)
13. Load testing execution (Phase 14)
14. Full security audit (Phase 15)
15. Mobile responsive audit at breakpoints
16. Bundle size optimization (< 500kb gzipped)
17. Messages/factions (plan says factions, codebase has gangs)
18. `allocateStatPoints()` — stat allocation on level-up
19. Bust-out-of-jail mechanic

---

## WHAT THE CODEBASE HAS THAT THE PLAN DOESN'T MENTION

- PvP attack system with search, log, loot
- Casino (coinflip/roulette/slots)
- Stock market
- Travel system (cities, flights)
- Property system (buy, collect income)
- Church/loyalty system (donations)
- Public records page
- Federal jail variant
- Support ticket system with moderator roles
- BullMQ workers for 5 job types
- Prometheus metrics endpoint
- Console-based honeypot routes
- Turnstile CAPTCHA integration
- UAC challenge token system
- Immunity check caching
- `alerts.ts` — Discord webhook alerting
- `profanityFilter.ts` — username filtering
- `userCache.ts` — Redis-based caching layer
- `fingerprint.ts` — frontend FingerprintJS integration
- 15 legal compliance documents in `docs/legal/`
- `monitoring/` directory
- `k6/crime-load-test.js`

---

## SCORE CARD

| Area | Score | Notes |
|------|-------|-------|
| Backend completeness | **95%** | Game engine, economy, anti-cheat, auth all exceeding spec |
| Frontend completeness | **85%** | Missing messages, 3 stubs, 3 build errors |
| Infrastructure readiness | **70%** | All configs ready but not deployed (credit card block) |
| Testing | **90%** | 860 backend + 147 frontend, all passing |
| Security | **80%** | Anti-cheat built, but no formal audit done |
| Legal/Compliance | **90%** | All pages + docs exist |
| Marketing/Launch | **50%** | Plans written, nothing executed yet |
| **Overall** | **80%** | Backend is launch-ready, frontend needs polish, deployment is blocked |
