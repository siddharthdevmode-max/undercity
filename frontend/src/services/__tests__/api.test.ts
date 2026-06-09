import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../utils/apiError';

// ── Controlled mocks ─────────────────────────────────────────
let mockCurrentUser: { getIdToken: () => Promise<string> } | null = {
  getIdToken: () => Promise.resolve('mock-firebase-token'),
};

let fingerprintShouldFail = false;

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser }),
}));

vi.mock('../../firebase', () => ({ auth: {} }));

vi.mock('../fingerprint', () => ({
  getVisitorId: () =>
    fingerprintShouldFail
      ? Promise.reject(new Error('blocked'))
      : Promise.resolve('mock-visitor-id'),
}));

Object.defineProperty(globalThis, 'crypto', {
  value:        { randomUUID: () => 'mock-uuid-1234' },
  writable:     true,
  configurable: true,
});

import {
  apiCall,
  publicCall,
  authAPI,
  checkUsernameAvailable,
} from '../api';

// ── Fetch helpers ─────────────────────────────────────────────

function mockFetch(body: unknown, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchSequence(
  responses: Array<{ body: unknown; status?: number; ok?: boolean }>
) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[Math.min(call++, responses.length - 1)]!;
    return Promise.resolve({
      ok:     r.ok     ?? true,
      status: r.status ?? 200,
      json:   vi.fn().mockResolvedValue(r.body),
    });
  });
}

// ── Fixtures ──────────────────────────────────────────────────

const rawUser = {
  id:                   1,
  firebase_uid:         'uid-123',
  username:             'TestPlayer',
  email:                'test@undercity.com',
  level:                1,
  money:                750,
  points:               0,
  nerve:                20,
  max_nerve:            30,
  life:                 100,
  max_life:             100,
  energy:               100,
  max_energy:           100,
  happiness:            50,
  jail_until:           null,
  hospital_until:       null,
  federal_jail_until:   null,
  last_crime_at:        null,
  last_seen_at:         null,
  onboarding_completed: false,
  is_admin:             false,
  is_developer:         false,
  is_moderator:         false,
  user_tier:            'player' as const,
  tier_expires_at:      null,
  created_at:           '2026-06-07T00:00:00.000Z',
};

const expectedUser = {
  id:                  1,
  firebaseUid:         'uid-123',
  username:            'TestPlayer',
  email:               'test@undercity.com',
  level:               1,
  money:               750,
  points:              0,
  nerve:               20,
  maxNerve:            30,
  life:                100,
  maxLife:             100,
  energy:              100,
  maxEnergy:           100,
  happiness:           50,
  jailUntil:           null,
  hospitalUntil:       null,
  federalJailUntil:    null,
  lastCrimeAt:         null,
  lastSeenAt:          null,
  onboardingCompleted: false,
  isAdmin:             false,
  isDeveloper:         false,
  isModerator:         false,
  userTier:            'player',
  tierExpiresAt:       null,
  createdAt:           '2026-06-07T00:00:00.000Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
  fingerprintShouldFail = false;
  mockCurrentUser = {
    getIdToken: () => Promise.resolve('mock-firebase-token'),
  };
});

// ═════════════════════════════════════════════════════════════
describe('apiCall', () => {
  it('throws UNAUTHORIZED when no firebase user', async () => {
    mockCurrentUser = null;
    const err = await apiCall('/auth/me').catch(e => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });

  it('makes GET request with correct auth headers', async () => {
    globalThis.fetch = mockFetch({ data: 'test' });
    const result = await apiCall('/auth/me');

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/me');
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer mock-firebase-token');
    expect(headers['x-fp-visitor']).toBe('mock-visitor-id');
    expect(result).toEqual({ data: 'test' });
  });

  it('adds challenge headers for POST requests', async () => {
    globalThis.fetch = mockFetchSequence([
      { body: { token: 'challenge-token-xyz' } },
      { body: { success: true } },
    ]);

    await apiCall('/crimes/attempt', { method: 'POST', body: JSON.stringify({}) });

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    // FIX: challenge URL now includes /v1/
    expect(calls[0][0]).toContain('/v1/challenge');
    const headers = calls[1][1].headers as Record<string, string>;
    expect(headers['x-uac-challenge']).toBe('challenge-token-xyz');
    expect(headers['x-idempotency-key']).toBe('mock-uuid-1234');
  });

  it('adds challenge headers for PUT requests', async () => {
    globalThis.fetch = mockFetchSequence([
      { body: { token: 'challenge-put' } },
      { body: { updated: true } },
    ]);

    await apiCall('/user/settings', { method: 'PUT', body: JSON.stringify({}) });

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const headers = calls[1][1].headers as Record<string, string>;
    expect(headers['x-uac-challenge']).toBe('challenge-put');
  });

  it('adds challenge headers for DELETE requests', async () => {
    globalThis.fetch = mockFetchSequence([
      { body: { token: 'challenge-del' } },
      { body: { deleted: true } },
    ]);

    await apiCall('/user/account', { method: 'DELETE' });

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toContain('/v1/challenge');
  });

  it('does NOT add challenge headers for GET requests', async () => {
    globalThis.fetch = mockFetch({ data: 'ok' });

    await apiCall('/auth/me', { method: 'GET' });

    expect(fetch).toHaveBeenCalledOnce();
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers  = opts.headers as Record<string, string>;
    expect(headers['x-uac-challenge']).toBeUndefined();
    expect(headers['x-idempotency-key']).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    globalThis.fetch = mockFetch(
      { message: 'Not found', code: 'NOT_FOUND' },
      404,
      false
    );

    const err = await apiCall('/missing').catch(e => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('throws ApiError with fallback on unparseable error body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok:     false,
      status: 500,
      json:   vi.fn().mockRejectedValue(new Error('bad json')),
    });

    const err = await apiCall('/bad').catch(e => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('API request failed');
    expect(err.code).toBe('UNKNOWN_ERROR');
  });

  it('omits x-fp-visitor when fingerprint throws', async () => {
    fingerprintShouldFail = true;
    globalThis.fetch      = mockFetch({ ok: true });

    await apiCall('/auth/me');

    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers  = opts.headers as Record<string, string>;
    expect(headers['x-fp-visitor']).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════
describe('publicCall', () => {
  it('makes request without auth headers', async () => {
    globalThis.fetch = mockFetch({ available: true });

    const result = await publicCall<{ available: boolean }>(
      '/auth/check-username/ghost'
    );

    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/check-username/ghost');
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined();
    expect(result).toEqual({ available: true });
  });

  it('throws ApiError on non-ok response', async () => {
    globalThis.fetch = mockFetch(
      { message: 'Username taken', code: 'TAKEN' },
      409,
      false
    );

    const err = await publicCall('/auth/check-username/taken').catch(e => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Username taken');
    expect(err.code).toBe('TAKEN');
    expect(err.statusCode).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════
describe('authAPI', () => {
  describe('authAPI.me', () => {
    it('transforms raw user from { user: RawUser } wrapper', async () => {
      globalThis.fetch = mockFetch({ user: rawUser });
      const result = await authAPI.me();
      expect(result).toMatchObject(expectedUser);
    });

    it('transforms raw user from flat RawUser response', async () => {
      globalThis.fetch = mockFetch(rawUser);
      const result = await authAPI.me();
      expect(result).toMatchObject(expectedUser);
    });

    it('applies defaults for optional fields', async () => {
      const minimal = {
        ...rawUser,
        energy:               undefined,
        max_energy:           undefined,
        happiness:            undefined,
        hospital_until:       undefined,
        last_seen_at:         undefined,
        onboarding_completed: undefined,
      };
      globalThis.fetch = mockFetch({ user: minimal });
      const result = await authAPI.me();
      expect(result.energy).toBe(100);
      expect(result.maxEnergy).toBe(100);
      expect(result.happiness).toBe(50);
      expect(result.hospitalUntil).toBeNull();
      expect(result.lastSeenAt).toBeNull();
      expect(result.onboardingCompleted).toBe(false);
    });
  });

  describe('authAPI.sync', () => {
    it('sends POST with username and transforms response', async () => {
      globalThis.fetch = mockFetchSequence([
        { body: { token: 'challenge-sync' } },
        { body: { user: rawUser } },
      ]);

      const result = await authAPI.sync('TestPlayer');

      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
      const body  = JSON.parse(calls[1][1].body as string) as Record<string, unknown>;
      expect(body).toEqual({ username: 'TestPlayer' });
      expect(result).toMatchObject(expectedUser);
    });

    it('works without username argument', async () => {
      globalThis.fetch = mockFetchSequence([
        { body: { token: 'challenge-sync' } },
        { body: { user: rawUser } },
      ]);

      const result = await authAPI.sync();
      expect(result).toMatchObject(expectedUser);
    });
  });

  describe('authAPI.completeOnboarding', () => {
    it('sends POST and resolves void', async () => {
      globalThis.fetch = mockFetchSequence([
        { body: { token: 'challenge-onboard' } },
        { body: { success: true } },
      ]);

      const result = await authAPI.completeOnboarding();
      expect(result).toBeUndefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════
describe('checkUsernameAvailable', () => {
  it('returns available: true for free username', async () => {
    globalThis.fetch = mockFetch({ available: true });
    const result = await checkUsernameAvailable('ghost');
    expect(result).toEqual({ available: true });

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('/auth/check-username/ghost');
  });

  it('returns available: false with reason', async () => {
    globalThis.fetch = mockFetch({ available: false, reason: 'Already taken' });
    const result = await checkUsernameAvailable('taken');
    expect(result).toEqual({ available: false, reason: 'Already taken' });
  });

  it('URL-encodes special characters in username', async () => {
    globalThis.fetch = mockFetch({ available: false });
    await checkUsernameAvailable('user name');
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('user%20name');
  });
});

// ═════════════════════════════════════════════════════════════
describe('transformUser field mapping', () => {
  it('maps all snake_case fields to camelCase correctly', async () => {
    globalThis.fetch = mockFetch({ user: rawUser });
    const result = await authAPI.me();

    expect(result.firebaseUid).toBe('uid-123');
    expect(result.maxNerve).toBe(30);
    expect(result.maxLife).toBe(100);
    expect(result.maxEnergy).toBe(100);
    expect(result.jailUntil).toBeNull();
    expect(result.federalJailUntil).toBeNull();
    expect(result.lastCrimeAt).toBeNull();
    expect(result.onboardingCompleted).toBe(false);
    expect(result.isAdmin).toBe(false);
    expect(result.isDeveloper).toBe(false);
    expect(result.isModerator).toBe(false);
    expect(result.userTier).toBe('player');
    expect(result.tierExpiresAt).toBeNull();
  });

  it('handles admin/developer/moderator flags', async () => {
    globalThis.fetch = mockFetch({
      user: { ...rawUser, is_admin: true, is_developer: true, is_moderator: false },
    });
    const result = await authAPI.me();
    expect(result.isAdmin).toBe(true);
    expect(result.isDeveloper).toBe(true);
    expect(result.isModerator).toBe(false);
  });

  it('handles jail timestamp', async () => {
    const jailTime = '2026-12-15T03:00:00.000Z';
    globalThis.fetch = mockFetch({ user: { ...rawUser, jail_until: jailTime } });
    const result = await authAPI.me();
    expect(result.jailUntil).toBe(jailTime);
  });
});
