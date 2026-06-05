# 🚨 Undercity Disaster Recovery Playbook

## RTO / RPO Targets

| Metric | Target | Description                          |
|--------|--------|--------------------------------------|
| RTO    | 1 hour | Max time to restore service          |
| RPO    | 1 hour | Max acceptable data loss             |

---

## Scenario 1 — Backend Container Down

Symptoms: /api/health returns non-200, Discord alert fires, players cannot connect

    # Check containers
    docker compose ps

    # Check logs
    docker compose logs backend --tail 100

    # Try restart
    docker compose restart backend
    sleep 15 && curl https://api.undercity.app/api/health

    # If still failing — rebuild
    docker compose build backend
    docker compose up -d --no-deps backend

    # If build failing — rollback
    git log --oneline -10
    git checkout LAST_GOOD_COMMIT
    docker compose build backend
    docker compose up -d --no-deps backend

---

## Scenario 2 — Database Down

Symptoms: Health check shows database error

    # Check postgres
    docker compose ps postgres
    docker compose logs postgres --tail 50

    # Restart
    docker compose restart postgres
    sleep 10 && docker compose restart backend

    # If data corrupted — restore from backup
    ls -lah backend/backups/

    docker compose exec -T postgres psql \
      -U $POSTGRES_USER \
      -d $POSTGRES_DB \
      < backend/backups/undercity-TIMESTAMP.sql

    cd backend && npm run migrate
    docker compose restart backend

---

## Scenario 3 — Redis Down

Symptoms: Rate limiting logs errors, queues pause (no data loss)

    docker compose restart redis
    docker compose exec redis redis-cli -a $REDIS_PASSWORD ping
    docker compose restart backend

---

## Scenario 4 — Full Server Down

Symptoms: Everything unreachable, Cloudflare 522 error

    # SSH to server
    ssh user@your-server-ip

    # Check resources
    df -h && free -m

    # Start everything
    cd /opt/undercity
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    cd backend && npm run migrate && cd ..
    curl https://api.undercity.app/api/health

---

## Scenario 5 — Security Breach

    # 1. Revoke all Firebase sessions
    # Firebase Console → Authentication → Users → Select All → Revoke refresh tokens

    # 2. Rotate ALL secrets in your hosting dashboard:
    #    - DATABASE_URL password
    #    - REDIS_PASSWORD
    #    - STRIPE_WEBHOOK_SECRET
    #    - Firebase service account key
    #    - TURNSTILE_SECRET_KEY

    # 3. Restart with new secrets
    docker compose down && docker compose up -d

    # 4. Audit what happened
    docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB \
      -c "SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 100;"

    # 5. Notify users — GDPR requires within 72 hours
    # Contact: katanas.reaper@gmail.com

---

## Backup Schedule

| Backup Type    | Schedule       | Retention    | Location           |
|----------------|----------------|--------------|--------------------|
| PostgreSQL dump| Daily 02:00 UTC| 7 most recent| /app/backups/      |
| Redis AOF      | Continuous     | Until restart| Docker volume      |

## Emergency Contacts

| Resource    | URL                                      |
|-------------|------------------------------------------|
| Primary dev | katanas.reaper@gmail.com                 |
| Hosting     | https://dashboard.render.com             |
| DNS / CDN   | https://dash.cloudflare.com              |
| Firebase    | https://console.firebase.google.com      |
| Stripe      | https://dashboard.stripe.com             |
| Sentry      | https://sentry.io                        |
