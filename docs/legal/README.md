# Undercity — Legal Documents

This folder contains all binding legal documents for the Undercity service.

## Documents

| File                  | Purpose                                          | Required |
|-----------------------|--------------------------------------------------|----------|
| `global-tos.md`       | Terms of Service (binding contract with users)   | Yes      |
| `global-privacy.md`   | Privacy Policy (data collection, GDPR-ready)     | Yes      |
| `india-addendum.md`   | DPDP Act 2023 compliance addendum for India      | Yes      |
| `community-rules.md`  | Plain-English do's and don'ts (linked from game) | Yes      |

## Versioning Policy

- Each document has a **Version** and **Effective Date** at the top.
- Bump version (`1.0` → `1.1`) for minor wording fixes.
- Bump major version (`1.0` → `2.0`) for material changes that affect user rights.
- On any major version bump, **all users must re-accept** before continuing.
- Always update the `Last Updated` date when committing changes.
- Keep old versions in `docs/legal/archive/` for legal record.

## Acceptance Tracking

The backend stores in the `users` table:
- `tos_version_accepted` — e.g., `"1.0"`
- `tos_accepted_at` — timestamp
- `privacy_version_accepted`
- `privacy_accepted_at`
- `india_addendum_accepted_at` (when applicable)
- `country_at_signup`
- `confirmed_18plus_at`

## Status

Current launch phase: **CLOSED ALPHA** (invite-only, ≤50 users).
All docs apply but may be revised before open beta / public launch.

## Lawyer Review Status

- [ ] Initial draft (AI-generated, this version)
- [ ] Reviewed by a practicing advocate in Indian IT/Cyber law
- [ ] Final approved for public launch

**DO NOT** consider these docs final until the checkboxes above are filled.
