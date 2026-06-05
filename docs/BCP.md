# 🏗️ Undercity Business Continuity Plan

## Key Personnel

| Role | Person | Contact |
|------|--------|---------|
| Developer / Owner | Siddharth | katanas.reaper@gmail.com |
| Backup Contact | TBD | TBD |

## Critical Systems Access

All credentials stored in:
- [ ] Password manager (1Password/Bitwarden) — NOT in email/notes
- [ ] GitHub Secrets for CI/CD
- [ ] Render/hosting dashboard secured with MFA

## If Primary Developer is Unavailable

### Short term (< 7 days)
- Automated backups continue via BullMQ scheduler
- Monitoring alerts fire to Discord/Slack
- No action needed for minor outages — Render auto-restarts

### Long term (> 7 days)
1. Second developer needs access to:
   - GitHub repo (add as collaborator)
   - Render dashboard (add team member)
   - Firebase Console (add owner)
   - Cloudflare account (add member)
   - Stripe dashboard (add team member)
2. Transfer credentials via password manager sharing

## Service Recovery Priority

| Priority | Service | RTO |
|----------|---------|-----|
| 1 | Database (PostgreSQL) | 30 min |
| 2 | Backend API | 30 min |
| 3 | Redis | 1 hour |
| 4 | Frontend (Cloudflare Pages) | Automatic |
| 5 | Email service | 2 hours |

## Backup Verification

Run monthly:
```bash
# Verify latest backup is valid
pg_restore --list /path/to/latest/backup.sql
