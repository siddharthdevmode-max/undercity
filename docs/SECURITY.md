# 🔒 Undercity Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅ Yes    |
| Older   | ❌ No     |

## Reporting a Vulnerability

**Please DO NOT report security vulnerabilities via public GitHub issues.**

### How to Report

Email: **katanas.reaper@gmail.com**

Subject line: `[SECURITY] Brief description`

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (optional)
- Your contact details (for follow-up)

### Response Timeline

| Stage | Time |
|-------|------|
| Acknowledgement | Within 48 hours |
| Initial Assessment | Within 7 days |
| Fix Development | Within 30 days |
| Public Disclosure | After fix is deployed |

### Safe Harbour

We will not take legal action against researchers who:
- Report vulnerabilities responsibly
- Do not access or modify other users data
- Do not disrupt our services
- Give us reasonable time to fix before public disclosure

## Security Measures in Place

### Authentication
- Firebase Authentication with server-side token verification
- Session revocation on ban (tokens invalidated immediately)
- Brute force protection (10 failed attempts → 1 hour lockout)
- New IP login detection and logging
- Request ID tracking on all requests

### Anti-Cheat System (UAC 2.0)
- Timing behavior analysis (bot detection)
- Earnings velocity anomaly detection
- Active hours monitoring (inhuman activity detection)
- Success rate spike detection
- Device fingerprinting (dual-hash: legacy + enhanced)
- Multi-account detection via shared fingerprints
- VPN / Proxy / Tor exit node detection
- Shadow punishment system (silent nerfs for cheaters)
- Trust score system with tiered responses
- Admin immunity system for developers

### API Security
- Helmet.js security headers
- Content Security Policy (CSP) with per-request nonces
- HTTP Strict Transport Security (HSTS) in production
- Permissions-Policy header (blocks camera, mic, payment, etc.)
- Redis-backed rate limiting (per-user and per-IP)
- Global fallback rate limiter (200 req/min)
- IP blacklisting (manual + automatic on ban)
- Cloudflare Turnstile CAPTCHA on sensitive actions
- Challenge verification system
- Idempotency keys (prevents replay attacks)
- CORS strict origin whitelist
- Input sanitization on all endpoints (XSS prevention)
- Parameterized SQL queries (SQL injection prevention)
- Request body size limit (100kb)
- Honeypot routes (traps scanners and bots)

### Infrastructure
- Environment variables for all secrets (never hardcoded)
- Firebase service account via env var (never committed)
- Docker with separate dev/prod configurations
- Automated database backups
- Graceful shutdown handling
- Slow query logging

### Data Protection
- Passwords never stored (Firebase Auth handles all auth)
- Sensitive files in .gitignore (verified)
- Database credentials via environment variables only

## Vulnerability Disclosure Hall of Fame

*No vulnerabilities reported yet. Be the first!*

## Contact

- **Security Reports**: katanas.reaper@gmail.com
- **General Support**: katanas.reaper@gmail.com
- **Grievance Officer (India IT Rules 2021)**: katanas.reaper@gmail.com

> Note: Dedicated security@ and grievance@ emails will be set up
> before public launch. For now all contact goes to the above address.
