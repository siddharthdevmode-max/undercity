# UNDERCITY — PRODUCTION PLAN
# Solo Dev | Target Launch: January 1, 2027
# Domain: undercity.online
# Day 1 Target: 5,000 players | Week 1 Target: 10,000 players

---

## REALITY CHECK — SOLO DEV CAPACITY

Before anything else, understand what 10k players means:

| Metric | Estimate |
|--------|----------|
| Concurrent players (peak day 1) | ~500-800 |
| API requests/minute (peak) | ~15,000-25,000 |
| DB queries/minute (peak) | ~50,000-80,000 |
| WebSocket connections (peak) | ~500-800 |
| Redis operations/minute | ~30,000-50,000 |
| Storage growth/month | ~2-5 GB |
| Bandwidth/month | ~500 GB - 1 TB |

This is very manageable with the right setup.
You do NOT need AWS/GCP for this. A well-configured VPS handles it.

---

## INFRASTRUCTURE SPEC

### Recommended VPS (Hetzner — best price/performance for solo dev)

| Phase | Server | RAM | CPU | Storage | Cost/mo |
|-------|--------|-----|-----|---------|---------|
| Pre-launch (now → Dec 2026) | CX21 | 4GB | 2 vCPU | 40GB | ~€5 |
| Launch week (Jan 2027) | CX32 | 8GB | 4 vCPU | 80GB | ~€15 |
| Growth (10k+ players) | CX42 | 16GB | 8 vCPU | 160GB | ~€35 |

Upgrade takes 5 minutes on Hetzner. Zero downtime resize.
Start on CX21, move to CX32 one week before launch.

### Full Stack

| Service | Provider | Cost/mo |
|---------|----------|---------|
| VPS (backend + DB + Redis) | Hetzner CX32 | €15 |
| Frontend hosting | Cloudflare Pages | FREE |
| DNS + DDoS + CDN | Cloudflare | FREE |
| Auth | Firebase (Spark plan) | FREE (up to 10k users) |
| Email | Resend | FREE (3k/mo) → $20 after |
| Error monitoring | Sentry | FREE (5k errors/mo) |
| Payments | Stripe | 2.9% + 30c per transaction |
| Domain | undercity.online | ~$15/yr |
| SSL | Let's Encrypt via Certbot | FREE |
| Backups | Hetzner Snapshot | ~€2/mo |

**Total fixed cost at launch: ~€35-40/month**
First revenue from 10 Contributor subscriptions covers server cost.

---

## NON-GAME PRODUCTION CHECKLIST
## (Everything that must work before a single player logs in)

---

### CATEGORY 1 — INFRASTRUCTURE

#### 1.1 Domain + DNS
- [ ] Buy undercity.online
- [ ] Add to Cloudflare (free plan)
- [ ] DNS records:
      A     undercity.online      → VPS IP
      A     api.undercity.online  → VPS IP
      CNAME www                   → undercity.online
- [ ] Enable Cloudflare proxy (orange cloud) on all records
- [ ] SSL/TLS mode: Full (strict) in Cloudflare dashboard
- [ ] Always Use HTTPS: ON
- [ ] HSTS: enabled (after testing)

#### 1.2 VPS Setup
- [ ] Hetzner CX21 → upgrade to CX32 one week before launch
- [ ] Ubuntu 22.04 LTS
- [ ] SSH key auth only (no password auth)
- [ ] UFW firewall:
      allow 22 (SSH)
      allow 80 (HTTP — Certbot only)
      allow 443 (HTTPS)
      deny everything else
- [ ] Docker + Docker Compose installed
- [ ] Fail2ban installed (blocks brute force SSH)
- [ ] Automatic security updates enabled
- [ ] Swap file: 4GB (protects against OOM kills)
- [ ] /opt/undercity directory created
- [ ] Deploy user created (not root)

#### 1.3 SSL Certificate
- [ ] Certbot installed
- [ ] Certificate for api.undercity.online
- [ ] Auto-renewal cron configured
- [ ] Test renewal: certbot renew --dry-run

#### 1.4 Docker Setup
- [ ] docker-compose.yml production config verified
- [ ] .env production file created with all real values
- [ ] Postgres password: 32+ char random string
- [ ] Redis password: 32+ char random string
- [ ] All services start cleanly: docker compose up -d
- [ ] Health checks passing on all containers

#### 1.5 Nginx
- [ ] nginx.conf updated with undercity.online domain
- [ ] Rate limiting zones configured
- [ ] Cloudflare IP ranges in set_real_ip_from (already done)
- [ ] WebSocket proxy working (/socket.io/)
- [ ] Gzip compression enabled
- [ ] Bad bot blocking active

---

### CATEGORY 2 — DATABASE

#### 2.1 Migrations
- [ ] All 16 migrations run cleanly on fresh DB
- [ ] Migration 1700000013001_user-tiers.js runs without error
- [ ] Migration 1700000014000_nerve-regen-timestamp.js runs without error
- [ ] Verify schema with: \d users in psql
- [ ] All indexes created (check baseline-indexes migration)

#### 2.2 Performance
- [ ] postgresql.conf tuned for 4GB RAM VPS:
      max_connections = 100
      shared_buffers = 1GB
      effective_cache_size = 3GB
      maintenance_work_mem = 256MB
      checkpoint_completion_target = 0.9
      wal_buffers = 16MB
      default_statistics_target = 100
      random_page_cost = 1.1
      effective_io_concurrency = 200
- [ ] DB pool size in backend: max 20 connections
- [ ] Slow query logging enabled (already in migrations)
- [ ] pg_stat_statements extension enabled

#### 2.3 Backups
- [ ] Automated daily backup via BullMQ (already built)
- [ ] Backup retention: 7 days locally
- [ ] Weekly backup copied to Hetzner Storage Box or Cloudflare R2
- [ ] Backup restoration tested before launch
- [ ] Backup alert if backup job fails

#### 2.4 Seed Data
- [ ] All crimes seeded (seedSpecials.ts)
- [ ] Crime specials seeded
- [ ] Verify crime count: SELECT COUNT(*) FROM crimes;
- [ ] Verify specials: SELECT COUNT(*) FROM crime_specials;

---

### CATEGORY 3 — BACKEND

#### 3.1 Build
- [ ] npm run build passes with 0 errors
- [ ] All TypeScript strict mode errors resolved
- [ ] No any types in production code
- [ ] ESLint passes with 0 errors

#### 3.2 Environment Variables
- [ ] All required vars set in production .env
- [ ] FINGERPRINT_SALT: 32+ char random string
- [ ] NODE_ENV=production
- [ ] FEATURE_VPN_CHECK=true
- [ ] FEATURE_PAYMENTS=true
- [ ] FEATURE_API_DOCS=false
- [ ] ALLOWED_ORIGINS=https://undercity.online,https://www.undercity.online
- [ ] ADMIN_UIDS set to your Firebase UID

#### 3.3 Firebase
- [ ] Production Firebase project created
- [ ] Service account JSON downloaded and configured
- [ ] Email/password auth enabled
- [ ] Google auth enabled (optional but recommended)
- [ ] Email verification required: YES
- [ ] Firebase project ID in all env vars

#### 3.4 Game Systems (must work before launch)
- [ ] Auth sync (register + login)
- [ ] Onboarding flow
- [ ] Crimes (attempt, outcomes, nerve deduction)
- [ ] Nerve regeneration (tier-aware, game tick running)
- [ ] Energy regeneration
- [ ] Life regeneration
- [ ] Jail system (jail_until respected in crime controller)
- [ ] Hospital system (hospital_until blocks life regen)
- [ ] Trust engine (UAC flags working)
- [ ] Shadow ban system working
- [ ] Admin panel accessible at /admin
- [ ] Health endpoint returns 200

#### 3.5 Security
- [ ] Rate limiting tested (429 returns correctly)
- [ ] IP blacklist tested
- [ ] Honeypot routes return 404/403
- [ ] Firebase token verification working
- [ ] Ban check middleware working
- [ ] Turnstile configured (real site key + secret key)
- [ ] Cloudflare Turnstile widget on register + login
- [ ] VPN detection active (FEATURE_VPN_CHECK=true)
- [ ] CSP headers present in responses
- [ ] CORS only allows undercity.online

#### 3.6 Payments (Stripe)
- [ ] Stripe account created and verified
- [ ] Live mode keys configured (NOT test mode on launch)
- [ ] Stripe webhook endpoint configured:
      https://api.undercity.online/api/v1/payments/webhook
- [ ] Webhook secret in .env
- [ ] Black Card purchase flow tested end-to-end
- [ ] Contributor subscription flow tested end-to-end
- [ ] Payment confirmation email working
- [ ] Refund policy implemented per docs/legal/refund-policy.md

#### 3.7 Email
- [ ] Resend account created
- [ ] Domain verified in Resend (undercity.online)
- [ ] Welcome email tested
- [ ] Security alert email tested
- [ ] Purchase confirmation email tested

#### 3.8 Monitoring
- [ ] Sentry DSN configured
- [ ] Discord webhook configured for alerts
- [ ] Error rate alerting working
- [ ] Game tick health visible at /api/v1/stats/tick
- [ ] DB pool exhaustion alert working
- [ ] Backup failure alert working

---

### CATEGORY 4 — FRONTEND

#### 4.1 Build
- [ ] npm run build passes with 0 errors
- [ ] TypeScript strict mode passes
- [ ] Bundle size under 10MB
- [ ] Source maps generated for Sentry

#### 4.2 Cloudflare Pages
- [ ] Project created in CF Pages dashboard
- [ ] Connected to GitHub repo
- [ ] Build settings configured:
      Build command: cd frontend && npm install && npm run build
      Output directory: frontend/dist
      Root: /
- [ ] All environment variables set in CF dashboard
- [ ] Custom domain: undercity.online pointed to CF Pages
- [ ] _redirects file present (SPA routing fix)
- [ ] Preview deployments working on PRs

#### 4.3 Core Pages (must work at launch)
- [ ] Landing page (unauthenticated)
- [ ] Register page
- [ ] Login page
- [ ] Onboarding flow (5 steps)
- [ ] Home/Dashboard (nerve, energy, life bars)
- [ ] Crimes page (list + attempt + result)
- [ ] Jail page (timer, bail info)
- [ ] Hospital page (timer)
- [ ] Profile page (stats, tier badge)
- [ ] Settings page (basic account settings)
- [ ] Legal pages (ToS, Privacy, etc.)
- [ ] 404 page
- [ ] Admin panel (admin-only)

#### 4.4 Stub Pages (present but locked/coming soon)
- [ ] Black Market (coming soon banner)
- [ ] Gangster Shop (coming soon banner)
- [ ] Back Alley (coming soon banner)
- [ ] Gang (coming soon banner)
- [ ] Casino (coming soon banner)
- [ ] Gym (coming soon banner)
- [ ] Properties (coming soon banner)

#### 4.5 UI/UX
- [ ] Dark mode works
- [ ] Light mode works
- [ ] Mobile responsive (minimum 375px width)
- [ ] Loading skeletons on all data fetches
- [ ] Error boundaries on all pages
- [ ] Toast notifications working
- [ ] Nerve/Energy/Life bars update in real-time via WebSocket
- [ ] Age gate working (18+ check)
- [ ] Cookie consent banner working

#### 4.6 Performance
- [ ] Lighthouse score > 80 on all core pages
- [ ] First contentful paint < 2s
- [ ] Images optimized (WebP format)
- [ ] Fonts loaded efficiently

---

### CATEGORY 5 — CI/CD PIPELINE

#### 5.1 GitHub Setup
- [ ] Main branch protected (no direct push)
- [ ] PR required for all changes
- [ ] CI must pass before merge
- [ ] All GitHub secrets configured:
      SERVER_HOST
      SERVER_USER
      SERVER_SSH_KEY
      DOCKER_USERNAME
      DOCKER_TOKEN
      CLOUDFLARE_API_TOKEN
      CLOUDFLARE_ACCOUNT_ID
      VITE_API_URL
      VITE_FIREBASE_API_KEY
      VITE_FIREBASE_AUTH_DOMAIN
      VITE_FIREBASE_PROJECT_ID
      VITE_FIREBASE_APP_ID
      VITE_TURNSTILE_SITE_KEY
      SLACK_WEBHOOK_URL
      DATABASE_URL
- [ ] Production environment created in GitHub
- [ ] Manual approval gate on production deploys

#### 5.2 CI Pipeline
- [ ] Secret scanning (Gitleaks) passing
- [ ] TypeScript check passing
- [ ] All tests passing
- [ ] ESLint passing
- [ ] npm audit passing (no high/critical vulns)
- [ ] Docker build passing
- [ ] Trivy container scan passing

#### 5.3 Deploy Pipeline
- [ ] Backend deploy tested end-to-end
- [ ] Health check after deploy working
- [ ] Rollback tested (manually trigger a bad deploy)
- [ ] Frontend deploy to CF Pages working
- [ ] Smoke tests passing after full deploy
- [ ] Slack notifications working

---

### CATEGORY 6 — LEGAL (required before accepting payments)

#### 6.1 Documents (all exist in docs/legal/)
- [ ] Terms of Service live on site
- [ ] Privacy Policy live on site
- [ ] Cookie Policy live on site
- [ ] Refund Policy live on site
- [ ] Age Verification (18+) enforced
- [ ] GDPR compliance page live
- [ ] Virtual Currency disclaimer live
- [ ] Gambling disclaimer live (if casino feature active)
- [ ] Community Rules live

#### 6.2 Stripe Compliance
- [ ] Stripe account fully verified (ID + business info)
- [ ] Business description matches actual product
- [ ] Refund policy linked in Stripe dashboard
- [ ] Terms of service linked in Stripe dashboard

#### 6.3 GDPR (you have EU players = mandatory)
- [ ] Cookie consent banner implemented
- [ ] Data export endpoint working (/api/v1/gdpr/export)
- [ ] Account deletion endpoint working (/api/v1/auth/account DELETE)
- [ ] Privacy policy explains all data collected
- [ ] Data retention policy documented and enforced

---

### CATEGORY 7 — PRE-LAUNCH TESTING

#### 7.1 Load Testing (do this 2 months before launch)
- [ ] k6 load test with 500 concurrent users
- [ ] Crime attempt endpoint handles 100 req/sec
- [ ] WebSocket holds 500 concurrent connections
- [ ] DB pool doesn't exhaust under load
- [ ] Redis handles queue under load
- [ ] Game tick runs cleanly under load
- [ ] No memory leaks after 24h run

#### 7.2 Security Testing
- [ ] OWASP ZAP scan on all API endpoints
- [ ] SQL injection attempts blocked
- [ ] Rate limiting verified at all levels
- [ ] Auth bypass attempts blocked
- [ ] Admin routes inaccessible to non-admins
- [ ] Honeypot routes flagging correctly

#### 7.3 Game Balance Testing
- [ ] Nerve regen rates correct per tier
- [ ] Crime outcomes match expected distribution
- [ ] Jail times correct
- [ ] XP progression feels right
- [ ] Money economy not inflating too fast
- [ ] Black Card purchase gives correct tier

#### 7.4 End-to-End Testing
- [ ] Full new player journey:
      Register → Onboarding → First crime → Jail → Release → Continue
- [ ] Black Card purchase:
      Buy → Stripe → Webhook → Citizen status → Regen rate changes
- [ ] Contributor subscription:
      Subscribe → Stripe → Webhook → Contributor status → Faster regen
- [ ] Admin panel:
      Login as admin → View users → Ban user → Unban user
- [ ] GDPR flow:
      Request data export → Receive export → Delete account

---

### CATEGORY 8 — LAUNCH DAY OPERATIONS

#### 8.1 One Week Before (Dec 25, 2026)
- [ ] Upgrade VPS to CX32
- [ ] Full backup before upgrade
- [ ] All load tests passing
- [ ] All smoke tests passing
- [ ] Maintenance mode tested
- [ ] Discord server created for players
- [ ] Social media accounts created

#### 8.2 Launch Day (Jan 1, 2027)
- [ ] Final backup at 00:00 UTC
- [ ] Disable maintenance mode at launch time
- [ ] Monitor Sentry for error spikes
- [ ] Monitor Discord for player reports
- [ ] Watch DB connections in admin panel
- [ ] Watch Redis memory usage
- [ ] Watch game tick logs
- [ ] Have rollback plan ready
- [ ] Have VPS upgrade path ready (CX32 → CX42 if needed)
- [ ] Be online for first 6 hours minimum

#### 8.3 First Week Monitoring
- [ ] Daily backup verified
- [ ] Error rate < 1% of requests
- [ ] Game tick running every 60s
- [ ] No DB pool exhaustion events
- [ ] Player count tracking
- [ ] Revenue tracking
- [ ] Bug report triage daily

---

### CATEGORY 9 — POST-LAUNCH ROADMAP

#### Wave 1 (Launch — Feb 2027)
Priority: Stability + retention
- Bug fixes from launch feedback
- Black Market (item listings)
- Gangster Shop (NPC)
- Basic profile pages
- Player search

#### Wave 2 (Feb — Apr 2027)
Priority: Social features
- Gangs (create, join, gang page)
- Back Alley (player shops)
- Forum (basic)
- Newspaper (player-written)
- Messaging system

#### Wave 3 (Apr — Jul 2027)
Priority: Depth
- Gang Wars
- Gym (stat training)
- Properties
- Missions
- Casino
- Travel system

#### Wave 4 (Jul — Dec 2027)
Priority: Economy
- Company system
- Advanced market features
- Auction house
- Seasonal events
- Leaderboards

---

## MILESTONE DATES

| Milestone | Date | Status |
|-----------|------|--------|
| Backend builds clean | ASAP | In Progress |
| Migrations run | ASAP | In Progress |
| Core game loop works locally | Aug 2026 | Pending |
| Frontend connected to backend | Sep 2026 | Pending |
| All launch pages done | Oct 2026 | Pending |
| Load testing complete | Nov 2026 | Pending |
| Security audit complete | Nov 2026 | Pending |
| Staging environment live | Dec 1, 2026 | Pending |
| Beta testing (invite only) | Dec 15, 2026 | Pending |
| Launch | Jan 1, 2027 | TARGET |

---

## SOLO DEV SURVIVAL GUIDE

You are one person. Here is how you don't burn out:

### Build order (strictly follow this)
1. Backend compiles and tests pass
2. Migrations run on fresh DB
3. Core game loop works (auth → crimes → regen)
4. Frontend connected to backend (crimes work end to end)
5. Payments working (Black Card + Contributor)
6. All launch pages done
7. Legal pages live
8. Load test
9. Security audit
10. Launch

### Do NOT build until launch
- Gang Wars
- Casino
- Travel
- Properties
- Company
- Forum
- Newspaper
- Back Alley
- Gangster Shop (stub only)
- Black Market (stub only)

### What kills solo dev projects
- Building features players haven't asked for
- Perfecting things nobody sees
- Adding complexity before stability
- No monitoring (you find out from players not logs)
- No backups (one DB failure = game over)
- Skipping legal (one GDPR complaint = game over)

### Weekly routine (once in active dev)
- Mon-Fri: Code
- Saturday: Test + fix bugs
- Sunday: Plan next week + read player feedback

### Emergency contacts
- Hetzner support: fast, good, 24/7
- Cloudflare status: cloudflarestatus.com
- Firebase status: status.firebase.google.com
- Stripe support: dashboard → help
- Sentry: will tell you what broke before players do

---

## COST PROJECTION

### Monthly costs at launch
| Item | Cost |
|------|------|
| Hetzner CX32 | €15 |
| Domain (annual) | ~€1.25/mo |
| Backups | €2 |
| Resend (if > 3k emails) | $0-20 |
| Sentry (if > 5k errors) | $0-26 |
| **Total** | **~€20-65** |

### Break-even calculation
| Revenue source | Amount needed |
|----------------|---------------|
| Contributor subs to cover server | 3-4 subscribers at $7.99 |
| Black Cards to cover server | 5-8 cards at $4.99 |

You break even with fewer than 10 paying players.
At 10,000 players, even 1% conversion = 100 paying players = ~$400-800/mo revenue.

---

*Last updated: 2026*
*Solo dev: YOU*
*Launch target: January 1, 2027*
*Domain: undercity.online*
