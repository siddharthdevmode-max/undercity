# Beta Plan — Undercity

## Schedule
| Week | Dates | Players | Focus |
|------|-------|---------|-------|
| 1 | Nov 2-8 | 50 | Monitor + fix P0 in < 2h |
| 2 | Nov 9-15 | 200 | Upgrade VPS to CX32, daily bug fixes |
| 3 | Nov 16-22 | 500 | Economy balance pass |
| 4 | Nov 23-30 | Close | Fix P1s, final backup, launch prep |

## Success Metrics
| Metric | Target |
|--------|--------|
| Onboarding completion | > 80% |
| First crime | > 70% |
| Day 2 retention | > 40% |
| Day 7 retention | > 20% |
| P0 bugs after day 3 | 0 |
| P1 bugs end of beta | < 5 open |

## Monitoring
- Sentry error tracking (live)
- PostHog analytics (funnels, retention)
- UptimeRobot (5min checks)
- VPS `htop` + `docker stats` (daily)
- DB connection pool (via admin/db-health)

## Bug Triage
- **P0**: Fix immediately (server down, data loss, auth broken)
- **P1**: Fix within 24h (broken feature, wrong data)
- **P2**: Log, fix after beta
- **P3**: Log, deprioritize
