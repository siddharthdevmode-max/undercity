# Abuse Testing Scenarios — Phase 13

## Manual Test Checklist

### 1. Rate Limit Bypass
- [ ] Rapid-fire crime requests (>30/min) → 429
- [ ] Rapid auth requests (>10/15min) → 429
- [ ] Concurrent POSTs to same endpoint → idempotency dedup
- [ ] Different IPs from same user → caught by trust engine

### 2. Input Manipulation
- [ ] Negative amounts in deposit/withdraw/transfer
- [ ] Zero amounts
- [ ] Very large numbers (overflow)
- [ ] String injection in amount fields
- [ ] SQL injection in search inputs
- [ ] XSS in profile fields (username, bio)

### 3. Authorization Bypass (IDOR)
- [ ] Change user_id in API requests
- [ ] Access admin routes without admin role
- [ ] Modify another user's listings
- [ ] Withdraw from another user's balance

### 4. Race Conditions
- [ ] Parallel crime attempts (same nerve pool)
- [ ] Parallel bank transfers (double spend)
- [ ] Concurrent market buys on same listing
- [ ] Simultaneous inventory use/drop

### 5. Anti-Cheat
- [ ] VPN/proxy while playing → flagged
- [ ] Multi-account from same browser → fingerprint linked
- [ ] 24/7 uptime pattern → behavior flag
- [ ] Unusual earnings velocity → trust score drop
- [ ] Perfect timing on crimes → suspicious pattern
- [ ] Tampered WebSocket messages → disconnect
- [ ] Modified client-side game values → server rejects

### 6. Session/Token
- [ ] Expired Firebase token → 401
- [ ] Revoked Firebase token → 401
- [ ] No token → 401
- [ ] Tampered challenge token → 403
- [ ] Reused idempotency key → handled

### Expected Behavior
- All abuse returns proper error codes, never crashes
- No data corruption under any scenario
- Trust engine scores degrade gradually, not instantly
- Shadow bans are invisible to the player
- Admin audit log captures all admin actions
