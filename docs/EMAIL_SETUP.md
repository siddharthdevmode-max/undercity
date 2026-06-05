# 📧 Undercity Email Setup Guide

## Provider: Resend (resend.com)

## Step 1 — Sign up at resend.com and add your domain

## Step 2 — Add DNS Records in Cloudflare

SPF record — TXT on undercity.app:
    v=spf1 include:_spf.resend.com -all

DKIM record — TXT (Resend gives exact value in dashboard):
    resend._domainkey.undercity.app  →  value from Resend dashboard

DMARC record — TXT on _dmarc.undercity.app:
    v=DMARC1; p=reject; rua=mailto:dmarc@undercity.app; pct=100; adkim=s; aspf=s

## Step 3 — Verify in Resend Dashboard
Domains → undercity.app → all three records show green check mark

## Step 4 — Test
    curl -X POST https://api.resend.com/emails \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"from":"noreply@undercity.app","to":"your@email.com","subject":"Test","html":"<p>Working</p>"}'

Check deliverability score at https://mail-tester.com — target 10/10

## Step 5 — Set Environment Variables
    RESEND_API_KEY=re_your_key_here
    EMAIL_FROM=noreply@undercity.app

## Email Types in Undercity

| Email            | Trigger                  | Priority |
|------------------|--------------------------|----------|
| Welcome          | New user registration    | Normal   |
| Security Alert   | New IP login detected    | High     |
| Purchase Confirm | Stripe payment completed | Normal   |

## Compliance
All emails include unsubscribe link, clear sender name, no deceptive content.
