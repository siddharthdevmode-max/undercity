// ============================================================
// AGE VERIFICATION — UNIT TESTS
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAgeVerified,
  setAgeVerified,
} from '../../utils/ageVerification';

describe('ageVerification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isAgeVerified returns false when nothing stored', () => {
    expect(isAgeVerified()).toBe(false);
  });

  it('setAgeVerified marks user as verified', () => {
    setAgeVerified();
    expect(isAgeVerified()).toBe(true);
  });

  it('isAgeVerified returns true after setAgeVerified', () => {
    setAgeVerified();
    expect(isAgeVerified()).toBe(true);
    expect(isAgeVerified()).toBe(true); // stable
  });

  it('returns false when localStorage has wrong value', () => {
    localStorage.setItem('uc_age_verified', 'false');
    expect(isAgeVerified()).toBe(false);
  });

  it('returns false when localStorage has empty string', () => {
    localStorage.setItem('uc_age_verified', '');
    expect(isAgeVerified()).toBe(false);
  });

  it('returns true when localStorage has exactly "true"', () => {
    localStorage.setItem('uc_age_verified', 'true');
    expect(isAgeVerified()).toBe(true);
  });

  it('setAgeVerified is idempotent', () => {
    setAgeVerified();
    setAgeVerified();
    expect(isAgeVerified()).toBe(true);
  });
});
