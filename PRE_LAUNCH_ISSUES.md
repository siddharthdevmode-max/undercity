# Pre-Launch Issues Found During Audit

> Generated: June 12, 2026 — Phases 1-4 Audit Complete
> All items verified and resolved before push.

## RESOLVED

- [x] **messageService.test.ts** — Written (17 tests, all passing)
- [x] **Firebase service account in git history** — Never committed (`.gitignore` worked)
- [x] **Settings page API** — Uses GDPR endpoints (`/v1/gdpr/export`, `/v1/gdpr/my-data`, `/v1/gdpr/delete-account`) — correct by design
- [x] **DevOnboardingPreview.tsx** — Behind `import.meta.env.DEV`, won't ship to production
- [x] **Redis 3.0.504 in dev** — Windows Redis only; Docker compose uses Redis 7
- [x] **.env.docker** — Already covered by `.gitignore` pattern `.env.*`
- [x] **alerts.test.ts** — Already exists (39 tests passing)
- [x] **Zone.Identifier** — Deleted and removed from git tracking
- [x] **sitemap.xml** — Updated to `undercity.online`

## OBSERVATIONS (No Action Needed)

- `idempotencyCheck` on bank, market, casino routes — payment webhook uses HMAC + queue
- `banCheck` per-route (auth, crimes, challenge, admin, gdpr) — intentional
- `nerveService` has no route (used internally by gameTick) — correct
- Payment system uses Lemon Squeezy, not Stripe — update plan docs if needed
- Game tick: nerve/energy/life/happiness regen, market expiry, tier expiry, circuit breaker
