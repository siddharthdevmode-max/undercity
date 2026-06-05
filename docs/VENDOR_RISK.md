# 🏢 Undercity Vendor Risk Register

| Vendor | Purpose | Risk Level | Exit Plan |
|--------|---------|-----------|-----------|
| Firebase (Google) | Auth, token verification | Medium | Migrate to Auth.js + custom JWT |
| Stripe | Payments | Low | Switch to Paddle or LemonSqueezy |
| Cloudflare | CDN, WAF, Pages, Turnstile | Low | Switch to Fastly + hCaptcha |
| Render | Backend hosting | Medium | Switch to Railway, Fly.io, or VPS |
| Sentry | Error monitoring | Low | Switch to GlitchTip (self-hosted) |
| Resend | Transactional email | Low | Switch to Postmark or SES |
| Redis (Upstash) | Cache, queues | Low | Self-hosted Redis |
| PostgreSQL (Neon/Render) | Database | Medium | Self-hosted on VPS |
| Docker Hub | Container registry | Low | Switch to GHCR |

## Risk Definitions

- **Low**: Easy to replace, no data lock-in, strong alternatives exist
- **Medium**: Moderate migration effort, some data export needed
- **High**: Significant lock-in, expensive to migrate, no easy alternative

## Review Schedule

Review this document quarterly. Update whenever a new vendor is added.

Last reviewed: 2026-01-01
