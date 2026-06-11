# Phase 17 — Staging + Internal QA Checklist

## Full Game Loop (personal test on live VPS)

### Auth
- [ ] Register new account
- [ ] Verify email
- [ ] Login (email/password)
- [ ] Google SSO login
- [ ] Complete onboarding (5 steps)
- [ ] Forgot password flow
- [ ] Logout → Login again
- [ ] Delete account → Confirm cannot re-register same email

### Core Game
- [ ] View crimes (all tiers)
- [ ] Commit crime (success) → see reward
- [ ] Commit crime (failure) → see penalty
- [ ] Commit crime (crit fail) → get jailed
- [ ] Serve jail time → released automatically
- [ ] Commit crime (special) → see special discovery
- [ ] Nerve depletes → "Low Nerve" disabled
- [ ] Nerve regens over time
- [ ] Check Crime XP progress

### Economy
- [ ] View bank balance
- [ ] Deposit cash → balance updates
- [ ] Withdraw cash → cash increases
- [ ] Transfer to another player → 5% tax applied
- [ ] View transaction history (paginated)
- [ ] Browse Black Market listings
- [ ] Buy item from market
- [ ] List item on market
- [ ] Cancel own listing
- [ ] View inventory (all items)
- [ ] Use item (medical → life restored)
- [ ] Use item (drug → nerve/energy restored)
- [ ] Drop item from inventory

### Social
- [ ] View leaderboard (level, wealth, crimes, honor)
- [ ] View player profile (click username from leaderboard)
- [ ] Verify profile shows correct stats

### Admin
- [ ] View admin dashboard
- [ ] View cheaters list
- [ ] Search for a user
- [ ] View full user profile (violations, trust, fingerprints)
- [ ] Shadow ban a user
- [ ] Hard ban a user
- [ ] Unban a user
- [ ] Run trust recovery
- [ ] View audit log
- [ ] View DB health

### Mobile (375px, 390px, 768px)
- [ ] Navigation works (sidebar slides, bottom tabs)
- [ ] All forms usable (inputs not zoomed)
- [ ] Touch targets ≥ 44px
- [ ] No horizontal scroll
- [ ] Bank tabs scroll horizontally
- [ ] Market grid collapses to single column
- [ ] Inventory grid collapses to single column

### P0 Bugs (fix before beta)
- [ ] No server crashes
- [ ] No data loss
- [ ] No auth bypass
- [ ] No money duplication
- [ ] No infinite loops

### P1 Bugs (fix in first week of beta)
- [ ] No broken pages
- [ ] No incorrect calculations
- [ ] No confusing UI states
