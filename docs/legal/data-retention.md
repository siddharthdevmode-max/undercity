# Data Retention Policy

**Last Updated:** June 2025

## 1. Overview

This policy explains how long we keep different types of data
and why we keep it for those periods.

## 2. Retention Schedule

### 2.1 Account Data

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Username | Until deletion + 30 days | Account identification |
| Email address | Until deletion + 30 days | Account identification |
| Password | Never stored (Firebase Auth) | N/A |
| Account creation date | Until deletion + 30 days | Record keeping |
| Profile data | Until deletion + 30 days | Game functionality |

### 2.2 Game Data

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Game progress | Until deletion | Core game function |
| Crime history | Until deletion | Game mechanics |
| Virtual currency balance | Until deletion | Game mechanics |
| Achievements | Until deletion | Game mechanics |

### 2.3 Security Data

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| IP addresses | 90 days | Security, abuse prevention |
| Device fingerprints | 90 days | Anti-cheat |
| Login history | 90 days | Security monitoring |
| Anti-cheat violations | 1 year | Fraud prevention |
| Ban records | 3 years | Fraud prevention, legal |

### 2.4 Technical Data

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Server logs | 30 days | Debugging, security |
| Error logs | 30 days | Debugging |
| Slow query logs | 7 days | Performance monitoring |
| Backup files | 30 days | Disaster recovery |

### 2.5 Legal & Compliance Data

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Consent records | 3 years | Legal compliance |
| DMCA correspondence | 3 years | Legal compliance |
| Grievance records | 3 years | Legal compliance (India) |

## 3. Account Deletion

When you delete your account:
- **Immediate:** Account deactivated, login disabled
- **Within 30 days:** Personal data deleted from active systems
- **Retained:** Security data per schedule above (fraud prevention)
- **Retained:** Anonymised aggregated statistics (no personal link)

## 4. Soft Delete

Deleted accounts are "soft deleted" first:
- Data marked as deleted but not immediately purged
- Allows recovery within 30 days if deletion was accidental
- After 30 days: permanent deletion begins

## 5. Legal Hold

In cases of active legal proceedings, investigation, or regulatory
requirement, we may retain data beyond normal periods.
Users will be notified where legally permitted.

## 6. Backup Retention

Database backups are retained for **30 days**.
Backup data follows the same deletion schedule as live data.

## 7. Your Rights

You may request:
- Confirmation of what data we hold
- Early deletion of your data (subject to legal holds)
- Data export before deletion

Contact: katanas.reaper@gmail.com

## 8. Changes to This Policy

We will notify users of significant changes to retention periods
via in-game notification and email.
