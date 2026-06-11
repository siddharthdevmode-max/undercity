# UNDERCITY PRODUCTION PLAN

**Target Launch:** December 15, 2026
**Stack:** Node.js + Express + TypeScript + PostgreSQL + Redis + React
**Deployment:** Cloudflare Pages (frontend) + Render/VPS (backend)
**Status:** Phase 0-1 Complete, Phase 1.5 (Scaling) Complete

---

## PHASE SUMMARY

| Phase | Theme | Status | Tests |
|-------|-------|--------|-------|
| **0** | Project Foundation | ✅ COMPLETE | 558/558 |
| **1** | Core Backend (Auth, Crime, Economy) | ✅ COMPLETE | 786/786 |
| **1.5** | Production Scaling (1000 users) | ✅ COMPLETE | 786/786 |
| **2** | Social & Communication | 🔜 Next | — |
| **3** | Player Progression | 📋 Planned | — |
| **4** | PvP & Combat | 📋 Planned | — |
| **5** | Properties & Economy | 📋 Planned | — |
| **6** | Events & Community | 📋 Planned | — |
| **7** | Frontend & Mobile | 📋 Planned | — |
| **8** | Monetization & Payments | 📋 Planned | — |
| **9** | Global Launch & Compliance | 📋 Planned | — |
| **10** | Post-Launch Operations | 📋 Planned | — |

---

## PHASE 0 — Project Foundation ✅ LOCKED

**Goal:** Buildable, testable, deployable project skeleton.

### Backend
- Node.js + Express + TypeScript project initialized
- PostgreSQL connection with pg.Pool (tunable: 75 conns default)
- Redis connection with ioredis (lazy connect + retry strategy)
- Firebase Admin SDK for auth
- BullMQ queues for background jobs
- Socket.io for real-time events
- Winston logger with daily rotate
- Sentry error tracking
- Helmet + CORS + CSP security headers
- Zod validation schemas + middleware
- Rate limiting (Redis-backed, memory fallback)
- Idempotency middleware (Redis-backed)
- Turnstile CAPTCHA integration
- Brute force protection
- UAC challenge system for anti-bot
- Fingerprint engine for device tracking
- VPN/proxy detection
- Ban system (hard + shadow)
- Trust engine + recovery system
- Graceful shutdown
- Health check endpoints (liveness + detailed + Prometheus metrics)
- IP blacklisting
- Environment validation at boot
- Cluster mode support (multi-core)

### Frontend
- React + TypeScript + Vite project initialized
- Basic routing structure
- Landing page

### Infrastructure
- Docker Compose (dev + prod)
- Nginx config (dev + prod)
- ESLint + Prettier + Commitlint
- CI/CD with GitHub Actions
- DEPLOYMENT.md, RUNBOOK.md, BCP.md, COST.md

### DONE SIGNAL
- `npm run build` → 0 errors
- `npx tsc --noEmit` → 0 errors
- `npm test` → 558/558 passing
- ESLint → 0 warnings
- Docker Compose → valid (dev + prod)

---

## PHASE 1 — Core Backend ✅ COMPLETE

**Goal:** All core game routes, services, and models fully hardened — validated, idempotent, rate-limited, tested.

### Routes (15) — All Wired
| Route | Validation | Idempotency | Rate Limit | Auth |
|-------|-----------|-------------|------------|------|
| `auth/sync` | ✅ | — | ✅ authSyncLimiter | Firebase |
| `auth/me` | ✅ | — | ✅ authMeLimiter | Firebase |
| `auth/username-check` | ✅ | — | ✅ usernameCheckLimiter | IP |
| `crimes` GET | ✅ | — | — | Firebase |
| `crimes/attempt` POST | ✅ | ✅ | ✅ crimeLimiter | Firebase + Turnstile + Challenge |
| `stats` | ✅ | — | ✅ statsLimiter | Firebase |
| `challenge` | ✅ | — | ✅ challengeLimiter | Firebase |
| `admin/*` | ✅ | — | ✅ adminLimiter | Firebase + Admin |
| `gdpr/*` | ✅ | — | ✅ gdprLimiter | Firebase |
| `mfa/*` | ✅ | — | ✅ mfaLimiter | Firebase |
| `support/*` | ✅ | — | ✅ supportLimiter | Firebase |
| `payments/*` | ✅ | — | ✅ paymentLimiter | Firebase |
| `bank/*` | ✅ | ✅ | ✅ bankLimiter | Firebase |
| `market/*` | ✅ | ✅ | ✅ marketLimiter | Firebase |
| `inventory/*` | ✅ | ✅ | ✅ inventoryLimiter | Firebase |
| `referral/*` | ✅ | ✅ | ✅ referralLimiter | Firebase |

### Services (12) — All Tested
- crimeEngine, crimeService
- trustEngine, trustRecovery
- nerveService, bankService
- marketService, inventoryService
- referralService, emailService
- behaviorEngine, fingerprintEngine
- shadowPunish, vpnDetection
- immunityCheck, gameTick

### Middleware (14) — All Tested
- firebaseAuth, banCheck, rateLimiter
- idempotency, validate, cacheHeaders
- errorHandler, securityMiddleware
- sanitizeMiddleware, requireAdmin
- turnstileVerifier, challengeVerifier
- requestId, internalOnly

### Migrations (23) — All Rollback-Safe
- Users, crimes, crime_specials, user_crime_progress, user_crime_specials
- Auth logs, device fingerprints, UAC violations
- Bank transactions, market listings, user inventory
- Support tickets, admin audit log
- Payment logs (v2 with Lemon Squeezy columns)
- Idempotency keys, trust recovery log
- Tiers (user_tier_enum, tier columns, nerve regen timestamp)

### DONE SIGNAL
- All routes validated, idempotent, rate-limited
- 0 raw Error throws in route handlers
- 786/786 tests passing
- ESLint 0 warnings
- TypeScript 0 errors

---

## PHASE 1.5 — Production Scaling ✅ COMPLETE

**Goal:** Handle 1000 concurrent users without degradation.

### Changes
- DB pool: 20 → 75 connections (env-configurable)
- Dedicated game tick pool (5 conns, never starves user requests)
- Redis user cache (15s TTL, reduces redundant SELECTs by ~80%)
- Cluster mode: `npm run start:cluster` forks worker per CPU core
- Pool connection timeout (10s), statement timeout (10s), lock timeout (5s)
- Both pools exposed in health metrics + Prometheus

### Capacity Estimate
- 75 conns × 4 cluster workers = 300 total connections
- ~3,800 crimes/sec theoretical throughput
- Tick pool isolated — never competes with user requests

---

## PHASE 2 — Social & Communication 🔜 NEXT

**Goal:** Players can form groups, chat, and communicate.

### Backend
- **Factions system**
  - CRUD: create, disband, leave
  - Membership: invite, accept, kick, rank management
  - Faction bank (shared money pool with permissions)
  - Faction armory (shared item pool)
  - Faction news feed
- **Chat system** (Socket.io)
  - Global chat channel
  - Faction-only channel
  - Direct messages (1:1)
  - Rate-limited per channel (10 msg/10s)
  - Profanity filter (existing)
  - /report command to flag messages
- **Notifications** (Socket.io)
  - Crime results (existing)
  - Faction invites
  - Attack warnings
  - DM notifications
  - Configurable notification preferences
- **Newspaper**
  - Auto-generated headlines: biggest crime wins, faction wars, top earners
  - Player-submitted classifieds (costs in-game money)
  - Page views tracked for ad revenue (future)

### Database
- `factions` table
- `faction_members` table
- `faction_bank_transactions` table
- `faction_armory` table
- `chat_messages` table (with TTL-based cleanup)
- `notifications` table

### Frontend
- Faction management page
- Chat panel (collapsible sidebar)
- Notification dropdown/bell icon
- Newspaper page

### Security
- Chat rate limiting per-user (Redis)
- Anti-spam: max 10 messages per 10 seconds
- /report creates support ticket automatically
- Faction invite spam prevention (5 invites/hr per user)

### DONE SIGNAL
- Create/disband/join/leave faction works
- Chat messages delivered via Socket.io in <200ms
- Newspaper generates 5+ headlines daily
- 100% of new code tested

---

## PHASE 3 — Player Progression 📋

**Goal:** Players can work, train, study, and grow their character.

### Backend
- **Job system**
  - List available jobs (unlocked by level + stats)
  - Work action: 1x per day, reward = salary + bonus based on stats
  - Job promotion: after N days, stat thresholds met
  - Side jobs (medical, law, education — each with unique perks)
- **Gym training**
  - Train strength/defense/speed/dexterity
  - Energy cost per session (5 energy)
  - Stat gain based on gym quality + current stat level
  - Gym quality tiers (cheap, standard, premium — different energy:gain ratios)
- **Education**
  - Courses: programming, business, sports, biology, etc.
  - Real-time duration (4h to 7d)
  - Permanent stat bonuses + unlocks on completion
  - Queue-based: 1 course at a time
- **Skills system**
  - Passive skills: manual dexterity, perception, endurance
  - Active skills: hacking, lockpicking, forgery
  - Skill XP earned by relevant actions
  - Skill levels unlock special crime variants

### Database
- `jobs` table (with tiers, requirements, bonuses)
- `user_jobs` table (current job, start date, promotions)
- `gym_sessions` table (log with stat gains)
- `education_courses` table
- `user_education` table (enrolled, progress, completed)
- `skills` table (definitions)
- `user_skills` table (levels, XP)

### Frontend
- Job page (list jobs, work button, promotion progress)
- Gym page (select stat, train button, energy cost display)
- Education page (course catalog, enrollment, progress timer)
- Skills page (tree/grid view, XP bars)

### DONE SIGNAL
- 6+ jobs across 3 tiers working end-to-end
- Gym training correctly deducts energy and grants stats
- 5+ education courses with real-time completion
- Skills unlock new crime variants

---

## PHASE 4 — PvP & Combat 📋

**Goal:** Players can attack each other, steal, and fight for reputation.

### Backend
- **Attack system**
  - Nerve cost per attack (15 nerve default)
  - Target must be online OR last seen < 60 min
  - Stat-based outcome calculation
  - Rewards: steal money (based on target's bank), gain XP
  - Risks: get mugged in return (if target has weapon), go to hospital
- **Hospital system**
  - Automatically sent to hospital when life ≤ 0
  - Recovery time based on damage taken (1-60 min)
  - Can be revived by faction member (costs them energy)
  - Hospital fees (small money deduction)
- **Jail system** (existing foundation — expand)
  - Federal vs normal jail (existing)
  - Bail option (faction bank or personal)
  - Prison labor mini-game (reduce sentence)
- **War system**
  - Faction A declares war on Faction B
  - War duration: 24-72 hours
  - Points for successful attacks
  - Winner gets temporary territory bonus (5% more money from crimes)

### Database
- `pvp_attacks` table
- `pvp_rankings` table (seasonal leaderboard)
- `hospital_records` table
- `faction_wars` table
- `war_attacks` table

### Frontend
- Attack page (target search, stat comparison, execute)
- Attack log (incoming/outgoing)
- Hospital page (recovery timer, revive button)
- War declaration UI (faction leaders only)
- War status dashboard

### Security
- Cooldown: cannot attack same target within 15 min
- Hospital: cannot be attacked
- Jail: cannot be attacked
- Level range protection: ±5 levels (configurable)
- Newbie protection: level < 5 cannot be attacked
- Max attacks per day: 100 (prevent botting)

### DONE SIGNAL
- Full attack cycle works: select target → attack → result → loot/hospital
- Hospital recovery with revive works
- Faction wars with scoring work
- All PvP actions logged and auditable

---

## PHASE 5 — Properties & Economy 📋

**Goal:** Players can own property, invest, and build wealth.

### Backend
- **Properties system**
  - Types: shack, apartment, house, mansion, penthouse
  - Pricing: 50k to 50M
  - Upkeep: daily fee (higher for better properties)
  - Benefits: energy cap increase, nerve cap increase, passive income
  - Upgrades: security system (reduce mugging chance), interior (increase happiness)
- **Rental market**
  - Rent out unused properties for daily income
  - Market rate determined by supply/demand
  - Rental contract: 7/14/30 day terms
- **Economy balancing**
  - Money sink analysis: ensure money sinks > money faucets
  - Item decay: weapons/tools degrade with use
  - Market fees: listing fee + 5% transaction tax
  - Bank interest: 0.1% daily on savings (competing with inflation)
- **Stocks (Phase 5.5)**
  - In-game stock market
  - NPC-driven price fluctuations
  - Player trading
  - Dividend payments

### Database
- `properties` table with upgrade tracking
- `property_types` table (definitions)
- `rental_contracts` table
- `stocks` table (for Phase 5.5)
- `stock_portfolios` table

### Frontend
- Property page (buy, view, upgrade, set rent)
- Rental market listings
- Stock page (watchlist, buy/sell, portfolio)

### DONE SIGNAL
- 5 property types purchasable with correct benefits
- Rental contracts work (income + expiry)
- Money sink/funnel ratio within 0.9-1.1 range
- Stock market (Phase 5.5) functional with NPC trading

---

## PHASE 6 — Events & Community 📋

**Goal:** Daily/weekly events, competitions, and community features.

### Backend
- **Event system**
  - Scheduled events (calendar)
  - Recurring: daily bonuses, weekly tournaments
  - Special: holiday events, double XP weekends
  - Event configuration stored in DB (no code deploy needed)
- **Calendar**
  - Upcoming events displayed
  - Event history
  - Reminder notifications (optional)
- **Hall of Fame / Leaderboards**
  - Categories: richest, strongest, most crimes, most PvP wins
  - Seasonal resets (monthly)
  - Rewards for top 10 (money, items, titles)
- **Missions / Achievements**
  - Mission chains: "First crime" → "100 crimes" → "1,000 crimes"
  - Achievement badges (displayed on profile)
  - Reward tiers: money, items, titles, permanent stat boosts
  - Configurable in DB (new missions added without deploy)
- **Activity feed**
  - Per-player activity log
  - Friends can see each other's highlights
  - Privacy controls

### Database
- `calendar_events` table
- `leaderboard_snapshots` table (historical)
- `achievements` table (definitions)
- `user_achievements` table (progress, completed)
- `activity_feed` table

### Frontend
- Calendar page with event list
- Leaderboard page (filterable by category + season)
- Achievements page (grid with progress bars)
- Activity feed on profile page

### DONE SIGNAL
- Calendar displays events + sends reminders
- Leaderboards update in real-time, season reset works
- 20+ achievements across 5 categories
- Mission chains with rewards work end-to-end

---

## PHASE 7 — Frontend & Mobile 📋

**Goal:** Polished frontend experience, responsive across devices.

### Frontend Architecture
- Migrate from demo/Vite scaffold to production React app
- Implement proper state management (Zustand)
- Implement React Query for API caching
- Design system: consistent component library
- Dark theme (matching crime MMO aesthetic)

### Pages (18 total)
| Page | Priority | Notes |
|------|----------|-------|
| Landing | P0 | Marketing page, login/register |
| Home | P0 | Dashboard with stats, quick actions |
| City | P0 | Location map (Phase 1-2) |
| Crimes | P0 | Crime list + execute (existing) |
| Job | P1 | Work + promotion |
| Gym | P1 | Training interface |
| Education | P2 | Course catalog + progress |
| Hospital | P1 | Recovery + revive |
| Jail | P2 | Bail + prison labor |
| Casino | P3 | Mini-games (gated by compliance) |
| Properties | P2 | Own + rental market |
| Faction | P2 | Management + roster |
| Newspaper | P1 | Headlines + classifieds |
| Calendar | P2 | Events |
| Profile | P0 | Stats, achievements, activity |
| Attack Log | P1 | PvP history |
| Settings | P0 | Preferences, MFA, GDPR |
| Hall of Fame | P2 | Leaderboards |

### Mobile
- Responsive design for all pages
- Touch-friendly interactions
- PWA support (offline fallback, install prompt)
- Push notifications (crime results, attack warnings)
- Reduced data mode (compress images, lazy load)

### Performance Targets
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Lighthouse score: >85 all categories
- Bundle size: <200KB initial JS

### DONE SIGNAL
- All 18 pages built and responsive
- Lighthouse score >85
- PWA installable with push notifications
- API response caching with React Query

---

## PHASE 8 — Monetization & Payments 📋

**Goal:** Generate revenue while keeping the game fair.

### Payment System (Lemon Squeezy — existing skeleton)
- **Black Card (Citizen tier)**: $4.99 one-time, 31 days
  - Perks: faster energy regen, exclusive crime line
- **Contributor**: $7.99/month subscription
  - Perks: fastest regen, priority support, contributor badge
- **Bonus Packs**: optional one-time purchases
  - Energy refill, nerve refill, stat boosts
- **No pay-to-win**: Paid tiers only accelerate time-gated mechanics
  - VIP players cannot bypass cooldowns
  - No exclusive weapons/stats from paid tiers

### Implementation
- Complete Lemon Squeezy webhook handling (existing skeleton)
- Webhook worker: process subscription lifecycle
- Tier grant/expiry ties into existing game tick
- Receipt/invoice email via Resend
- Refund handling: revoke tier, log in admin audit

### Economy Guardrails
- Daily purchase cap: $50/user/day
- No direct purchase of in-game currency
- Black Card is one-time — cannot stack
- Contributor auto-renew with cancel anytime
- Refund policy: 14-day, no questions asked
- Children (under 18) cannot purchase — gated by DOB

### Accounting
- Payment logs table (existing)
- Monthly revenue reports
- Failed payment retry logic (3 attempts)
- Grace period: 7 days after payment failure before tier revoked

### Razorpay (India — Phase 8.5)
- UPI + cards + netbanking
- Indian pricing: ₹299 citizen, ₹499 contributor
- Separate webhook processing

### DONE SIGNAL
- Lemon Squeezy webhook processes subscriptions end-to-end
- Tier grants auto-expire and renew
- Purchase cap enforced
- Refund handling tested
- 100% of payment tests passing

---

## PHASE 9 — Global Launch & Compliance 📋

**Goal:** Legally launch in target markets with full compliance.

### Legal
- [ ] Lawyer review (India cyber-law, ₹3-5k)
- [ ] Register proprietorship or Pvt Ltd
- [ ] GST registration (if revenue > ₹20L/year)
- [ ] EU: Cookie consent banner (opt-in granular)
- [ ] EU: Data Processing Agreement with Firebase + Cloudflare
- [ ] EU: Designate EU representative (Art. 27 GDPR)
- [ ] USA: Add "Do Not Sell" link
- [ ] USA: State-specific privacy addendums
- [ ] Casino: DISABLED everywhere until lawyer-cleared
- [ ] TOS + Privacy Policy → Version 2.0 with all addendums

### Infrastructure
- [ ] Move from Render to dedicated VPS (Hetzner CX22: $8.59/mo)
- [ ] Database SSL enabled (SWAP_ON_VPS)
- [ ] PgBouncer for connection pooling
- [ ] Cloudflare WAF enabled ($20/mo)
- [ ] Turnstile production keys deployed
- [ ] Sentry production DSN configured
- [ ] Regular backup verification (daily)
- [ ] Incident response drills

### Security
- [ ] External pen test (recommended) or automated security scan
- [ ] Firebase security rules audit
- [ ] Rate limits tuned based on beta traffic
- [ ] Abuse detection monitors in place
- [ ] Admin dashboard for manual review
- [ ] DDoS mitigation plan tested

### Launch Sequence
1. **Closed Beta**: ≤50 invite users, 2 weeks
   - Monitor error rates, DB load, response times
   - Collect feedback through support tickets
2. **Open Beta**: Unlimited signups, 4 weeks
   - Ramp up: 100 → 500 → 1000 users
   - Scale infrastructure at each step
3. **Launch**: December 15, 2026 (target)
   - Marketing social push
   - Monitor 24/7 for first 72 hours
   - War room: all alerts on high

### Soft Launch Metrics
- P95 response time < 500ms
- Error rate < 0.1%
- DB CPU < 50%
- Redis memory < 70%
- Signup conversion > 20%
- D1 retention (day 1) > 40%

### DONE SIGNAL
- All legal docs signed and published
- Infrastructure hardened and tested
- Beta run with 50+ users, all metrics green
- Launch date set and communicated

---

## PHASE 10 — Post-Launch Operations 📋

**Goal:** Keep the game running, growing, and financially sustainable.

### Live Operations
- **Daily**: Health check, error log review, backup verification
- **Weekly**: User growth review, economy metrics, cost tracking
- **Monthly**: Leaderboard reset, revenue report, content update
- **Quarterly**: Feature release, infrastructure review, security audit

### Content Pipeline
- New crimes: 5 per month
- New items: 3 per month
- Limited-time events: 1 per month
- Seasonal: Halloween, Christmas, New Year events
- Community: player-voted feature priorities

### Scaling
| Metric | Threshold | Action |
|--------|-----------|--------|
| DB CPU > 70% sustained | 30 min | Upgrade Neon plan or add read replica |
| Redis > 80% memory | Sustained | Increase maxmemory or upgrade plan |
| P95 > 500ms | 10 min | Add backend worker or optimize query |
| Error rate > 0.5% | 5 min | Alert → rollback or hotfix |
| Active users > 2000 | Weekly trend | Add PgBouncer, increase pool, add VPS RAM |

### Community
- Discord server for announcements + support
- Bug bounty program (in-game rewards)
- Player council (top 10 by level — monthly feedback)
- Content creator program (revenue share)

### Revenue Goals
| Month | Target | Burn Rate | Margin |
|-------|--------|-----------|--------|
| 1-3 | $200/mo | $80 | 60% |
| 4-6 | $500/mo | $150 | 70% |
| 7-12 | $1,000/mo | $300 | 70% |
| Year 2 | $3,000/mo | $500 | 83% |

### Exit / Wind-Down Plan
- If revenue < cost for 6 consecutive months:
  1. Reduce infrastructure to minimum
  2. Offer all paid users pro-rata refunds
  3. 90-day notice before shutdown
  4. Data export window for all users (30 days)
  5. Permanent data deletion
  6. Archive codebase as open-source (if viable)

### DONE SIGNAL
- 3 months post-launch, revenue > 2x costs
- Monthly content updates shipping
- Player retention > 30% at 30 days

---

## COST ROADMAP

| Phase | Monthly Cost | Cumulative |
|-------|-------------|------------|
| Dev (0-1.5) | $0 | $0 |
| Beta (2-6) | $7-30 | $140 |
| Launch (7-8) | $30-80 | $380 |
| Growth (9-10) | $80-300 | $2,300 |

## KEY DATES

| Milestone | Date |
|-----------|------|
| Phase 0-1 Locked | June 2026 |
| Phase 1.5 Complete | June 2026 |
| Closed Beta Start | TBD |
| Open Beta Start | TBD |
| Launch | December 15, 2026 |
| First Revenue Report | January 2027 |

---

*This plan is a living document. Update as priorities shift.*
