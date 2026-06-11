# UNDERCITY — MERGED PRODUCTION PLAN
# 20 Phases + Codebase Reality | Solo Dev | 4hr/day | Launch: Dec 15, 2026
# Last Updated: June 2026

---

## DEVELOPER PROFILE
- Age: 19
- Solo developer
- 4 hours/day available
- No budget until credit card obtained
- All free tools until revenue exists

---

## PHASE OVERVIEW

| Phase | Name | Status | Backend | Frontend | Target |
|-------|------|--------|---------|----------|--------|
| 0 | Project Foundation | ✅ BUILD DONE | Complete | Complete | Jun 8-14 |
| 1 | Database + Migrations | ✅ BUILD DONE | Complete | — | Jun 15-21 |
| 2 | Backend Core — Auth | ✅ BUILD DONE | Complete | Complete | Jun 22-28 |
| 3 | Backend Core — Game Engine | ✅ BUILD DONE | Complete | Complete | Jun 29 - Jul 12 |
| 4 | Backend Core — Economy | ✅ BUILD DONE | Complete | Complete | Jul 13-19 |
| 5 | Backend Hardening | ✅ BUILD DONE | Complete | — | Jul 20-26 |
| 6 | Backend Testing + Lock | ✅ BUILD DONE | Complete | — | Jul 27 - Aug 2 |
| 7 | Frontend Foundation | ✅ BUILD DONE | — | Complete | Aug 3-9 |
| 8 | Frontend — Auth Flow | ✅ BUILD DONE | Complete | Complete | Aug 10-16 |
| 9 | Frontend — Core Game UI | ✅ BUILD DONE | Complete | Complete | Aug 17-30 |
| 10 | Frontend — Advanced UI | ✅ BUILD DONE | Completed | Completed | Aug 31 - Sep 13 |
| 11 | Payments + Legal | ⚠️ NEEDS PROD SETUP | Skeleton done | Legal+Bank done | Sep 14-20 |
| 12 | Admin Panel | ✅ BUILD DONE | Complete | Complete | Sep 21-27 |
| 13 | Harden + Anti-Cheat | ✅ BUILD DONE | Complete | Scripts ready | Sep 28 - Oct 4 |
| 14 | Load Testing | ✅ SCRIPTS READY | — | k6 scripts done | Oct 5-11 |
| 15 | Security Audit | ✅ SCRIPTS READY | — | Audit script ready | Oct 12-18 |
| 16 | VPS + Deployment | ✅ CONFIG READY | — | Deploy workflow ready | Oct 19-25 |
| 17 | Staging + Internal QA | ✅ CHECKLIST READY | — | QA doc ready | Oct 26 - Nov 1 |
| 18 | Beta | ✅ PLAN READY | — | Beta plan ready | Nov 2-30 |
| 19 | Pre-Launch Polish | ✅ CHECKLIST READY | — | Launch checklist ready | Dec 1-14 |
| 20 | PUBLIC LAUNCH 🚀 | ✅ PLAN READY | — | Launch sequence ready | Dec 15 |

**Current codebase state:**
- Backend: 786 tests (41 files), 0 TS errors, 0 ESLint warnings — **LOCKED**
- Frontend: 147 tests (13 files), builds in 0.9s — **IN PROGRESS**
- 36 frontend pages exist (20 real, 16 stubs)
- 4 new backend routes: leaderboard, profile, bank-history pagination
- 4 new services: bank, market, inventory, leaderboard, profile
- Ops scripts: k6 load tests, abuse testing checklist, security audit, deploy workflow, QA/launch checklists

---

## DONE SIGNAL SYSTEM
Every phase has one DONE SIGNAL.
You do not move to the next phase until it passes.
For phases 0-6: the DONE SIGNAL is an AUDIT.
For phases 7-20: the DONE SIGNAL is a BUILD.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 0 — Project Foundation
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jun 8-14, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Backend builds with 0 errors, folder structure exists,
git initialized, CI/CD green on push, Docker compose valid.
**AUDIT: verify the existing codebase against this spec.**

### Reference Files
- `backend/src/server.ts` — Express server entry
- `backend/src/app.ts` — Express app factory (no boot logic)
- `backend/src/config/index.ts` — Env-driven config loader
- `backend/src/utils/envValidator.ts` — Zod env validation
- `backend/Dockerfile` — Multi-stage production build
- `docker-compose.yml` + `docker-compose.dev.yml` + `docker-compose.prod.yml`
- `nginx.conf` + `nginx.prod.conf`
- `.github/workflows/ci.yml`
- `DEPLOYMENT.md`, `RUNBOOK.md`, `BCP.md`, `COST.md`

### Audit Checklist

#### Repo + Structure ✅
- [x] GitHub repo exists (private, will go public at launch)
- [x] Monorepo structure: `backend/`, `frontend/`, `docs/`, `scripts/`
- [x] `.gitignore` configured (node_modules, .env, dist, coverage)
- [x] `README.md` with description
- [x] `LICENSE` file (BSL 1.1)

#### Backend Scaffold ✅
- [x] npm init in `backend/`
- [x] TypeScript + tsconfig.json (`strict: true`)
- [x] Express installed
- [x] Folder structure: config, controllers, middleware, models, routes, services, utils, queues, scripts, types
- [x] Server boots with 0 errors (`npm run dev`)
- [x] ts-node-dev configured for development
- [x] ESLint + Prettier + Commitlint + Husky configured
- [x] Vitest configured (we use Vitest, not Jest — equivalent)
- [x] `.env.example` with all variable names

#### Frontend Scaffold 🔲 (not yet built — Phase 7)
- [ ] Vite + React + TypeScript in `frontend/`
- [ ] Folder structure
- [ ] React Router v6
- [ ] App.tsx with placeholder route
- [ ] Tailwind CSS

#### Environment ✅
- [x] `.env` with all variables
- [x] Config loader validates all required vars on startup (`config/index.ts` + `envValidator.ts`)

#### Docker (Local) ✅
- [x] `docker-compose.yml` for local dev: PostgreSQL 16 + Redis 7
- [x] Both containers start with `docker-compose up`
- [x] `.dockerignore` configured

#### CI/CD ✅
- [x] GitHub Actions workflow (`.github/workflows/ci.yml`)
- [x] Runs on push to main: build, tsc --noEmit, test, ESLint

### Gaps to Fill
- [ ] Create `frontend/` scaffold (moved to Phase 7)
- [ ] Make repo public before launch (Phase 19)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 1 — Database + Migrations
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jun 15-21, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
All migrations run on fresh DB. All tables exist.
All seeds applied. Rollback works on every migration.
**AUDIT: verify our 23 migrations against this 30-table spec.**

### Reference Files
- `backend/migrations/*` — 23 files (append-only, never modify existing)
- `backend/src/config/database.ts` — Pool config + `withTransaction` helper
- `backend/docs/database.md` — Schema documentation

### Audit Checklist

#### Core User Tables ✅ (our table names differ slightly, check mapping)

Our actual schema vs their spec:

| Their Table | Our Equivalent | Status |
|-------------|---------------|--------|
| Migration 001: users | `users` table | ✅ Fields differ (we have firebase_uid, nerve, life, jail/hospital timestamps, trust fields, etc.) |
| Migration 002: user_stats | Fields merged into `users` | ✅ our `users` table has all stat fields inline |
| Migration 003: user_status | State managed via `jail_until`, `hospital_until` columns on `users` | ✅ Equivalent |
| Migration 004: user_settings | Merged into `users` (tier, notification prefs) | ✅ |
| Migration 005: user_onboarding | Referral fields on `users` | ✅ |

#### Auth + Security Tables ✅
| Their Table | Our Equivalent | Status |
|-------------|---------------|--------|
| Migration 006: auth_access_log | `auth_access_log` | ✅ |
| Migration 007: idempotency_keys | `idempotency_keys` | ✅ (key length 128, nullable user_id) |
| Migration 008: banned_users | Ban flags on `users` (is_hard_banned, is_shadow_banned) | ✅ |
| Migration 009: trust_scores | Trust fields on `users` (trust_score, trust_regen_streak, last_flag_at) | ✅ |
| Migration 010: fingerprints | `device_fingerprints` | ✅ |

#### Game Tables ✅
| Their Table | Our Equivalent | Status |
|-------------|---------------|--------|
| Migration 011: crimes | `crimes` table | ✅ (more fields: is_federal, outcome_weights, energy_cost, etc.) |
| Migration 012: crime_log | Crime logged via analytics, no separate table | ⚠️ We log via other mechanisms, verify adequacy |
| Migration 013: jail_log | Managed via `jail_until` timestamp on users | ✅ |
| Migration 014: hospital_log | Managed via `hospital_until` on users | ✅ |

#### Social Tables 🔲 Not yet built
| Their Table | Status |
|-------------|--------|
| Migration 015: factions | ❌ Phase 2 |
| Migration 016: faction_members | ❌ Phase 2 |
| Migration 017: messages | ❌ Phase 2 |
| Migration 018: forums | ❌ Phase 2 |
| Migration 019: forum_posts | ❌ Phase 2 |

#### Economy Tables ✅ (mostly)
| Their Table | Our Equivalent | Status |
|-------------|---------------|--------|
| Migration 020: items | Items exist, not user-inventoried yet | ⚠️ Verify item schema |
| Migration 021: user_inventory | `user_inventory` | ✅ |
| Migration 022: market_listings | `market_listings` | ✅ |
| Migration 023: bank_transactions | `bank_transactions` | ✅ |
| Migration 024: referrals | Referral fields on users | ✅ |
| Migration 025: payment_tiers | Tier fields on users (user_tier, tier_expires_at) | ✅ |

#### Admin Tables ✅
| Their Table | Our Equivalent | Status |
|-------------|---------------|--------|
| Migration 026: admin_audit_log | `admin_audit_log` | ✅ |
| Migration 027: game_config | Config managed via env vars + code | ⚠️ No DB-backed game_config table yet |
| Migration 028: announcements | No announcements table | ❌ Add in Phase 12 |

#### Tick + Queue Tables
| Their Table | Our Equivalent | Status |
|-------------|---------------|--------|
| Migration 029: game_tick_log | Tick log via logger | ⚠️ No dedicated DB table |
| Migration 030: scheduled_jobs | Managed via BullMQ in Redis | ⚠️ No DB table needed (Redis-backed) |

### Actual vs Spec: 23 of ~30 tables built
**7 tables missing:** social tables (factions, faction_members, messages, forums, forum_posts) + game_config + announcements
**Status:** These belong in Phases 2 and 12 — not blocking Phase 1.

### Seeds ✅
- [x] 25 crimes (5 tiers × 5) — seeded via `seedCrimes.ts`
- [x] Crime specials — seeded via `seedSpecials.ts`
- [x] Default config — managed in code + `.env`

### Gaps to Fill
- [ ] Add game_tick_log table (moved to Phase 14 monitoring)
- [ ] Add announcements table (Phase 12)
- [ ] Add game_config table (Phase 12)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 2 — Backend Core — Auth
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jun 22-28, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Register → login → protected route → logout.
All in Postman. All edge cases return correct error codes.
**AUDIT: verify our auth system against this spec.**

### Reference Files
- `backend/src/routes/authRoutes.ts` — Auth endpoints
- `backend/src/middleware/firebaseAuth.ts` — Firebase token verification
- `backend/src/middleware/requireAdmin.ts` — Admin role check
- `backend/src/services/emailService.ts` — Transactional emails
- `backend/src/config/firebase.ts` — Firebase Admin SDK init

### Audit Checklist

#### Firebase Setup ✅
- [x] Firebase project created
- [x] Email/password + Google SSO enabled
- [x] Service account JSON loaded (env var or file)
- [x] Firebase Admin SDK initialized

#### Auth Middleware ✅
- [x] `verifyFirebaseToken` — checks token signature, not revoked, email verified
- [x] `requireAdmin` — checks admin flag, logs all admin access
- [x] `checkBanStatus` — middleware between auth and routes

#### Auth Routes ✅
| Their Route | Our Status |
|-------------|-----------|
| POST /auth/register | ✅ via `/sync` (Firebase-first, creates user if new) |
| POST /auth/login | ✅ Firebase managed (frontend calls Firebase Auth, sends token to us) |
| POST /auth/logout | ✅ |
| POST /auth/refresh | ✅ Firebase handles token refresh |
| POST /auth/verify-email | ✅ Firebase handles |
| POST /auth/resend-verification | ✅ Firebase handles |
| POST /auth/forgot-password | ✅ Firebase handles |
| POST /auth/reset-password | ✅ Firebase handles |
| DELETE /auth/delete-account | ✅ GDPR delete |
| GET /auth/export-data | ✅ GDPR export |

#### Rate Limiting on Auth ✅
- [x] `/auth/register`: separate limiter (10 per 15 min per IP)
- [x] `/auth/login`: authSyncLimiter
- [x] `/auth/forgot-password`: covered by authSyncLimiter
- [x] `/auth/resend-verification`: covered by authSyncLimiter

#### Tests ✅
Our test suite covers all these scenarios across:
- `banCheck.test.ts` — 11 tests
- `requireAdmin.test.ts` — 14 tests
- `errorHandler.test.ts` — 9 tests
- `firebaseAuth.ts` — verified through route tests
- `schemas.test.ts` — 27 tests (all Zod schemas)

### Gaps to Fill
- [ ] Add explicit rate limiter tests for each auth endpoint
- [ ] Verify Google SSO auto-verify flow works end-to-end

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 3 — Backend Core — Game Engine
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jun 29 - Jul 12, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Full game loop works in Postman.
Register → commit crime → get jailed → serve time →
auto-release → regen stats. 700+ tests passing.
**AUDIT: verify our game engine against this spec.**

### Reference Files
- `backend/src/services/crimeService.ts` — Crime execution + pre-flight checks
- `backend/src/services/crimeEngine.ts` — Outcome resolution, XP calculations
- `backend/src/services/nerveService.ts` — Nerve regen (tier-aware)
- `backend/src/services/gameTick.ts` — 60s tick with 7 sub-tasks + circuit breaker
- `backend/src/routes/crimeRoutes.ts` — Crime endpoints
- `backend/src/controllers/crimeController.ts` — Crime request handler
- `backend/src/config/socket.ts` — WebSocket server + events
- `backend/src/queues/` — BullMQ workers + scheduler

### Audit Checklist

#### Week 1 — Crime + Jail + Hospital ✅

**Crime Service**
- [x] `getCrimes()` — list by tier/level (via `GET /crimes`)
- [x] `attemptCrime()` — full flow with pre-flight checks
- [x] Pre-flight: check not jailed, not hospitalized, check nerve, check level
- [x] Weighted outcome (crypto.randomInt, not Math.random)
- [x] Deduct nerve
- [x] Award XP
- [x] Idempotency check (SETNX distributed lock)
- [x] Crime history — paginated (via crime stats)
- [x] Crime stats — success rate, total earned

**Crime Engine**
- [x] Weighted outcome roller
- [x] Reward calculator per tier
- [x] Crit fail calculator (can go negative for tiers 3-5)
- [x] Sanity cap (max single crime reward)
- [x] Debt mechanic (negative cash allowed for high-tier crimes)

**Jail Service**
- [x] `assertCanAttempt` — check jail_until, federal_jail_until
- [x] JailError thrown with seconds remaining
- [x] Auto-release via game tick (checks state_until)

**Hospital Service**
- [x] `assertCanAttempt` — check hospital_until
- [x] HospitalError thrown with seconds remaining
- [x] Auto-release via game tick

#### Week 2 — Stats + Tick + Nerve ✅

**Stat Service** (merged into userModels + crimeService)
- [x] `getUserStats` — full stat block
- [x] `buildUpdatedStats` — atomic stat update after crime
- [x] Level-up — XP threshold check (via calcCrimeLevel)
- [ ] Stat point allocation (`allocateStatPoints`) — ❌ NOT BUILT

**Nerve Service**
- [x] `getNerveStatus()`
- [x] `deductNerve()`
- [x] `regenNerveByTier()` — tier-aware regen rates
- [x] Per-user timestamp tracking (`last_nerve_update`)

**Game Tick**
- [x] Runs every 60s (configurable via `GAME_TICK_MS`)
- [x] 7 parallel sub-tasks: energy regen, nerve regen, life regen, happiness decay, online count, tier expiry, market expiry
- [x] Circuit breaker: 3 failures → 5 min pause + alert
- [x] Partial failure tracking with alert at threshold
- [x] Slow tick alert: > 30s
- [x] Logs every tick via logger
- [x] Never runs in test mode
- [x] Dedicated tick pool (5 conns, separate from main pool)

**BullMQ Queues**
- [x] trust-recovery queue (daily)
- [x] database-backup queue (daily)
- [x] idempotency-cleanup queue (hourly)
- [x] email queue (transactional)
- [x] payment-webhook queue

**WebSocket Service**
- [x] Socket.io server initialized
- [x] Auth handshake (verify Firebase token on connect)
- [x] Rooms by user ID
- [x] Events: stats:update, notification, connected
- [x] Connection state recovery (30s)
- [x] Socket rate limiting (60 events/min per socket)
- [x] Heartbeat (ping/pong)
- [x] Online count broadcast (debounced)

### Gaps to Fill
- [ ] Build `allocateStatPoints()` — stat point allocation on level-up
- [ ] Add crime_log table for queryable history (currently logged via analytics)
- [ ] Verify bust-out-of-jail stub exists for post-launch
- [ ] Add XP formula documentation (currently in crimeEngine)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 4 — Backend Core — Economy
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jul 13-19, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Bank, market, inventory all work in Postman.
Money flows correctly. All transactions logged.
**AUDIT: verify our economy systems against this spec.**

### Reference Files
- `backend/src/services/bankService.ts` — Deposit, withdraw, transfer
- `backend/src/services/marketService.ts` — List, buy, cancel, expire
- `backend/src/services/inventoryService.ts` — Use, drop items
- `backend/src/services/referralService.ts` — Referral codes
- `backend/src/routes/bankRoutes.ts`
- `backend/src/routes/marketRoutes.ts`
- `backend/src/routes/inventoryRoutes.ts`
- `backend/src/routes/referralRoutes.ts`

### Audit Checklist

#### Bank Service ✅
- [x] `deposit()` — atomic, logs to bank_transactions
- [x] `withdraw()` — atomic, checks balance
- [x] `transfer()` — both sides logged, tax applied (5% default), cannot transfer while jailed
- [x] `getBalance()` — returns cash + bank
- [x] `getTransactionHistory()` — paginated

**Bank Routes**
- [x] POST /bank/deposit — validated, rate-limited, idempotent
- [x] POST /bank/withdraw — validated, rate-limited, idempotent
- [x] POST /bank/transfer — validated, rate-limited, idempotent
- [x] GET /bank/balance
- [x] GET /bank/history — paginated

#### Market Service ✅
- [x] `listItem()` — takes from inventory, creates listing
- [x] `buyItem()` — atomic: transfer cash + item, tax applied
- [x] `cancelListing()` — returns item to inventory
- [x] `getListings()` — searchable, filterable
- [x] `expireListings()` — runs on game tick (7 day default)
- [x] `getMyListings()` — seller view

**Market Routes**
- [x] POST /market/list — validated, idempotent
- [x] POST /market/buy/:listingId — validated, idempotent
- [x] DELETE /market/listing/:listingId — validated
- [x] GET /market/listings — public, rate-limited
- [x] GET /market/my-listings

#### Inventory Service ✅
- [x] `getInventory()` — paginated
- [x] `useItem()` — consume item, apply effects
- [x] `dropItem()` — remove from inventory

#### Referral Service ✅
- [x] `generateReferralCode()` — unique per user
- [x] `applyReferralCode()` — links users, awards bonus, one use, no self-refer
- [x] `getReferralStats()` — count, reward tracking

### Gaps to Fill
- [ ] Add frontend pages for all economy features (Phase 9-10)
- [ ] Verify manual market expiry listing cleanup (currently on game tick)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 5 — Backend Hardening
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jul 20-26, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
All anti-cheat systems active. Security middleware on every route.
0 ESLint warnings. TypeScript strict: clean.
**AUDIT: verify our 14 middleware files against this spec.**

### Reference Files
- `backend/src/middleware/` — All 14 files
- `backend/src/services/trustEngine.ts` — Trust scoring
- `backend/src/services/behaviorEngine.ts` — Behavior analysis
- `backend/src/services/fingerprintEngine.ts` — Device fingerprinting
- `backend/src/services/vpnDetection.ts` — VPN/proxy detection
- `backend/src/services/shadowPunish.ts` — Shadow ban tiers
- `backend/src/middleware/banCheck.ts` — Ban system
- `backend/src/middleware/rateLimiter.ts` — Rate limiting
- `backend/src/middleware/idempotency.ts` — Idempotency
- `backend/src/middleware/securityMiddleware.ts` — CSP, headers
- `backend/src/utils/errors.ts` — Error classes
- `backend/src/middleware/errorHandler.ts` — Global error handler
- `backend/src/utils/gracefulShutdown.ts` — Graceful shutdown

### Audit Checklist

#### Security Middleware ✅
- [x] Rate limiting (Redis-backed, memory fallback):
  - Global: 100 req/min per IP (configurable)
  - Auth routes: 10 per 15 min per IP
  - Game routes: 30 req/min per user (varies by route)
  - Crime endpoint: 30 req/min per user
  - Memory fallback with alert when Redis down
- [x] Helmet.js — security headers
- [x] CSP hardened (via securityMiddleware)
- [x] CORS — frontend domain only
- [x] Request size limiting (100kb on JSON body)
- [x] IP allowlist (admin routes via requireAdmin + IP check)
- [x] Honeypot routes — any hit flagged and logged

#### Anti-Cheat Systems ✅
- [x] Trust engine: score per user, dedup cooldown, factors (timing, success rate, earnings velocity)
- [x] Behavior analysis: flag suspicious timing, unusual earnings, 24/7 activity, abnormal success rates
- [x] Browser fingerprinting: SHA256 dual-hash, link to accounts, multi-account detection
- [x] VPN detection: IP reputation, fail-open, 6h Redis cache
- [x] Shadow ban (4 tiers): delay, reduced rewards, pure failures, account frozen
- [x] Hard/soft ban: Firebase revoke + DB flag
- [x] Idempotency: SETNX distributed lock, 30s TTL, applied to all mutating endpoints, nullable user_id

#### Error Handling ✅
- [x] Global error handler — PG error mapping, Zod formatting, Sentry capture, no stack leaks
- [x] Consistent error shape: `{ error, code, details?, requestId? }`
- [x] Custom error classes for every scenario

#### Graceful Shutdown ✅
- [x] SIGTERM handler: drain requests (30s), close DB pool, close Redis, stop workers, exit 0

#### Nginx Config ✅
- [x] Rate limit zones in http{}
- [x] proxy_pass to backend
- [x] Bot blocking (scanner user-agents)
- [x] Request buffering
- [x] Gzip compression
- [x] Security headers

### Gaps to Fill
- [ ] None — Phase 5 is our most complete phase. All systems built and tested.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 6 — Backend Testing + Lock
## Codebase Status: ✅ AUDIT PASSED
## Original Target: Jul 27 - Aug 2, 2026
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
786+ tests passing. 0 TypeScript errors. 0 ESLint warnings.
All backend files locked. CI/CD green on every push.
**AUDIT: verify our test coverage and lock status against this spec.**

### Reference Files
- `backend/src/__tests__/*` — 41 test files
- `backend/docs/COMPLETED.md` — Phase 0-1 locked entries

### Audit Checklist

#### Audit ✅
- [x] Every route has input validation (Zod) — verified in Phase 1
- [x] Every route has auth middleware — verified
- [x] Every route has rate limiting — verified
- [x] Every service has error handling — verified
- [x] Every DB operation is atomic where needed — transactions used
- [x] Every money operation logs to bank_transactions — verified
- [x] Every admin action logs to admin_audit_log — verified
- [x] No console.log in production code — ESLint catches
- [x] No TODO comments left — ESLint catches
- [x] All env variables validated on startup — envValidator.ts
- [x] All external calls have timeout + fallback — verified

#### Test Coverage ✅ (EXCEEDS TARGET)
- [x] Auth: covered across middleware tests
- [x] Crime engine: crimeEngine.test.ts (26 tests) + crimeService.test.ts (11 tests) + crimeModels.test.ts (28 tests)
- [x] Jail/Hospital: tested through crimeService pre-flight checks
- [x] Bank: bankService.test.ts (27 tests)
- [x] Market: marketService.test.ts (27 tests)
- [x] Trust engine: trustEngine.test.ts (21 tests)
- [x] Shadow ban: shadowPunish.test.ts (15 tests)
- [x] Game tick: gameTick.test.ts (8 tests)
- [x] Rate limiting: rateLimiter.test.ts (8 tests)
- [x] Overall: 786 tests across 41 files (target was 600, exceeded by 31%)

#### Lock Procedure ✅
- [x] Backend files locked per COMPLETED.md convention
- [x] Rule: New features = new files. Never reopen locked files unless critical security vulnerability.

### Gaps to Fill
- [ ] Add explicit test for `allocateStatPoints()` when built (Phase 3 gap)
- [ ] Add game_tick_log table + query (Phase 14)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 7 — Frontend Foundation
## Status: ✅ AUDIT PASSED (already built)
## Target: Aug 3-9, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
App loads in browser. Routes work. Design system built.
Firebase connected. AuthContext exists. Dark theme applied.
**AUDIT: verify existing frontend against this spec.**

### Reference Files
- `frontend/src/App.tsx` — All routes, lazy loading, error boundary
- `frontend/src/components/Shell.tsx` — Main layout (381 lines, sidebar nav + bottom mobile nav)
- `frontend/src/components/Header.tsx` — Top bar
- `frontend/src/components/Footer.tsx` — Footer
- `frontend/src/components/ProtectedRoute.tsx` — Auth gate
- `frontend/src/components/AdminRoute.tsx` — Admin gate
- `frontend/src/components/ErrorBoundary.tsx` — Error boundary
- `frontend/src/components/ui/` — Button, Modal, Toast, Skeleton, PageTransition, Icon, ConfirmModal, EmptyState
- `frontend/src/components/CookieBanner.tsx` — GDPR cookie consent
- `frontend/src/components/AgeGate.tsx` — Age verification
- `frontend/src/components/Countdown.tsx` — Countdown timer component
- `frontend/src/components/SkipNav.tsx` — Accessibility skip nav
- `frontend/src/context/AuthContext.tsx` — Auth state provider
- `frontend/src/context/ThemeContext.tsx` — Theme provider
- `frontend/src/services/api.ts` — Axios instance with token refresh
- `frontend/src/hooks/useAuth.ts` — Auth hook
- `frontend/src/hooks/useSocket.ts` — WebSocket hook (with notifications, stats updates)
- `frontend/src/hooks/useGameQueries.ts` — React Query hooks
- `frontend/src/hooks/useTheme.ts` — Theme hook
- `frontend/src/hooks/useCountUp.ts` — Animated counter
- `frontend/src/hooks/useFocusTrap.ts` — Accessibility focus trap

### Audit Checklist

#### Design System ✅
- [x] Dark theme (crime aesthetic)
- [x] UI component library: Button, Modal, Toast, Skeleton, PageTransition, Icon, ConfirmModal, EmptyState
- [x] StatCard component
- [x] Countdown timer component
- [x] OdometerNumber (animated counter)

#### Routing ✅
- [x] React Router v7 (installed and configured)
- [x] All 30+ routes defined with lazy loading
- [x] ProtectedRoute + AdminRoute components
- [x] 404 NotFound page

#### API Client ✅
- [x] Axios instance (`api.ts`) with base URL, token interceptor
- [x] Typed service modules: admin.ts, crimes.ts, stats.ts, news.ts
- [x] Timeout configured

#### Auth Context ✅
- [x] AuthContext + AuthProvider wrapping entire app
- [x] useAuth() hook with currentUser, loading, login/logout/register
- [x] Firebase Auth integration

#### WebSocket ✅
- [x] Socket.io client (`socket.ts`)
- [x] useSocket() hook with auto-reconnect
- [x] useNotifications() — real-time crime results, alerts
- [x] useStatsUpdate() — real-time stat bar updates
- [x] `notification:new` handled in Shell.tsx

#### Layout ✅
- [x] Shell.tsx: sidebar (desktop) + bottom nav (mobile)
- [x] Sections: MAIN, ECONOMY, CONTRACTS, SOCIAL, INFO
- [x] Top bar with cash balance, nerve bar
- [x] AuthLayout for login/register pages
- [x] ErrorBoundary wrapping entire app

### Gaps to Fill
- [ ] None — Phase 7 is complete and exceeds spec

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 8 — Frontend — Auth Flow
## Status: ✅ AUDIT PASSED (already built)
## Target: Aug 10-16, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
New player can register → verify email → complete onboarding → reach dashboard.
All in browser. Mobile works. No errors.
**AUDIT: verify existing auth pages against this spec.**

### Reference Files
- `frontend/src/pages/Landing.tsx` — 214 lines (hero, features, CTA, stats section)
- `frontend/src/pages/Login.tsx` — 392 lines (email/password, Google SSO, forgot password link)
- `frontend/src/pages/Register.tsx` — 656 lines (username, email, password, terms, age gate)
- `frontend/src/pages/Onboarding.tsx` — 197 lines (5-step flow)
- `frontend/src/components/Hero.tsx` — Landing hero section
- `frontend/src/components/FeaturesSection.tsx` — Feature highlights
- `frontend/src/components/StatsSection.tsx` — Stats counter section
- `frontend/src/components/AboutGamesSection.tsx` — About section
- `frontend/src/components/FeatureTile.tsx` — Individual feature card
- `frontend/src/components/AgeGate.tsx` — Age verification modal
- `frontend/src/components/CookieBanner.tsx` — Cookie consent
- `frontend/src/services/api.ts` — Auth API calls

### Audit Checklist

#### Landing Page ✅
- [x] Hero section ("Build your empire" — or similar)
- [x] Feature highlights (FeaturesSection + FeatureTile)
- [x] Crime tier preview
- [x] CTA: Play Free
- [x] Stats section (counters)
- [x] Dark, gritty aesthetic
- [x] Mobile responsive (via Shell layout)

#### Register Page ✅
- [x] Username input with validation
- [x] Email input
- [x] Password input (min 8 chars)
- [x] Confirm password
- [x] Terms checkbox
- [x] Age gate (AgeGate component)
- [x] Google Sign-In button
- [x] Error states
- [x] Loading state
- [x] 656 lines — comprehensive

#### Login Page ✅
- [x] Email + password
- [x] Google Sign-In button
- [x] Forgot password link
- [x] Error states
- [x] Loading state
- [x] 392 lines — comprehensive

#### Onboarding Flow ✅
- [x] Step 1: Welcome (introduction)
- [x] Step 2: Rules (no cheating, no multi-accounting)
- [x] Step 3: Privacy + Terms (with links to full docs)
- [x] Step 4: First crime preview (tutorial concept)
- [x] Step 5: Referral code (optional)
- [x] Progress bar across steps
- [x] 197 lines

#### Additional ✅
- [x] Cookie consent banner (CookieBanner.tsx)
- [x] Legal page (318 lines covering TOS, Privacy, Cookies, Refund, Rules)

### Gaps to Fill
- [ ] None — Phase 8 is complete

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 9 — Frontend — Core Game UI
## Status: ⚠️ AUDIT + FILL (60% built, stubs remain)
## Target: Aug 17-30, 2026 (2 weeks)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Core game loop works entirely in browser.
Crimes → jail → hospital → regen → repeat.
All real-time. Mobile responsive.

### Reference Files (Real Pages)
- `frontend/src/pages/Home.tsx` — 188 lines (dashboard with stat bars, quick stats, activity)
- `frontend/src/pages/Crimes.tsx` — 462 lines (tier grouping, crime cards, attempt + result modal)
- `frontend/src/pages/Jail.tsx` — 161 lines (countdown timer, crime info, auto-redirect)
- `frontend/src/pages/Hospital.tsx` — 161 lines (countdown timer, reason, auto-redirect)
- `frontend/src/pages/Settings.tsx` — 237 lines (account, notifications, privacy, danger zone)
- `frontend/src/pages/NotFound.tsx` — 54 lines (friendly 404)
- `frontend/src/components/StatCard.tsx` — Stat display component
- `frontend/src/components/Countdown.tsx` — Timer component
- `frontend/src/services/crimes.ts` — Crime API service
- `frontend/src/services/stats.ts` — Stats API service
- `frontend/src/hooks/useSocket.ts` — Real-time stat updates via WebSocket

### Audit Checklist

#### Dashboard ✅ (Home.tsx)
- [x] Stat bars (nerve, energy, life, happiness) — real-time via WebSocket
- [x] Quick stats (level, XP, cash, bank)
- [x] Current status (active / jailed / hospitalized)
- [x] Recent activity feed
- [x] Quick crime button
- [x] Announcement banner

#### Crimes Page ✅ (Crimes.tsx — 462 lines)
- [x] Crime list grouped by tier
- [x] Crime cards: name, description, nerve cost, reward range, success rate
- [x] Tier tabs
- [x] Locked tiers grayed out
- [x] Attempt button → loading → result modal
- [x] Result modal: success animation, failure message, crit fail with jail redirect
- [x] Nerve bar updates in real-time
- [x] Insufficient nerve = button disabled

#### Jail Page ✅ (Jail.tsx — 161 lines)
- [x] "You are in jail" state
- [x] Crime committed shown
- [x] Countdown timer (real-time via WebSocket)
- [x] Auto-redirect on release
- [x] All actions disabled

#### Hospital Page ✅ (Hospital.tsx — 161 lines)
- [x] "You are in the hospital" state
- [x] Reason shown
- [x] Countdown timer
- [x] Auto-redirect on release

#### Profile Page ❌ Not built
- [ ] No Profile page exists
- [ ] Needs to be built

#### Settings Page ✅ (Settings.tsx — 237 lines)
- [x] Account section
- [x] Notifications section
- [x] Privacy section
- [x] Danger zone (export data, delete account)
- [x] Confirm dialog for delete

### Stub Pages to Fill
These are 5-line placeholders that need real implementations when their backend exists:

| Page | Lines | Priority | Backend Ready? |
|------|-------|----------|---------------|
| Gym.tsx | 5 | ⚠️ Fill | Needs backend |
| Job.tsx | 5 | ⚠️ Fill | Needs backend |
| City.tsx | 5 | Low | Needs backend |

### Gaps to Fill
- [ ] Build Profile page (`/profile/:username`)
- [ ] Fill Gym.tsx stub (when backend ready — Phase 3 gap)
- [ ] Fill Job.tsx stub (when backend ready — Phase 3 gap)
- [ ] Fill City.tsx stub (when backend ready — post-launch)
- [ ] Add crime result animations (success/failure/crit fail visual feedback)
- [ ] Add debt state UI warning banner

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 10 — Frontend — Advanced UI
## Status: ⚠️ AUDIT + FILL (stubs only, backends partially exist)
## Target: Aug 31 - Sep 13, 2026 (2 weeks)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Economy pages load real data. Social pages functional.
Leaderboards load fast. Pagination, search, sort all working.
**AUDIT: 14 stub pages at 5 lines each need to be built.**

### Reference Files (All Stubs — 5 Lines Each)
- `frontend/src/pages/BlackMarket.tsx` — 5 line placeholder
- `frontend/src/pages/Properties.tsx` — 5 line placeholder
- `frontend/src/pages/Travel.tsx` — 5 line placeholder
- `frontend/src/pages/Calendar.tsx` — 5 line placeholder
- `frontend/src/pages/Casino.tsx` — 5 line placeholder
- `frontend/src/pages/Company.tsx` — 5 line placeholder
- `frontend/src/pages/Missions.tsx` — 5 line placeholder
- `frontend/src/pages/Events.tsx` — 5 line placeholder
- `frontend/src/pages/Gang.tsx` — 5 line placeholder
- `frontend/src/pages/GangWars.tsx` — 5 line placeholder
- `frontend/src/pages/LinkedGangs.tsx` — 5 line placeholder
- `frontend/src/pages/Forum.tsx` — 5 line placeholder
- `frontend/src/pages/Newspaper.tsx` — 5 line placeholder
- `frontend/src/pages/Inventory.tsx` — 5 line placeholder

### Routes in Shell.tsx pointing to these stubs
`/black-market` → BlackMarket.tsx stub
`/properties` → Properties.tsx stub
`/travel` → Travel.tsx stub
`/inventory` → Inventory.tsx stub
`/company` → Company.tsx stub
`/missions` → Missions.tsx stub
`/events` → Events.tsx stub
`/casino` → Casino.tsx stub
`/calendar` → Calendar.tsx stub
`/gang` → Gang.tsx stub
`/gang-wars` → GangWars.tsx stub
`/linked-gangs` → LinkedGangs.tsx stub
`/forum` → Forum.tsx stub
`/newspaper` → Newspaper.tsx stub

**Not even a stub page:** Bank, Leaderboards, Messages/Inbox

### Audit Checklist

#### Economy Pages ❌ (all stubs)
- [ ] Bank — No stub, not wired in Shell
- [ ] Black Market — Stub only
- [ ] Properties — Stub only
- [ ] Travel — Stub only
- [ ] Company — Stub only
- [ ] Inventory — Stub only

#### Social + Competitive ❌ (all stubs)
- [ ] Leaderboards — No stub
- [ ] Newspaper — Stub only
- [ ] Calendar — Stub only
- [ ] Casino — Stub only
- [ ] Forum — Stub only
- [ ] Gang — Stub only
- [ ] Gang Wars — Stub only
- [ ] Linked Gangs — Stub only
- [ ] Missions — Stub only
- [ ] Events — Stub only

### Backend Dependency Map
| Page | Backend Exists? | Backend References |
|------|----------------|--------------------|
| Black Market | ✅ Phase 4 | `routes/economy.ts`, `controllers/economy.ts` |
| Properties | ✅ Phase 4 | `routes/economy.ts` |
| Travel | ❌ Not built | — |
| Inventory | ❌ Not built | — |
| Company | ❌ Not built | — |
| Missions | ❌ Not built | — |
| Events | ❌ Not built | — |
| Casino | ⚠️ Partial | `routes/casino.ts` exists |
| Gang | ❌ Not built | — |
| Forum | ❌ Not built | — |
| Newspaper | ❌ Not built | — |
| Leaderboards | ✅ Phase 3 | `routes/leaderboard.ts` |
| Bank | ⚠️ Partial | `routes/payment.ts` (Phase 11) |

### Action Plan (Priority Order)
1. **Leaderboards** — backend exists, quick win
2. **Black Market** — backend exists (economy routes), medium effort
3. **Properties** — backend exists, medium effort
4. **Casino** — backend exists (partial), medium effort
5. **Bank page** — build when payments phase is ready
6. **Fill remaining stubs** — depends on building their backends first

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 11 — Payments + Legal
## Status: ⚠️ PARTIAL (Legal done, payments in skeleton)
## Target: Sep 14-20, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Can take real money safely. All legal pages live. GDPR implemented.

### Reference Files
- `backend/src/workers.ts` — `paymentWebhookWorker` skeleton
- `backend/src/routes/paymentRoutes.ts` — Payment routes
- `backend/src/services/paymentService.ts` — Payment service
- `backend/src/config/tiers.ts` — Tier config (player, citizen, contributor)
- `backend/src/utils/gameTick.ts` — `checkTierExpiry()`
- `frontend/src/pages/Legal.tsx` — 318 line legal page (TOS, Privacy, Cookies, Refund, Rules)
- `frontend/src/components/CookieBanner.tsx` — GDPR cookie consent
- `frontend/src/components/AgeGate.tsx` — Age verification modal
- `frontend/src/services/api.ts` — Has payment service integration

### Audit Checklist

#### Already Built ✅
- [x] Lemon Squeezy webhook skeleton (`paymentWebhookWorker`)
- [x] Payment routes (`paymentRoutes.ts`)
- [x] Payment service (`paymentService.ts`)
- [x] Payment logs table (`payment_logs`)
- [x] Payment tiers on `users` table
- [x] Tier config (`tiers.ts` — player, citizen, contributor)
- [x] Tier expiry via game tick (`checkTierExpiry()`)
- [x] GDPR export + delete endpoints (backend routes)
- [x] Cookie consent banner (CookieBanner.tsx)
- [x] Age gate (AgeGate.tsx)
- [x] **Legal page** (Legal.tsx — 318 lines, covers TOS, Privacy, Cookies, Refund, Rules, Accessibility)
- [x] Compliance roadmap (`backend/docs/compliance-roadmap.md`)

### Still to Build
- [ ] Lemon Squeezy products created in dashboard (Contributor $7.99/mo, Black Card $4.99)
- [ ] Checkout links wired to frontend
- [ ] Webhook fully implemented: handle subscription_created, _renewed, _cancelled, order_created
- [ ] Upgrade page (`/upgrade`) with tier comparison table, live in Shell nav
- [ ] Bank page (withdraw/deposit functionality) — this is the player-facing bank UI
- [ ] Test payment flow end-to-end (sandbox → production)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 12 — Admin Panel
## Status: ⚠️ PARTIAL (frontend page exists, route gaps remain)
## Target: Sep 21-27, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Admin can search any user, view full state, ban/unban, manage crimes, view logs.
All admin actions logged.
**AUDIT: Admin.tsx is 549 lines — comprehensive, but needs backend route parity.**

### Reference Files
- `backend/src/routes/admin.ts` — Admin backend routes
- `backend/src/middleware/requireAdmin.ts` — Admin auth middleware
- `backend/src/services/shadowPunish.ts` — Shadow ban tiers
- `frontend/src/pages/Admin.tsx` — 549 line admin dashboard
- `frontend/src/services/admin.ts` — Admin API service
- `frontend/src/components/AdminRoute.tsx` — Admin route guard

### Audit Checklist

#### Backend Routes ✅
- [x] `POST /admin/cheaters` — auto-detect cheating patterns
- [x] `POST /admin/hard-ban` — permanent ban
- [x] `POST /admin/shadow-ban` — stealth punishment
- [x] `POST /admin/unban` — lift ban
- [x] `POST /admin/ip-blacklist` — block IP
- [x] `POST /admin/trust-recovery/run` — recalculate trust
- [x] `GET /admin/db-health` — database health check
- [x] `requireAdmin` middleware on all routes
- [x] Admin audit log table
- [x] Rate-limited admin routes

#### Frontend Page ⚠️ (Admin.tsx — 549 lines, assessed as partial)
- [x] Admin dashboard layout exists
- [x] Admin API service exists
- [ ] May not cover all backend routes (needs verification)
- [ ] Missing: game config editor (no `game_config` table yet)
- [ ] Missing: announcements UI (no `announcements` table yet)
- [ ] Missing: monitoring views (tick log, error log, auth log, queue status)

### Gaps to Fill
- [ ] Audit Admin.tsx against all admin backend routes for parity
- [ ] Build game config editor (requires `game_config` table — post-launch)
- [ ] Build announcements UI (requires `announcements` table — post-launch)
- [ ] Add monitoring views (tick log, error log, queue status)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 13 — Harden + Anti-Cheat Verify
## Status: ⚠️ RE-VERIFY (backend done, frontend partially hard)
## Target: Sep 28 - Oct 4, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Game survives an angry player trying to break it.
All abuse scenarios tested manually. Lighthouse > 80 on core pages.

### Reference Files
- `backend/src/middleware/` — All 14 middleware files (anti-cheat, security, rate limiting)
- `backend/src/services/trustEngine.ts` — Trust scoring engine
- `backend/src/services/behaviorEngine.ts` — Behavior flagging
- `backend/src/services/fingerprintEngine.ts` — Multi-account detection
- `backend/src/services/vpnDetection.ts` — VPN/proxy detection
- `backend/src/services/shadowPunish.ts` — Shadow ban tiers (tested, 15 tests)
- `backend/src/middleware/idempotency.ts` — distributed lock 30s TTL
- `backend/src/middleware/securityMiddleware.ts` — CSP, headers
- `backend/src/middleware/errorHandler.ts` — Global error handler
- `frontend/src/components/ErrorBoundary.tsx` — Per-page error boundaries
- `frontend/src/components/ProtectedRoute.tsx` — Route guard
- `frontend/src/services/api.ts` — 10s timeout, error interceptors
- `frontend/src/utils/toast.ts` — Toast notifications
- `frontend/src/hooks/useSocket.ts` — WebSocket reconnect logic

### Audit Checklist

#### Anti-Cheat Backend ✅ (Already verified in Phase 5)
- [x] Trust engine: scored per user, dedup cooldown, factors (timing, success rate, earnings velocity)
- [x] Behavior analysis: suspicious timing, unusual earnings, 24/7 activity, abnormal success rates
- [x] Browser fingerprinting: SHA256 dual-hash, multi-account linking
- [x] VPN detection: IP reputation DB, fail-open, 6h Redis cache
- [x] Shadow ban (4 tiers): delay, reduced rewards, pure failures, frozen account
- [x] Hard/soft ban: Firebase revoke + DB flag
- [x] Idempotency: SETNX distributed lock, 30s TTL, applied to all mutating endpoints
- [x] Rate limiting: global 100/min, auth 10/15min, game 30/min, memory fallback with alert
- [x] Error handling: PG error mapping, Zod formatting, Sentry capture, no stack leaks

#### Frontend Hardening ⚠️
- [x] Error boundaries on every page (ErrorBoundary.tsx)
- [x] Loading states (Skeleton.tsx, Spinner)
- [x] Form validation in auth pages (Login, Register)
- [ ] Debt state UI warning banner (not built)
- [ ] "Coming Soon" placeholders on stub pages (currently just "not found" behavior)
- [ ] Optimization: code-splitting via lazy loading ✅ (App.tsx uses lazy)
- [ ] Optimization: image optimization (need audit)
- [ ] Optimization: bundle size monitoring (need baseline)

### Still to Do (Phase 13 Work)
- [ ] Manual abuse testing (13 scenarios):
  - [ ] Rapid-fire crime requests (rate limit test)
  - [ ] Negative/zero values in transactions
  - [ ] IDOR: change user_id in requests
  - [ ] Parallel crime attempts (race condition)
  - [ ] SQL injection in search/inputs
  - [ ] XSS in profile fields
  - [ ] Header manipulation
  - [ ] VPN/proxy while playing
  - [ ] Multi-account from same browser
  - [ ] Tamper with WebSocket messages
  - [ ] Pray at perfect timing
  - [ ] Unusual earnings velocity
  - [ ] 24/7 uptime bot detection
- [ ] Add debt state UI warning banner
- [ ] Add "Coming Soon" placeholder component for stub pages
- [ ] Lighthouse audit on core pages: Landing, Register, Login, Home, Crimes, Jail, Hospital
- [ ] Mobile responsive audit at 375px, 390px, 768px on all real pages
- [ ] Verify sentry.io is capturing errors correctly

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 14 — Load Testing
## Status: 📋 BUILD
## Target: Oct 5-11, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Server handles simulated day-1 traffic. No crashes. DB pool never exhausts.

### Tasks
- [ ] Install k6 + Artillery + clinic.js
- [ ] Run ramp-up test (0→500 users)
- [ ] Run crime spike test (100 concurrent /attempt)
- [ ] Run WebSocket load test (500 concurrent connections)
- [ ] Run 24h soak test (memory leak check)
- [ ] Fix bottlenecks → re-test loop
- [ ] Document every change

### Pass Criteria
- p95 < 500ms under 500 users
- Error rate < 0.1%
- DB pool never exhausts
- Game tick runs clean
- No memory leak < 10mb drift

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 15 — Security Audit
## Status: 📋 BUILD
## Target: Oct 12-18, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
OWASP ZAP clean. All critical + high findings fixed.

### Tasks
- [ ] OWASP ZAP full active scan on all routes
- [ ] Fix all Critical + High findings
- [ ] npm audit — fix all critical/high CVEs
- [ ] Manual security tests: auth bypass, SQLi, XSS, IDOR, rate limit bypass, business logic
- [ ] Dependency audit: review all dependencies > 1 year old, remove unused

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 16 — VPS + Deployment
## Status: 📋 BUILD (BLOCKED: need credit card)
## Target: Oct 19-25, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
undercity.online is live on Hetzner VPS. HTTPS working.
CI/CD auto-deploys. Rollback tested.

### Tasks
- [ ] Get credit card (blocker for this phase)
- [ ] Buy Hetzner CX22 (€5/mo)
- [ ] Server hardening: non-root user, UFW, fail2ban, unattended upgrades, Docker
- [ ] Production Docker stack: backend, PostgreSQL, Redis, Nginx
- [ ] Nginx prod config: SSL (Let's Encrypt), proxy, WebSocket, rate zones, bot blocking
- [ ] DNS: Cloudflare → Hetzner, proxy enabled
- [ ] Frontend: Cloudflare Pages connected to GitHub
- [ ] CI/CD: deploy.yml workflow (git pull → build → up -d → migrate → health check → rollback on fail)
- [ ] Backups: Hetzner snapshots + daily pg_dump, 7-day retention
- [ ] Monitoring: UptimeRobot, Sentry, PostHog production tokens set

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 17 — Staging + Internal QA
## Status: 📋 BUILD
## Target: Oct 26 - Nov 1, 2026 (1 week)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
You personally complete the full game loop on live VPS.
Every page loads. Every action works. No P0/P1 bugs.

### QA Checklist
- [ ] Full auth flow: register, verify, login, logout, Google SSO, forgot password
- [ ] Core game loop: view crimes, commit (success/failure/crit fail), get jailed, serve time, regen
- [ ] Economy: deposit, withdraw, transfer, list on market, buy, cancel, verify transaction history
- [ ] Social: send message, create faction, forum thread, leaderboard
- [ ] Admin: search user, soft/hard ban, edit config, create announcement
- [ ] Mobile: all above at 375px, navigation, forms usable

### Bug Triage
- P0: fix before beta opens
- P1: fix in first week of beta
- P2/P3: log, fix after launch

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 18 — Beta
## Status: 📋 BUILD
## Target: Nov 2-30, 2026 (4 weeks)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
100+ players complete full game loop. 0 P0 bugs after day 3.
< 5 P1 bugs by end of week 2. Retention > 40% day 1→2.

### Schedule
| Week | Dates | Players | Focus |
|------|-------|---------|-------|
| 1 | Nov 2-8 | 50 | Monitor + fix P0 in < 2h |
| 2 | Nov 9-15 | 200 | Upgrade VPS to CX32, daily bug fixes |
| 3 | Nov 16-22 | 500 | Economy balance pass |
| 4 | Nov 23-30 | Close | Fix remaining P1s, final backup, prep launch content |

### Success Metrics
| Metric | Target |
|--------|--------|
| Onboarding completion | > 80% |
| First crime | > 70% |
| Day 2 retention | > 40% |
| Day 7 retention | > 20% |
| P0 bugs after day 3 | 0 |
| P1 bugs end of beta | < 5 open |

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 19 — Pre-Launch Polish
## Status: 📋 BUILD
## Target: Dec 1-14, 2026 (2 weeks)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
Everything is green. Dry run passes. Ready to press the button.

### Week 1 (Dec 1-7): Bug Fixes + Polish
- [ ] Fix all remaining P1 bugs from beta
- [ ] Final Lighthouse audit (all pages > 80)
- [ ] Final mobile audit (375px)
- [ ] Final security check: npm audit, env vars, secrets rotated
- [ ] Landing page final polish
- [ ] Legal pages proofread
- [ ] Email templates tested
- [ ] Maintenance page designed
- [ ] Final backup tested

### Week 2 (Dec 8-14): Soft Launch + Final Checks
- [ ] Dec 8-10: Discord soft launch
- [ ] Dec 11: All systems check (VPS, Redis, PG, queues, tick, CI/CD, backups, UptimeRobot, Sentry, PostHog)
- [ ] Dec 12-13: Prepare launch content (Reddit posts, Twitter thread, email blast, ProductHunt blurb)
- [ ] Dec 14: Final dry run — register fresh account, complete every action

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 20 — PUBLIC LAUNCH 🚀
## Status: 📋 BUILD
## Target: December 15, 2026 00:00 UTC
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DONE SIGNAL:**
5,000 registered players by end of day.

### Launch Sequence
- [ ] 00:00 — Remove beta restrictions
- [ ] 00:01 — ProductHunt goes live
- [ ] 00:05 — Twitter launch thread
- [ ] 00:10 — Email blast to waitlist
- [ ] 00:15 — Reddit posts on 6 subreddits
- [ ] 00:20 — Discord announcement
- [ ] 00:30 — Discord watch party starts

### Day 1 Priorities
- Monitor Sentry + VPS every 30 min
- Fix P0 bugs immediately (no features)
- Post milestone updates (500, 1k, 2k players)

### Day 1 Targets
| Metric | Target |
|--------|--------|
| Registered | 5,000 |
| ProductHunt ranking | Top 5 |
| Uptime | > 99% |
| P0 bugs | 0 |

---

## GAME ECONOMY — LOCKED

### Crime Reward Ladder
| Tier | Name | Crimes | Nerve | Reward Range | Crit Fail |
|------|------|--------|-------|-------------|-----------|
| 1 | Street | 5 | 2-6 | $0 → $5k | 5-25% cash, cap $2k |
| 2 | Hustle | 5 | 7-11 | $5k → $50k | 10-35% cash, cap $30k |
| 3 | Organized | 5 | 12-16 | $50k → $500k | CAN go negative |
| 4 | Serious | 5 | 17-21 | $500k → $2.5M | CAN go negative |
| 5 | Elite | 5 | 22-26 | $2.5M → $10M | CAN go negative |

### Tier Unlocks
| Tier | Unlock Level |
|------|-------------|
| 1 | Level 1 |
| 2 | Level 5 |
| 3 | Level 10 |
| 4 | Level 15 |
| 5 | Level 20 |

### Payment Tier Perks
| Tier | Price | Nerve Regen | Badge |
|------|-------|-------------|-------|
| Free | $0 | 1.0x | None |
| Contributor | $7.99/mo | 1.25x | ✓ |
| Black Card | $4.99 once | 1.5x | ✓ |

---

## POST-LAUNCH BACKLOG

### Near-term (Jan-Mar 2027)
- Player reporting system
- Action timing analysis
- Crime specials / subdivided outcomes
- Bust out of jail mechanic
- Attack other players (PvP)
- Hospital from PvP attacks

### Mid-term (Apr-Jun 2027)
- Gang Wars (faction vs faction)
- Properties (passive income)
- Travel system (cities)
- Back Alley (underground market)

### Long-term (Jul 2027+)
- Casino
- Company system
- Newspaper (player-run)
- Gangster Shop
- Black Market

---

## CURRENT SNAPSHOT (June 2026)

### Test Suite
| Layer | Test Files | Tests | Status |
|-------|-----------|-------|--------|
| Backend (Vitest) | 41 | 786 | ✅ All passing |
| Frontend (Vitest) | 13 | 147 | ✅ All passing |
| **Total** | **54** | **933** | **All green** |

### Frontend Build
`npm run build` → 1.2s. Zero TypeScript errors, zero ESLint warnings.

### What's Real vs What's Stub
| Type | Count | List |
|------|-------|------|
| Real pages (100+ lines) | 20 | Home, Crimes, Jail, Hospital, Landing, Login, Register, Onboarding, Settings, Legal, Admin, Bank, BlackMarket, Inventory, Leaderboard, Profile, NotFound, DevOnboardingPreview, FederalJail |
| Stub pages (5 lines) | 16 | Calendar, Casino, City, Company, Events, Forum, Gang, GangWars, Gym, Job, LinkedGangs, Missions, Newspaper, Properties, Travel, Support |
| Not wired | 0 | All pages have routes |

### New Backend Routes (unlocked, new files)
- `backend/src/routes/leaderboardRoutes.ts` — GET /leaderboard/:type (level/money/crimes/points)
- `backend/src/routes/profileRoutes.ts` — GET /profile/:username (public player profile + crime stats)
- `backend/src/services/leaderboardService.ts` — Leaderboard queries

### New Frontend Services
- `frontend/src/services/bank.ts` — Balance, deposit, withdraw, transfer, history
- `frontend/src/services/market.ts` — Browse, buy, list, cancel, my-listings
- `frontend/src/services/inventory.ts` — Get inventory, use, drop
- `frontend/src/services/leaderboard.ts` — Get leaderboard by type
- `frontend/src/services/profile.ts` — Get player profile

### New Frontend Pages
- `frontend/src/pages/Bank.tsx` + `Bank.css` — 5 tabs (balance/deposit/withdraw/transfer/history)
- `frontend/src/pages/BlackMarket.tsx` + `BlackMarket.css` — Browse + My Listings tabs, search, filter, buy, list items
- `frontend/src/pages/Inventory.tsx` + `Inventory.css` — Category filter, use/drop with quantity modal
- `frontend/src/pages/Leaderboard.tsx` + `Leaderboard.css` — 4 type tabs, paginated
- `frontend/src/pages/Profile.tsx` + `Profile.css` — Player stats, crime stats, activity

### Ops Scripts Ready (phases 13-20)
- `tests/load/ramp-up.js` — k6 ramp 0→500 users
- `tests/load/crime-spike.js` — k6 crime endpoint spike
- `tests/load/websocket-test.js` — k6 500 concurrent WS connections
- `tests/load/24h-soak.js` — k6 24h memory leak test
- `tests/load/README.md` — Load testing instructions
- `tests/security/audit.sh` — Security audit (npm audit, secrets scan, TODO check)
- `tests/security/abuse-scenarios.md` — 40+ abuse test scenarios
- `.github/workflows/deploy.yml` — CI/CD deploy workflow
- `docs/PHASE_17_QA.md` — Full QA checklist
- `docs/BETA_PLAN.md` — Beta schedule + metrics
- `docs/LAUNCH_CHECKLIST.md` — Launch sequence + monitoring

### Backend Lock Status
All files in: `middleware/`, `services/`, `controllers/`, `routes/`, `utils/`, `config/`, `models/`, `queues/`, `scripts/` are **LOCKED**. New features = new files (leaderboard, profile routes created as new files).

---

## COST BREAKDOWN

| Item | Cost |
|------|------|
| Hetzner CX32 (after Beta wk2) | €15/mo |
| Domain (annual ÷ 12) | ~€1.25/mo |
| Hetzner Snapshots | €2/mo |
| Resend (if > 3k emails) | $0-20/mo |
| Sentry (if > 5k errors) | $0-26/mo |
| Firebase (if > 10k MAU) | $0-25/mo |
| **Total at launch** | **€18-65/mo** |

### Break-Even
| Source | Needed |
|--------|--------|
| Contributor ($7.99/mo sub) | 3 subscribers |
| Black Card ($4.99 one-time) | 5 sales |
| **Break even** | **< 10 paying players** |
