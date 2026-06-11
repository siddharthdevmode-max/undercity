# Launch Checklist — December 15, 2026

## 2 Weeks Before (Dec 1-7)
- [ ] Fix all remaining P1 bugs from beta
- [ ] Final Lighthouse audit (all pages > 80 mobile)
- [ ] Final mobile audit (375px)
- [ ] Final security check: npm audit, env vars, secrets rotated
- [ ] Landing page final polish
- [ ] Legal pages proofread
- [ ] Email templates tested (welcome, password reset, receipt)
- [ ] Maintenance page working
- [ ] Final backup tested (restore from snapshot)
- [ ] PostHog events verified

## 1 Week Before (Dec 8-14)
- [ ] Dec 8-10: Discord soft launch (invite beta testers)
- [ ] Dec 11: Full systems check
  - [ ] VPS: htop, disk space, uptime
  - [ ] Redis: memory, hit rate
  - [ ] PostgreSQL: connections, query performance
  - [ ] Queues: no stuck jobs
  - [ ] Game tick: running on schedule
  - [ ] CI/CD: deploy pipeline works
  - [ ] Backups: snapshot + pg_dump
  - [ ] UptimeRobot: monitoring active
  - [ ] Sentry: errors < 5/day
  - [ ] PostHog: events flowing
- [ ] Dec 12-13: Prepare launch content
  - [ ] Reddit posts (6 subreddits)
  - [ ] Twitter launch thread
  - [ ] ProductHunt listing draft
  - [ ] Email blast to waitlist
- [ ] Dec 14: Final dry run
  - [ ] Fresh account: register → verify → onboard → commit crime
  - [ ] Check all pages load
  - [ ] Verify mobile experience

## Launch Day (Dec 15)
### Sequence
- [ ] 00:00 UTC — Remove beta restrictions
- [ ] 00:01 — ProductHunt goes live
- [ ] 00:05 — Twitter launch thread
- [ ] 00:10 — Email blast to waitlist
- [ ] 00:15 — Reddit posts on 6 subreddits
- [ ] 00:20 — Discord announcement
- [ ] 00:30 — Discord watch party starts

### Day 1 Monitoring
- [ ] Monitor Sentry + VPS every 30 min
- [ ] Check DB connection pool every hour
- [ ] Fix P0 bugs immediately
- [ ] Post milestone updates (500, 1k, 2k players)
- [ ] No feature work — only bug fixes

## Day 1 Targets
| Metric | Target |
|--------|--------|
| Registered | 5,000 |
| ProductHunt ranking | Top 5 |
| Uptime | > 99% |
| P0 bugs | 0 |
