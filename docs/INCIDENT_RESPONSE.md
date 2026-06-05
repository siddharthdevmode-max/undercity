# 🚨 Undercity Incident Response Playbook

## Severity Levels

| Level | Name     | Description                          | Response Time |
|-------|----------|--------------------------------------|---------------|
| P0    | Critical | Full outage, data breach, RCE        | Immediate     |
| P1    | High     | Major feature down, auth broken      | 15 minutes    |
| P2    | Medium   | Degraded performance, partial outage | 1 hour        |
| P3    | Low      | Minor bug, cosmetic issue            | Next business day |

---

## P0 — Critical Incident Procedure

### 1. Detect
- Discord/Slack alert fires
- Sentry error spike
- Players reporting on social

### 2. Triage (first 5 minutes)
```bash
# Check health
curl https://api.undercity.app/api/health/detailed

# Check logs
pm2 logs undercity-backend --lines 200

# Check DB
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE updated_at > NOW() - INTERVAL '5 minutes'"
