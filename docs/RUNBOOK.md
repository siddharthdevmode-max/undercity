# 📖 Undercity Operations Runbook

## Daily Health Check

    curl https://api.undercity.app/api/health/detailed
    docker compose ps
    docker compose logs backend --since 1h | grep -iE "error|fatal|fail"

## Normal Deploy (after git push — CI handles automatically)

## Manual Deploy
    cd /opt/undercity
    git pull origin main
    cd backend && npm run migrate && cd ..
    docker compose build backend
    docker compose up -d --no-deps backend
    sleep 10 && curl https://api.undercity.app/api/health

## Rollback
    git log --oneline -10
    git checkout COMMIT_SHA
    docker compose build backend
    docker compose up -d --no-deps backend

## Admin Operations

View flagged users:
    curl https://api.undercity.app/api/v1/admin/cheaters \
      -H "Authorization: Bearer ADMIN_TOKEN"

Hard ban user:
    curl -X POST https://api.undercity.app/api/v1/admin/hard-ban/FIREBASE_UID \
      -H "Authorization: Bearer ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"reason":"Confirmed botting"}'

Shadow ban user:
    curl -X POST https://api.undercity.app/api/v1/admin/shadow-ban/FIREBASE_UID \
      -H "Authorization: Bearer ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"reason":"Suspicious behavior"}'

Unban user:
    curl -X POST https://api.undercity.app/api/v1/admin/unban/FIREBASE_UID \
      -H "Authorization: Bearer ADMIN_TOKEN"

Blacklist IP:
    curl -X POST https://api.undercity.app/api/v1/admin/ip-blacklist \
      -H "Authorization: Bearer ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"ip":"1.2.3.4","reason":"Bot traffic","days":30}'

Run trust recovery:
    curl -X POST https://api.undercity.app/api/v1/admin/trust-recovery/run \
      -H "Authorization: Bearer ADMIN_TOKEN"

View DB health:
    curl https://api.undercity.app/api/v1/admin/db-health \
      -H "Authorization: Bearer ADMIN_TOKEN"

## Database Operations

Manual backup:
    cd backend && npm run backup

Connect to DB:
    docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

Run migrations:
    cd backend && npm run migrate

Check table sizes:
    docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c \
      "SELECT relname, n_live_tup AS rows, pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

## Redis Operations

Check memory:
    docker compose exec redis redis-cli -a $REDIS_PASSWORD info memory | grep used_memory_human

Remove IP blacklist:
    docker compose exec redis redis-cli -a $REDIS_PASSWORD DEL "blacklist:ip:1.2.3.4"

## Emergency Procedures

Full restart:
    docker compose down && docker compose up -d

DDoS — enable Cloudflare Under Attack Mode:
    Cloudflare Dashboard → undercity.app → Security → Security Level → I'm Under Attack

Rotate all secrets (breach):
    1. Revoke Firebase sessions: Firebase Console → Auth → Users → Revoke refresh tokens
    2. Rotate: DATABASE_URL password, REDIS_PASSWORD, STRIPE_WEBHOOK_SECRET, Firebase key
    3. Update in hosting dashboard
    4. docker compose down && docker compose up -d

## Monitoring

| Tool       | URL                                              | Access        |
|------------|--------------------------------------------------|---------------|
| Health API | https://api.undercity.app/api/health/detailed    | Public        |
| Prometheus | http://localhost:9090                            | Internal only |
| Grafana    | http://localhost:3001                            | Internal only |
| Sentry     | https://sentry.io                                | Login         |

## Log Locations

| Log            | Location                              |
|----------------|---------------------------------------|
| Backend        | docker compose logs backend           |
| Nginx access   | /var/log/nginx/access.log             |
| Nginx errors   | /var/log/nginx/error.log              |
| Slow queries   | slow_queries table in PostgreSQL      |
| Auth access    | auth_access_log table in PostgreSQL   |
| Admin actions  | admin_audit_log table in PostgreSQL   |
| UAC violations | uac_violations table in PostgreSQL    |
