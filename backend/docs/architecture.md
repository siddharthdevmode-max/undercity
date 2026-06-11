# Undercity Backend — Architecture

## Overview

Game backend for *Undercity*, a real-time multiplayer crime syndicate game. Express API server with Socket.io for real-time events, PostgreSQL for persistence, Redis for caching/rate-limiting, and Sentry for error monitoring.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict mode) |
| Framework | Express 4 |
| WebSocket | Socket.io |
| Database | PostgreSQL 16 (pg npm) |
| Cache | Redis (ioredis) |
| Auth | Firebase Admin SDK |
| Validation | Zod |
| Security | Helmet, CORS, rate limiting |
| Monitoring | Sentry |
| Logging | Winston + Morgan |
| Testing | Vitest |

## Project Structure

```
src/
  app.ts              Express app factory (no side effects)
  server.ts           Boot: DB/Redis connect, listen, game tick
  config/             Environment config, Firebase, Sentry, Socket.io
  middleware/         Pipeline: auth, rate-limit, ban, security, validation
  routes/             Route handlers (thin — delegate to controllers/services)
  controllers/        Request/response logic
  services/           Business logic, engine modules
  models/             Database query functions
  utils/              Errors, logger, graceful shutdown, etc.
  types/              Shared TypeScript types
  __tests__/          Vitest test files
```

## Middleware Pipeline (order in `app.ts`)

1. `trackRequests` — active request counter for graceful shutdown
2. `requestTimeout` — 30s hard limit per request
3. Helmet (CSP, HSTS, frameguard, noSniff, referrer-policy)
4. `requestId` — attach X-Request-ID
5. `ipBlacklist` — block known bad IPs
6. `globalLimiter` — per-IP rate limit
7. CORS — origin allowlist from config
8. JSON body parser (100kb limit, raw body for webhooks)
9. `sanitizeBody/Query/Params` — strip `$` / `{` from inputs
10. `maintenanceCheck` — 503 when FEATURE_MAINTENANCE is on
11. Route mounting (health, auth, game routes, honeypot)
12. `notFoundHandler` + `errorHandler` (last)

## Error Handling

Hierarchy: `AppError` → specialized subclasses (UnauthorizedError, BannedError, ValidationError, etc.). All API errors return `{ error, code, statusCode, errorCode }`. Operational errors are logged at `warn`, programmer errors at `error` with Sentry capture.

## Authentication

Two parallel schemes:
- **Firebase** — Bearer token verified via Firebase Admin SDK, populates `req.firebaseUser`
- **Auth0** — Bearer token verified via JWKS, populates `req.auth0User` (internal/admin only)

## Security

- All security headers via Helmet (CSP with report URI, HSTS in production, frameguard DENY, noSniff)
- Per-IP rate limiting with Redis backend
- Brute-force protection on auth routes
- Input sanitization (NoSQL injection prevention)
- IP blacklist, Turnstile CAPTCHA on registration
- CORS origin allowlist
