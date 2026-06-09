// ============================================================
// COOKIE CONSENT — UNIT TESTS
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { getCookieConsent, setCookieConsent } from '../../utils/cookieConsent';

describe('cookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getCookieConsent returns null when not set', () => {
    expect(getCookieConsent()).toBeNull();
  });

  it('setCookieConsent stores consent with functional=true analytics=true', () => {
    setCookieConsent(true, true);
    const consent = getCookieConsent();
    expect(consent).not.toBeNull();
    expect(consent!.functional).toBe(true);
    expect(consent!.analytics).toBe(true);
    expect(consent!.decided).toBe(true);
    expect(consent!.essential).toBe(true);
  });

  it('setCookieConsent stores consent with functional=false analytics=false', () => {
    setCookieConsent(false, false);
    const consent = getCookieConsent();
    expect(consent!.functional).toBe(false);
    expect(consent!.analytics).toBe(false);
    expect(consent!.decided).toBe(true);
  });

  it('setCookieConsent stores mixed consent', () => {
    setCookieConsent(true, false);
    const consent = getCookieConsent();
    expect(consent!.functional).toBe(true);
    expect(consent!.analytics).toBe(false);
  });

  it('essential is always true', () => {
    setCookieConsent(false, false);
    const consent = getCookieConsent();
    expect(consent!.essential).toBe(true);
  });

  it('stores a timestamp', () => {
    const before = new Date().toISOString();
    setCookieConsent(true, true);
    const consent = getCookieConsent();
    expect(consent!.timestamp).toBeDefined();
    expect(consent!.timestamp >= before).toBe(true);
  });

  it('getCookieConsent returns null on invalid JSON', () => {
    localStorage.setItem('uc_cookie_consent', 'not-json{{{');
    expect(getCookieConsent()).toBeNull();
  });

  it('consent persists across multiple getCookieConsent calls', () => {
    setCookieConsent(true, true);
    expect(getCookieConsent()).not.toBeNull();
    expect(getCookieConsent()).not.toBeNull();
    expect(getCookieConsent()!.analytics).toBe(true);
  });

  it('overwriting consent replaces previous values', () => {
    setCookieConsent(true, true);
    setCookieConsent(false, false);
    const consent = getCookieConsent();
    expect(consent!.analytics).toBe(false);
    expect(consent!.functional).toBe(false);
  });
});
