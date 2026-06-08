// ============================================================
// TIER CONFIGURATION — UNIT TESTS
// Tests for all exported functions in config/tiers.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  TIER_CONFIG,
  getTierConfig,
  isValidTier,
  getNerveRegenMs,
  isTierExpired,
  calcCitizenPackExpiry,
} from '../config/tiers';
import type { UserTier } from '../config/tiers';

// ============================================================
// TIER_CONFIG — constant validation
// ============================================================

describe('TIER_CONFIG', () => {

  it('has exactly 3 tiers: player, citizen, contributor', () => {
    const tiers = Object.keys(TIER_CONFIG);
    expect(tiers).toEqual(['player', 'citizen', 'contributor']);
    expect(tiers.length).toBe(3);
  });

  it('player tier has correct defaults', () => {
    const cfg = TIER_CONFIG.player;
    expect(cfg.label).toBe('Player');
    expect(cfg.nerveRegenSec).toBe(300);
    expect(cfg.nerveStart).toBe(30);
    expect(cfg.nerveMaxCap).toBe(130);
    expect(cfg.energyRegenSec).toBe(300);
    expect(cfg.citizenPackDays).toBe(0);
  });

  it('citizen tier has correct defaults', () => {
    const cfg = TIER_CONFIG.citizen;
    expect(cfg.label).toBe('Citizen');
    expect(cfg.nerveRegenSec).toBe(300); // same as player
    expect(cfg.nerveStart).toBe(30);
    expect(cfg.nerveMaxCap).toBe(130);
    expect(cfg.energyRegenSec).toBe(240); // faster than player
    expect(cfg.citizenPackDays).toBe(31);
  });

  it('contributor tier has correct defaults', () => {
    const cfg = TIER_CONFIG.contributor;
    expect(cfg.label).toBe('Contributor');
    expect(cfg.nerveRegenSec).toBe(180); // fastest
    expect(cfg.nerveStart).toBe(30);
    expect(cfg.nerveMaxCap).toBe(130);
    expect(cfg.energyRegenSec).toBe(240);
    expect(cfg.citizenPackDays).toBe(0);
  });

  it('contributor has faster nerve regen than player', () => {
    expect(TIER_CONFIG.contributor.nerveRegenSec).toBeLessThan(
      TIER_CONFIG.player.nerveRegenSec
    );
  });

  it('all tiers share same nerve cap (130)', () => {
    expect(TIER_CONFIG.player.nerveMaxCap).toBe(130);
    expect(TIER_CONFIG.citizen.nerveMaxCap).toBe(130);
    expect(TIER_CONFIG.contributor.nerveMaxCap).toBe(130);
  });

  it('all tiers share same nerve start (30)', () => {
    expect(TIER_CONFIG.player.nerveStart).toBe(30);
    expect(TIER_CONFIG.citizen.nerveStart).toBe(30);
    expect(TIER_CONFIG.contributor.nerveStart).toBe(30);
  });

  it('citizen and contributor have faster energy regen than player', () => {
    expect(TIER_CONFIG.citizen.energyRegenSec).toBeLessThan(
      TIER_CONFIG.player.energyRegenSec
    );
    expect(TIER_CONFIG.contributor.energyRegenSec).toBeLessThan(
      TIER_CONFIG.player.energyRegenSec
    );
  });
});

// ============================================================
// getTierConfig
// ============================================================

describe('getTierConfig', () => {

  it('returns player config for "player"', () => {
    const cfg = getTierConfig('player');
    expect(cfg.label).toBe('Player');
    expect(cfg.nerveRegenSec).toBe(300);
  });

  it('returns citizen config for "citizen"', () => {
    const cfg = getTierConfig('citizen');
    expect(cfg.label).toBe('Citizen');
    expect(cfg.citizenPackDays).toBe(31);
  });

  it('returns contributor config for "contributor"', () => {
    const cfg = getTierConfig('contributor');
    expect(cfg.label).toBe('Contributor');
    expect(cfg.nerveRegenSec).toBe(180);
  });

  it('falls back to player config for unknown tier', () => {
    const cfg = getTierConfig('unknown_tier' as UserTier);
    expect(cfg.label).toBe('Player');
    expect(cfg.nerveRegenSec).toBe(300);
  });
});

// ============================================================
// isValidTier
// ============================================================

describe('isValidTier', () => {

  it('returns true for "player"', () => {
    expect(isValidTier('player')).toBe(true);
  });

  it('returns true for "citizen"', () => {
    expect(isValidTier('citizen')).toBe(true);
  });

  it('returns true for "contributor"', () => {
    expect(isValidTier('contributor')).toBe(true);
  });

  it('returns false for "admin"', () => {
    expect(isValidTier('admin')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidTier('')).toBe(false);
  });

  it('returns false for "Player" (case sensitive)', () => {
    expect(isValidTier('Player')).toBe(false);
  });

  it('returns false for number coerced to string', () => {
    expect(isValidTier('1')).toBe(false);
  });
});

// ============================================================
// getNerveRegenMs
// ============================================================

describe('getNerveRegenMs', () => {

  it('returns 300000ms (5 min) for player', () => {
    expect(getNerveRegenMs('player')).toBe(300_000);
  });

  it('returns 300000ms (5 min) for citizen', () => {
    expect(getNerveRegenMs('citizen')).toBe(300_000);
  });

  it('returns 180000ms (3 min) for contributor', () => {
    expect(getNerveRegenMs('contributor')).toBe(180_000);
  });

  it('contributor is faster than player in milliseconds', () => {
    expect(getNerveRegenMs('contributor')).toBeLessThan(
      getNerveRegenMs('player')
    );
  });
});

// ============================================================
// isTierExpired
// ============================================================

describe('isTierExpired', () => {

  it('player tier never expires (always returns false)', () => {
    expect(isTierExpired('player', null)).toBe(false);
    expect(isTierExpired('player', new Date())).toBe(false);
    expect(isTierExpired('player', new Date(Date.now() - 86400000))).toBe(false);
  });

  it('returns false when expiresAt is null (permanent grant)', () => {
    expect(isTierExpired('citizen', null)).toBe(false);
    expect(isTierExpired('contributor', null)).toBe(false);
  });

  it('returns false when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 86400000); // +1 day
    expect(isTierExpired('citizen', future)).toBe(false);
    expect(isTierExpired('contributor', future)).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 86400000); // -1 day
    expect(isTierExpired('citizen', past)).toBe(true);
    expect(isTierExpired('contributor', past)).toBe(true);
  });

  it('returns true when expiresAt is exactly now', () => {
    const now = new Date();
    expect(isTierExpired('citizen', now)).toBe(true);
  });

  it('accepts string date format', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isTierExpired('citizen', past)).toBe(true);

    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isTierExpired('citizen', future)).toBe(false);
  });
});

// ============================================================
// calcCitizenPackExpiry
// ============================================================

describe('calcCitizenPackExpiry', () => {

  it('returns a Date object', () => {
    const expiry = calcCitizenPackExpiry();
    expect(expiry).toBeInstanceOf(Date);
  });

  it('returns a date approximately 31 days from now', () => {
    const before = Date.now();
    const expiry = calcCitizenPackExpiry();
    const after  = Date.now();

    const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + thirtyOneDaysMs - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + thirtyOneDaysMs + 1000);
  });

  it('expiry is in the future', () => {
    const expiry = calcCitizenPackExpiry();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('citizen pack duration matches TIER_CONFIG', () => {
    const days = TIER_CONFIG.citizen.citizenPackDays;
    expect(days).toBe(31);
  });
});
