# Undercity — Country Compliance Roadmap

**Version:** 1.0
**Last Updated:** [DATE]
**Purpose:** A practical, region-by-region plan for legal compliance as Undercity grows from closed alpha to global launch.

> **This document is internal planning, not a legal document.** It tells YOU (the operator) what to do next. Update it as you expand.

---

## Current Status

| Item                         | Status                                   |
|------------------------------|------------------------------------------|
| Launch phase                 | CLOSED ALPHA (≤50 invite-only users)     |
| Operator                     | Siddharth Kumar (individual)             |
| Legal entity                 | None yet (planned within 12 months)      |
| Lawyer review                | Pending (₹3-5k consult planned)          |
| Active legal docs            | TOS v1.0, Privacy v1.0, India Addendum v1.0, Community Rules v1.0 |
| Countries allowed at signup  | All (informal — friends only)            |
| Casino feature               | DISABLED until lawyer-cleared            |
| Data export endpoint         | Not built yet (planned Phase 2)          |
| Data delete endpoint         | Not built yet (planned Phase 2)          |

---

## Region-by-Region Roadmap

For each region: **what law applies**, **what we already cover**, **what's needed before opening signups**, and **estimated cost**.

---

### INDIA (HOME — Phase 1, ACTIVE)

| Field                    | Detail                                                    |
|--------------------------|-----------------------------------------------------------|
| **Primary laws**         | Information Technology Act 2000; DPDP Act 2023            |
| **Already covered by**   | global-tos.md + global-privacy.md + india-addendum.md     |
| **Additional work needed** | Lawyer review (₹3-5k); register as Proprietorship (₹2k); GSTIN if revenue > ₹20L/year |
| **Specific quirks**      | Grievance Officer response: 7 working days; data breach notify: 72h to Data Protection Board |
| **Casino law**           | Varies by state — banned in some (Maharashtra, Telangana, Andhra Pradesh) — geofence per state before enabling |
| **Status**               | Documentation complete; lawyer review pending              |
| **Lawyer cost (est.)**   | ₹3,000-₹5,000 for 1-hour cyber-law consult                |

---

### EUROPEAN UNION + UNITED KINGDOM (Phase 2 — high value, well-defined)

| Field                    | Detail                                                    |
|--------------------------|-----------------------------------------------------------|
| **Primary laws**         | GDPR (EU 2016/679); UK GDPR; ePrivacy Directive (Cookie Law) |
| **Already covered by**   | global-privacy.md (GDPR-shaped throughout)                |
| **Additional work needed** | (1) Cookie consent banner with granular choices (necessary / analytics / marketing); (2) DPA (Data Processing Agreement) with each service provider — Firebase, Cloudflare; (3) Standard Contractual Clauses for non-EU transfers; (4) GDPR-specific data export/delete endpoints; (5) Designate an EU representative if no EU establishment (Art. 27); (6) Public DPO contact (only if large-scale — not yet) |
| **Specific quirks**      | Cookie consent MUST be opt-IN, not opt-out; data subject requests must be honored within 30 days; breach notification to local DPA within 72h |
| **Fine exposure**        | Up to 4% of global revenue OR EUR 20M, whichever is HIGHER |
| **Status**               | Privacy doc written; cookie banner + DPAs pending          |
| **Lawyer cost (est.)**   | EUR 300-600 for review (use a UK or Dublin-based privacy lawyer) |
| **MUST-DO before opening EU signups** | Cookie banner + EU representative + DPA with Firebase signed |

---

### UNITED STATES — Federal + State Patchwork (Phase 3 — complex)

| Field                    | Detail                                                    |
|--------------------------|-----------------------------------------------------------|
| **Federal laws**         | COPPA (under-13 protection); CAN-SPAM (email marketing); DMCA (copyright takedown — already covered in TOS Sec. 7.3) |
| **State laws (privacy)** | California (CCPA + CPRA); Virginia (VCDPA); Colorado (CPA); Connecticut (CTDPA); Utah (UCPA); Texas (TDPSA, 2024); 8+ more coming |
| **Already covered by**   | global-privacy.md mentions CCPA generally                 |
| **Additional work needed** | (1) Add Do Not Sell or Share My Personal Information link (even though you don't sell); (2) State-by-state addendum (separate from EU); (3) CRITICAL: USA online gambling/gaming laws vary per state — Washington and Idaho strictly ban virtual currency that has any path to real value; (4) Children: re-confirm strict 18+ enforcement (COPPA is brutal — $50,650 fine per under-13 user) |
| **Casino law**           | DO NOT enable casino for any US user until US gaming lawyer reviewed. Some states treat virtual currency casinos as illegal gambling regardless of cash-out |
| **Fine exposure**        | CCPA: up to $7,500 per intentional violation; COPPA: $50,650 per child |
| **Status**               | NOT READY for US users beyond invited alpha                |
| **Lawyer cost (est.)**   | $500-$1,500 (USD) for combined federal + state review      |
| **MUST-DO before opening US signups** | Lawyer review + state-specific addendums + verified 18+ gate (DOB at registration, not just checkbox) |

---

### BRAZIL (Phase 4 — large gamer base, single national law)

| Field                    | Detail                                                    |
|--------------------------|-----------------------------------------------------------|
| **Primary law**          | LGPD (Lei Geral de Protecao de Dados — basically Brazilian GDPR) |
| **Already covered by**   | global-privacy.md mostly aligns (GDPR-shaped covers ~80% of LGPD) |
| **Additional work needed** | (1) Brazilian DPO appointment (or local representative); (2) Portuguese-language version of TOS + Privacy (legally recommended); (3) Register with ANPD if processing on large scale |
| **Fine exposure**        | Up to 2% of Brazil revenue, capped at R$50M per violation |
| **Status**               | Mostly aligned but needs PT translation                    |
| **Lawyer cost (est.)**   | R$1,500-R$3,000 for Brazilian privacy lawyer review        |

---

### CANADA (Phase 4 — privacy-strict, similar to GDPR)

| Field                    | Detail                                                    |
|--------------------------|-----------------------------------------------------------|
| **Primary laws**         | PIPEDA (federal); Quebec Law 25 (very strict, GDPR-like); BC PIPA; Alberta PIPA |
| **Already covered by**   | global-privacy.md mostly aligns                            |
| **Additional work needed** | (1) French-language version for Quebec users (legally REQUIRED in Quebec); (2) Quebec-specific privacy officer; (3) Breach notification protocols |
| **Fine exposure**        | Quebec Law 25: up to 4% of global revenue or CAD $25M     |
| **Casino law**           | Provincial — most strict, requires local license           |
| **Lawyer cost (est.)**   | CAD $500-$1,200 for combined federal + Quebec review       |

---

### AUSTRALIA + NEW ZEALAND (Phase 4)

| Field                    | Detail                                                    |
|--------------------------|-----------------------------------------------------------|
| **Primary laws**         | Privacy Act 1988 (AU); Privacy Act 2020 (NZ); Interactive Gambling Act 2001 (AU — STRICT) |
| **Already covered by**   | global-privacy.md mostly aligns                            |
| **Additional work needed** | (1) Australian Privacy Principles (APPs) addendum; (2) IGA compliance review for any chance-based mechanics |
| **Casino law**           | AUSTRALIA BANS most virtual gambling. Casino feature MUST be disabled for AU users until cleared |
| **Fine exposure**        | AU: up to AUD $50M or 30% of adjusted turnover per breach |
| **Lawyer cost (est.)**   | AUD $800-$2,000                                            |

---

### ASIA (excl. India) — Phase 5 (per-country, complex)

| Country      | Key Law / Concern                                                    |
|--------------|----------------------------------------------------------------------|
| Singapore    | PDPA — similar to GDPR; lawyer review per country                    |
| Japan        | APPI; in-game purchases heavily regulated                            |
| South Korea  | PIPA; strict gaming addiction laws; ban virtual gambling              |
| China        | PIPL + Cybersecurity Law + game licensing required from NPPA — DO NOT TARGET CHINA without a Chinese partner entity |
| Hong Kong    | PDPO — moderate                                                      |
| Thailand     | PDPA — newer GDPR-like law                                           |
| Indonesia    | PDP Law 2022 — GDPR-like                                             |
| Philippines  | Data Privacy Act 2012; relatively friendly                           |
| Malaysia     | PDPA 2010; reform pending                                             |
| Vietnam      | Decree 13/2023; strict data-residency rules                          |

**Strategy:** Open one country at a time. ~₹50,000-₹2L lawyer cost per market.

---

### MIDDLE EAST + AFRICA — Phase 5+

| Region          | Note                                                         |
|-----------------|--------------------------------------------------------------|
| Saudi Arabia    | PDPL 2023; BANS gambling completely; consider geofencing     |
| UAE             | Federal Data Protection Law; gambling banned                 |
| South Africa    | POPIA — GDPR-like                                            |
| Nigeria         | NDPR 2019                                                    |
| Kenya           | Data Protection Act 2019                                     |

**Strategy:** Most of MENA is HIGH RISK for crime/gambling-themed games. Block via geofence until legal counsel obtained.

---

### LATIN AMERICA — Phase 5

| Country    | Key Law                                              |
|------------|------------------------------------------------------|
| Mexico     | LFPDPPP                                              |
| Argentina  | PDPL (older, GDPR adequacy granted)                  |
| Chile      | Law 19.628 (reform pending)                          |
| Colombia   | Law 1581                                             |

---

## COUNTRIES TO BLOCK / GEOFENCE (consider from Day 1)

Some regions are HIGH RISK for crime/violence themed online games regardless of compliance work:

| Country/Region                        | Reason                                              |
|---------------------------------------|-----------------------------------------------------|
| China                                 | Government licensing required for any online game   |
| North Korea                           | US/UN sanctions — cannot serve users                |
| Iran                                  | US sanctions; severe content laws                   |
| Syria                                 | US sanctions                                        |
| Cuba                                  | US sanctions                                        |
| Russia + Belarus                      | Sanctions risk; strict data localization laws        |
| Saudi Arabia, UAE, Kuwait, Qatar      | Game theme (crime, gambling references) is illegal/blasphemous |

**Geofence by IP at signup** — block registration but show a polite "not available in your region" message.

---

## GAMBLING-SPECIFIC ROADMAP

| Phase                    | Casino Status                                             |
|--------------------------|-----------------------------------------------------------|
| Phase 1 (now)            | DISABLED entirely — feature flag off                      |
| Phase 2                  | Disabled until 1-hour Indian gaming-law consult           |
| Phase 3+                 | Enable ONLY in countries where: (a) lawyer-cleared, (b) virtual currency is non-cashable AND non-tradeable, (c) 21+ age verification (in some jurisdictions) |
| Countries to NEVER enable | Without specific gaming licenses: Washington (USA), Idaho (USA), Saudi Arabia, UAE, China, South Korea, Australia, Singapore |

---

## PHASE EXPANSION CHECKLIST

When opening a new region, run through this:

- [ ] Identify primary privacy law for the region
- [ ] Lawyer consult done (region-specific!)
- [ ] Privacy Policy addendum written
- [ ] TOS addendum (if needed)
- [ ] Translated to local language(s) if legally required
- [ ] Cookie banner adjusted for region (granularity)
- [ ] Data subject request workflow tested (export + delete)
- [ ] Breach notification authority + procedure documented
- [ ] Cross-border transfer mechanism confirmed (SCCs etc.)
- [ ] Gambling feature status confirmed for the region
- [ ] Age verification method confirmed compliant
- [ ] Children's data prohibition (under-18) enforced
- [ ] In-game currency cashability confirmed compliant
- [ ] DMCA/copyright takedown contact local (if needed)
- [ ] Tax / VAT registration (if monetizing in region)
- [ ] Local payment processor compliance (if monetizing)
- [ ] Update this roadmap with new entry
- [ ] Open signups (ramp slowly — start with 100 users to monitor)

---

## ESTIMATED LAWYER BUDGET BY PHASE

| Phase                          | Region                  | Cost (approx.)                     |
|--------------------------------|-------------------------|------------------------------------|
| Phase 1 review (India alpha)   | India                   | ₹3,000-₹5,000                      |
| Phase 2 (EU/UK + India full)   | UK or Dublin lawyer     | ₹35,000-₹70,000 (EUR 400-800)      |
| Phase 3 (USA)                  | US gaming + privacy     | ₹50,000-₹1,50,000 ($600-$1,800)    |
| Phase 4 (BR + CA + AU)         | Per-country specialists | ₹1,00,000-₹2,50,000 combined       |
| Phase 5 (Asia per country)     | Per-country specialists | ₹50,000-₹2,00,000 each             |
| **Ongoing retainer**           | After Phase 4           | ₹20,000-₹50,000/month              |

**Total to open globally (~30 major countries):** ₹6L - ₹15L over 18-24 months.

**Reality check:** Most indie games never need full global compliance because 90% of users come from 5-10 countries. Focus on those.

---

## EMERGENCY: WHAT TO DO IF SUED OR DMCAd

Before that happens, set up:

1. **Cyber Liability Insurance** (~₹15-30k/year in India once registered)
2. **A relationship with a cyber-law lawyer** — not just consults
3. **Document retention policy** (keep evidence of compliance)
4. **Incident response plan** — written, in this folder

When it happens:

1. **Do NOT respond publicly** to the complaining party
2. **Save all communications** (emails, screenshots)
3. **Contact your lawyer immediately** (within 24-48 hours)
4. **Do NOT delete data** that might be evidence
5. **Do NOT pay any demand** without lawyer review

---

## HOW TO USE THIS DOC

- Update the Current Status table at the top whenever something changes
- Before opening a new country, complete the checklist for that region
- Before any monetization, add tax/payment compliance per region
- Review this doc every 6 months — privacy laws change FAST
- Mark [DONE — date] next to completed items

---

**Maintainer:** Siddharth Kumar
**Last full review:** [DATE]
**Next scheduled review:** [DATE + 6 months]
