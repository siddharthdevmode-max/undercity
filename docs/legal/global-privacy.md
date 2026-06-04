# Undercity — Privacy Policy

**Version:** 1.0
**Effective Date:** [DATE OF FIRST PUBLIC USE — fill in]
**Last Updated:** [DATE]

---

## 1. Who We Are

This Privacy Policy ("Policy") describes how **Siddharth Kumar**, an individual operator residing in India ("we", "us", "our", or "Undercity"), collects, uses, stores, and protects your personal data when you use the Undercity service at `undercity.online`, `undercity.pages.dev`, and any related platforms (collectively, the "Service").

We are the **Data Controller** under the EU General Data Protection Regulation (GDPR) and the **Data Fiduciary** under India's Digital Personal Data Protection Act, 2023 (DPDP Act) for the personal data we collect from you.

---

## 2. Data We Collect

### 2.1 Data You Provide Directly

- **Email address** (via Firebase Authentication, used for login and account recovery);
- **Username** (chosen by you, publicly visible in the game);
- **In-game content** you create (forum posts, chat, etc.);
- **Communications** you send to us (support emails, bug reports).

### 2.2 Data We Collect Automatically

- **IP address** (used for anti-cheat, abuse prevention, security audit logs, and approximate country detection);
- **User-Agent string** (browser and operating system, used for device fingerprinting and bug diagnostics);
- **Device fingerprint hash** (a non-reversible cryptographic hash combining IP, User-Agent, and a FingerprintJS visitor ID — used solely to detect multiple accounts from the same device);
- **Approximate country** (derived from IP, used for compliance with local laws);
- **Gameplay telemetry** (actions you take, timings, success/failure rates, login/logout events — used for anti-cheat behavioral analysis and game balance);
- **Trust score** (a numerical score based on your behavior, used to enforce our anti-cheat policy).

### 2.3 Data We Do NOT Collect

- We do **NOT** use third-party advertising trackers;
- We do **NOT** sell your data to anyone, ever;
- We do **NOT** collect precise geolocation (GPS), biometrics, financial data, government IDs, health information, or any "special category" personal data;
- We do **NOT** integrate with social media platforms for tracking purposes;
- We do **NOT** scan your private messages outside of automated abuse detection;
- We do **NOT** use AI to profile your personality, beliefs, or political views.

### 2.4 Data from Third Parties

We rely on **Firebase Authentication** (operated by Google LLC) to authenticate you. Firebase may collect additional data per its own privacy policy: <https://firebase.google.com/support/privacy>.

We use **Cloudflare** for content delivery and security. Cloudflare may collect connection metadata per its own privacy policy: <https://www.cloudflare.com/privacypolicy/>.

---

## 3. Why We Collect It (Legal Basis)

| Purpose                                | Data Used                              | Legal Basis (GDPR)     | Legal Basis (DPDP) |
|----------------------------------------|----------------------------------------|------------------------|--------------------|
| Account creation and authentication    | Email, password (via Firebase)         | Contract (Art. 6(1)(b))| Consent + Contract |
| Providing core gameplay                | Gameplay telemetry, username           | Contract               | Consent + Contract |
| Anti-cheat enforcement (UAC system)    | IP, User-Agent, fingerprint, behavior  | Legitimate Interest (Art. 6(1)(f)) — preventing fraud | Legitimate Use |
| Security audit logs                    | IP, User-Agent, action timestamps      | Legal Obligation + Legitimate Interest | Legal Obligation |
| Customer support                       | Email, support messages                | Contract               | Consent + Contract |
| Service improvement (aggregated)       | Anonymized gameplay statistics         | Legitimate Interest    | Legitimate Use     |
| Compliance with law                    | Any of the above as required           | Legal Obligation       | Legal Obligation   |

---

## 4. How We Share Your Data

We share your data only as strictly necessary:

- **Service providers** acting on our behalf under contract:
  - Google LLC (Firebase Authentication, hosting infrastructure if applicable);
  - Cloudflare, Inc. (DNS, CDN, DDoS protection, email routing);
  - Hosting provider as applicable (currently Cloudflare Pages);
- **Law enforcement or regulators** when required by valid legal process under Indian law or applicable international law;
- **Successor entities** if we incorporate a company to operate Undercity (e.g., a future Pvt Ltd) — you will be notified of the transfer.

We do **NOT** share, sell, rent, or trade your personal data with advertisers, data brokers, marketers, or any other commercial third party.

---

## 5. International Data Transfers

Some of our service providers (Firebase / Google, Cloudflare) are based outside India and the EU. When your data is transferred internationally, it is protected by:

- **Standard Contractual Clauses** (SCCs) approved by the European Commission, for EU users;
- **The provider's own certification** (e.g., EU-US Data Privacy Framework where applicable);
- **Adequacy decisions** where they exist.

For users in India, cross-border transfer is permitted under the DPDP Act to countries not blacklisted by the Government of India. **[LAWYER-VERIFY: cross-border transfer blacklist applicable at time of launch]**

---

## 6. How Long We Keep Your Data

| Data Type                              | Retention Period                                        |
|----------------------------------------|---------------------------------------------------------|
| Account data (email, username)         | Until you delete your account, plus 30 days for backups |
| Gameplay data                          | Until account deletion, plus 30 days for backups        |
| Anti-cheat fingerprints                | Up to 2 years after last activity                       |
| Security audit logs                    | Up to 1 year                                            |
| Support correspondence                 | Up to 3 years                                           |
| Data required by law (tax, etc.)       | As required by applicable law                           |

After the retention period, your data is either irreversibly deleted or fully anonymized.

---

## 7. Your Rights

You have the following rights regarding your personal data:

### 7.1 Universal Rights
- **Access** — request a copy of all personal data we hold about you;
- **Correction** — ask us to correct inaccurate or incomplete data;
- **Deletion** ("Right to be Forgotten") — ask us to delete your account and personal data;
- **Restriction** — ask us to temporarily stop processing your data;
- **Objection** — object to processing based on Legitimate Interest;
- **Portability** — receive your data in a machine-readable format (JSON);
- **Withdraw Consent** — where processing is based on consent, you may withdraw it at any time;
- **Lodge a Complaint** — with the supervisory authority in your country (e.g., the Data Protection Board of India, or your local EU Data Protection Authority).

### 7.2 How to Exercise Your Rights

Send an email to **`privacy@undercity.online`** (during alpha: `katanas.reaper@gmail.com`) with:
- The subject line: `Data Request — [TYPE]` (e.g., `Data Request — Deletion`);
- Your registered email address and username;
- A description of your request.

We will respond:
- **Within 30 days** for GDPR requests;
- **Within 7 days** for DPDP Act requests in India;
- We may extend this period by an additional 30 days for complex requests, with notice to you.

There is **no fee** for exercising your rights, unless your request is manifestly unfounded or excessive (in which case we may charge a reasonable administrative fee or refuse).

### 7.3 Self-Service (Coming Soon)

We are building self-service endpoints in the Service:
- `GET /api/auth/me/export` — download your data;
- `DELETE /api/auth/me` — delete your account.

Until these are live, please use the email process above.

---

## 8. Cookies and Local Storage

The Service uses:

- **Strictly necessary cookies / local storage** — for authentication (Firebase ID tokens) and to remember your session. These are required to use the Service and do not require consent.
- **Session storage** — to remember your onboarding progress so a page refresh doesn't restart it. Cleared automatically when you close the browser tab.

We do **NOT** use:
- Third-party analytics cookies;
- Advertising cookies;
- Social media tracking pixels;
- Cross-site tracking.

If we add analytics in the future, we will use privacy-respecting tools (e.g., Plausible or self-hosted Umami) and update this Policy with prior notice.

---

## 9. Security

We protect your data using:

- **HTTPS / TLS encryption** for all data in transit;
- **Hashed passwords** (handled by Firebase Authentication — we never see your raw password);
- **Hashed device fingerprints** (we store cryptographic hashes, not raw IP+UA combinations);
- **Database backups** stored encrypted at rest;
- **Rate limiting** on all API endpoints;
- **Anti-abuse measures** including challenge tokens, behavior analysis, and honeypot endpoints;
- **Access controls** — only authorized administrators can access user data;
- **Audit logging** of administrative actions.

Despite our efforts, no system is 100% secure. In the event of a data breach affecting your personal data:
- We will notify the Data Protection Board of India within 72 hours of becoming aware (DPDP Act requirement);
- We will notify affected EU users without undue delay if there is a high risk to their rights (GDPR Art. 34);
- We will publicly disclose the incident on the Service and via email.

---

## 10. Children's Privacy

The Service is **strictly for users aged 18 and above**. We do not knowingly collect personal data from anyone under 18.

If you are under 18: **please do not use the Service**. Close your account and ask a parent or guardian to contact us at `privacy@undercity.online` if you have already registered.

If we discover that we have collected personal data from a person under 18, we will delete it immediately.

We may use age verification methods (e.g., date of birth at registration, periodic re-confirmation) to enforce this restriction.

---

## 11. Automated Decision-Making

The Service uses automated decision-making in our anti-cheat system ("UAC"), which may:
- Reduce your trust score;
- Apply "shadow penalties" (silently reduce gameplay rewards);
- Temporarily restrict features;
- Recommend permanent ban for severe violations (subject to human review for hard bans where feasible).

You have the right to:
- Request human review of any automated decision affecting your account;
- Contest the decision by emailing `support@undercity.online`;
- Receive a meaningful explanation of the logic involved.

Administrators and developers may be marked immune from automated UAC decisions for testing purposes.

---

## 12. Changes to This Policy

We may update this Policy from time to time. The "Last Updated" date will reflect the most recent revision. For material changes, we will:
- Notify you via email or in-game notification;
- Require you to re-acknowledge the updated Policy before continuing.

---

## 13. Contact and Complaints

For privacy concerns, data requests, or complaints:

- **Privacy Officer:** Siddharth Kumar
- **Privacy Email:** `privacy@undercity.online` (during alpha: `katanas.reaper@gmail.com`)
- **General Support:** `support@undercity.online`
- **Postal Address:** [Available upon written request — see Sec. 13.1 of TOS]

You may also lodge a complaint with:

- **India:** Data Protection Board of India (once operational under the DPDP Act);
- **EU:** Your local Data Protection Authority — list at <https://edpb.europa.eu/about-edpb/about-edpb/members_en\>\;
- **UK:** Information Commissioner's Office (ICO) — <https://ico.org.uk>;
- **California:** California Attorney General's Office.

---

## 14. Jurisdiction-Specific Notices

- **For users in India**, please also read our `india-addendum.md` for specific rights and disclosures under the DPDP Act, 2023.
- **For users in the EU/UK**, you have all the rights described in Sec. 7 above. The relevant Data Protection Authority list is linked in Sec. 13.
- **For users in California, USA**, the California Consumer Privacy Act (CCPA) and CPRA grant you specific rights including the right to know, delete, correct, and opt-out of "sale" (note: we do not sell data).

---

**Operator:** Siddharth Kumar
**Service:** Undercity ("Rise. Rule. Reign.")
**Country of Operation:** India

---

*End of Privacy Policy v1.0*
