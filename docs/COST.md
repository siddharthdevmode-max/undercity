# 💰 Undercity Cost Optimization Guide

## Current Stack Costs (Estimated)

| Service | Free Tier | Paid Starts | Notes |
|---------|-----------|-------------|-------|
| Cloudflare Pages | Free forever | — | Frontend hosting |
| Cloudflare WAF | Free (limited) | $20/mo | Enable at launch |
| Cloudflare Turnstile | Free forever | — | CAPTCHA |
| Render (Backend) | Free (sleeps) | $7/mo | Use paid at launch |
| Neon PostgreSQL | 0.5GB free | $19/mo | Upgrade at 1k users |
| Upstash Redis | 10k cmd/day free | $10/mo | Upgrade at 1k users |
| Firebase Auth | 10k/month free | Pay-as-go | Very cheap |
| Sentry | 5k errors/mo free | $26/mo | Upgrade if needed |
| Resend Email | 3k/month free | $20/mo | Upgrade at launch |
| Stripe | No monthly fee | 2.9% + 30¢/txn | Per transaction |

## Total Before Revenue

| Phase | Monthly Cost |
|-------|-------------|
| Development | $0 |
| Soft Launch (<100 users) | $0-7 |
| Launch (100-1000 users) | $30-80 |
| Growth (1000+ users) | $100-300 |

## Cost Reduction Tips

1. **Frontend**: Cloudflare Pages = free forever — no optimization needed
2. **Database**: Use connection pooling (PgBouncer) before scaling DB instance
3. **Redis**: Set maxmemory + eviction policy (already done in docker-compose)
4. **Backups**: Store on Cloudflare R2 ($0.015/GB) instead of Render volume
5. **Logs**: Use Loki (self-hosted on same VPS) instead of Datadog
6. **Email**: Batch non-urgent emails, only send transactional ones immediately

## Scaling Triggers

Scale when:
- DB CPU > 70% sustained for 30 min
- Redis memory > 80% of limit
- Backend P95 response > 500ms
- Render instance memory > 400MB sustained
