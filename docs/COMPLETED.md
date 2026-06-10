# UNDERCITY — COMPLETED LOG
# Last Updated: June 2026

---

> This file only grows. Nothing is ever removed.
> Nothing gets added until verified complete.

---

## Phase 0 — Project Foundation ✅ LOCKED June 2026

**DONE SIGNAL passed:**
- npm run build → 0 errors (backend + frontend)
- npx tsc --noEmit → 0 errors
- npm test → 558/558 passing
- ESLint → 0 warnings
- Docker compose → valid (dev + prod)
- .env.example → 0 duplicates

**Date locked:** June 2026
**Tests at lock:** 558/558
**TypeScript errors:** 0
**ESLint warnings:** 0

**What was hardened:**
- Root: package.json, docker-compose (all 3), .gitignore,
        commitlint, nginx.conf, nginx.prod.conf
- Backend config: database, redis, firebase, socket,
                  tiers, payments, index, envValidator
- Backend middleware: all 14 files audited and verified
- Backend services: trustEngine, behaviorEngine,
                    fingerprintEngine, shadowPunish,
                    vpnDetection, immunityCheck,
                    crimeEngine, crimeService, nerveService,
                    gameTick, trustRecovery, emailService
- Backend queues: index, workers, scheduler
- Backend models: userModels, crimeModels
- Backend utils: errors, gracefulShutdown, schemas,
                 envValidator, sanitize

**Critical fixes applied:**
- docker-compose.prod.yml Redis healthcheck missing AUTH
- nginx.prod.conf limit_req_zone inside server{} block
- nginx.prod.conf backslash before semicolons in proxy_pass
- tsconfig noUnusedLocals/Parameters set to true
- banCheck.ts + firebaseAuth.ts unused res parameter
- paymentService.ts unused rawBody + tier parameters
- shadowPunish.ts Math.random() → crypto.randomInt()
- socket.ts skipMiddlewares=false (auth bypass on reconnect)
- database.ts hardcoded SSL → env-driven (SWAP_ON_VPS)
- emailService.ts process.env direct → config object
- crimeEngine.ts debt message missing space typo
- emailService.ts hardcoded URLs → APP_URL env var

**Locked files:**
backend/src/middleware/*     — all 14 files
backend/src/services/*       — all 12 files
backend/src/controllers/*    — locked
backend/src/routes/*         — all 11 files
backend/src/utils/*          — all 12 files
backend/src/config/*         — all 8 files
backend/src/models/*         — both files
backend/src/queues/*         — all 3 files
backend/src/scripts/*        — all 7 files
nginx.conf                   — locked
nginx.prod.conf              — locked
docker-compose.yml           — locked
docker-compose.dev.yml       — locked
docker-compose.prod.yml      — locked

**Rule: New features = new files.
Never reopen locked files unless critical security vulnerability.**

---

*Next entry: Phase 1 — Database + Migrations*
