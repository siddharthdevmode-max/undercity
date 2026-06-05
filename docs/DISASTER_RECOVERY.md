# 🚨 Undercity Disaster Recovery Playbook

## RTO / RPO Targets

| Metric | Target | Description |
|--------|--------|-------------|
| RTO    | 1 hour | Max time to restore service after failure |
| RPO    | 24 hours | Max data loss acceptable |

---

## Scenario 1: Backend Server Down

### Symptoms
- /api/health returns non-200
- Discord/Slack alert received
- Players reporting "cannot connect"

### Steps
```bash
# 1. Check server status on Render dashboard
# 2. Check logs
render logs --service undercity-backend --tail 100

# 3. If crash loop — check recent deploy
# Rollback to previous Docker image:
render deploy --service undercity-backend --image challenger69/undercity-backend:PREVIOUS_SHA

# 4. Verify recovery
curl https://api.undercity.app/api/health
curl https://api.undercity.app/api/health/detailed
