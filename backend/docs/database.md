# Undercity Backend — Database

## PostgreSQL

Primary database. Connection via `pg` npm pool with `DATABASE_URL` env var. Test connections validated at boot.

### Key Tables

| Table | Purpose |
|---|---|
| `users` | Player accounts, energy, nerve, jail/hospital state |
| `profiles` | Public profile info, stats, trust tier |
| `bank_accounts` | Cash in bank, loan tracking |
| `inventory` | Items owned by players (quantities + metadata) |
| `market_listings` | Active buy/sell orders |
| `crimes` | Crime definitions and outcome tables |
| `gangs` | Player organizations |
| `gang_members` | Membership and roles |
| `bans` | Hard/soft/shadow ban records |
| `referrals` | Referral tracking and rewards |
| `idempotency_keys` | Idempotency for payment/webhook processing |

### Migrations

Migrations live in `src/scripts/migrations/`. Each migration is a timestamped SQL file. Run via `npm run migrate`.

## Redis

Used for:
- **Rate limiting** — sliding window counters per IP
- **Caching** — ban status, market listings, player trust info
- **Session data** — Socket.io adapter for horizontal scaling
- **Idempotency** — deduplication keys with TTL
- **Queues** — delayed job processing

Connection config: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` env vars.

## Key Patterns

- BIGINT columns return as strings from pg — money values use `MoneyValue` type (`string | number | bigint`) to avoid precision loss
- Connection pooling with 30s request timeout to prevent connection starvation
- Database errors are mapped to typed `AppError` subclasses in `errorHandler.ts` (unique constraint → ConflictError, not-null → ValidationError, etc.)
