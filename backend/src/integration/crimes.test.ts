// ============================================================
// CRIMES ROUTES — INTEGRATION TESTS
// ============================================================

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const poolQuery     = vi.fn();
  const clientQuery   = vi.fn();
  const redisGet      = vi.fn().mockResolvedValue(null);
  const redisSet      = vi.fn().mockResolvedValue('OK');
  const redisDel      = vi.fn().mockResolvedValue(1);
  const redisScan     = vi.fn().mockResolvedValue(['0', []]);

  const mockClient = { query: clientQuery, release: vi.fn() };

  const pipeline = {
    set:    vi.fn().mockReturnThis(),
    incr:   vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec:   vi.fn().mockResolvedValue([['OK'], [1], [1]]),
  };

  const mockRedis = {
    get:      redisGet,
    set:      redisSet,
    del:      redisDel,
    scan:     redisScan,
    exists:   vi.fn().mockResolvedValue(0),
    pipeline: vi.fn().mockReturnValue(pipeline),
    call:     vi.fn().mockResolvedValue(0),
    on:       vi.fn(),
    status:   'ready',
  };

  // pool.connect() always returns our mockClient
  const mockConnect = vi.fn().mockResolvedValue(mockClient);

  const mockPool = {
    query:        poolQuery,
    connect:      mockConnect,
    totalCount:   1,
    idleCount:    1,
    waitingCount: 0,
    on:           vi.fn(),
  };

  const mockSentry = {
    init: vi.fn(), captureException: vi.fn(),
    setupExpressErrorHandler: vi.fn().mockReturnValue(
      (_e: unknown, _r: unknown, _s: unknown, n: () => void) => n()
    ),
  };

  const mockIO = {
    to: vi.fn().mockReturnThis(), emit: vi.fn(),
    sockets: { sockets: { size: 0 } }, on: vi.fn(),
  };

  return {
    verifyIdToken, poolQuery, clientQuery, mockConnect,
    redisGet, redisSet, redisDel, redisScan,
    mockRedis, mockPool, mockClient, mockSentry, mockIO,
  };
});

vi.mock('../config/firebase', () => ({
  authAdmin: { verifyIdToken: mocks.verifyIdToken, revokeRefreshTokens: vi.fn() },
  firebaseApp: null,
}));
vi.mock('../config/redis', () => ({
  default: mocks.mockRedis, redis: mocks.mockRedis,
  connectRedis: vi.fn(), testRedisConnection: vi.fn().mockResolvedValue(true),
  getRedisInfo: vi.fn().mockResolvedValue({}),
}));
vi.mock('../config/database', () => ({
  pool:            mocks.mockPool,
  getPoolStats:    vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
  // withTransaction passes our mockClient to the callback
  withTransaction: vi.fn().mockImplementation(
    async (fn: (c: unknown) => Promise<unknown>) => fn(mocks.mockClient)
  ),
}));
vi.mock('../config/sentry',  () => ({ initSentry: vi.fn(), Sentry: mocks.mockSentry }));
vi.mock('../config/socket',  () => ({
  initSocket: vi.fn().mockReturnValue(mocks.mockIO),
  getIO:      vi.fn().mockReturnValue(mocks.mockIO),
  SocketNotify: {
    statUpdate: vi.fn(), crimeResult: vi.fn(),
    onlineCount: vi.fn(), toUser: vi.fn(),
  },
  closeSocket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../queues/index', () => ({
  queueEmail: vi.fn(), emailQueue: { add: vi.fn() },
  trustRecoveryQueue:      { add: vi.fn() },
  backupQueue:             { add: vi.fn() },
  idempotencyCleanupQueue: { add: vi.fn() },
  gameTickQueue:           { add: vi.fn() },
  paymentWebhookQueue:     { add: vi.fn() },
  closeQueues:             vi.fn(),
  bullmqConnection:        {},
}));
vi.mock('../utils/alerts', () => ({
  sendAlert: vi.fn(), stopAlertQueue: vi.fn(),
  Alerts: {
    serverStarted: vi.fn(), suspiciousLogin: vi.fn(), systemError: vi.fn(),
  },
}));
vi.mock('../services/gameTick', () => ({
  startGameTick: vi.fn(), stopGameTick: vi.fn(),
  getTickInfo:   vi.fn().mockResolvedValue({ isRunning: false }),
}));
vi.mock('../services/fingerprintEngine', () => ({
  recordFingerprint: vi.fn().mockResolvedValue(undefined),
  checkMultiAccount: vi.fn().mockResolvedValue({
    otherAccountsCount: 0, otherUids: [], isSuspicious: false,
  }),
}));
vi.mock('../services/behaviorEngine', () => ({
  analyzeBehavior:  vi.fn().mockResolvedValue(undefined),
  analyzePostCrime: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/trustEngine', () => ({
  flagUser:     vi.fn().mockResolvedValue({ skipped: true }),
  getTrustInfo: vi.fn().mockResolvedValue({
    trustScore: 100, tier: 'CLEAN', isShadowBanned: false, isHardBanned: false,
  }),
  getTrustTier: vi.fn().mockReturnValue('CLEAN'),
}));
vi.mock('../services/immunityCheck', () => ({
  isImmuneFromUAC:         vi.fn().mockResolvedValue(false),
  invalidateImmunityCache: vi.fn().mockResolvedValue(undefined),
}));

let request: typeof import('supertest').default;
let app: Express;

beforeAll(async () => {
  const supertest = await import('supertest');
  const appModule = await import('../app');
  request = supertest.default;
  app     = appModule.default;
});

// ── Data factories ────────────────────────────────────────

function makeToken() {
  return {
    uid: 'test-uid-123', email: 'test@test.com', email_verified: true,
    name: 'Test', aud: 'test', auth_time: 0, exp: 9999999999,
    firebase: { identities: {}, sign_in_provider: 'password' },
    iat: 0, iss: 'test', sub: 'test-uid-123',
  };
}

function makeUser(overrides = {}) {
  return {
    id: 1, firebase_uid: 'test-uid-123', email: 'test@test.com',
    username: 'testplayer', level: 1, money: 750, points: 0,
    nerve: 30, max_nerve: 30, life: 100, max_life: 100,
    energy: 100, max_energy: 100, happiness: 50,
    jail_until: null, hospital_until: null, federal_jail_until: null,
    last_crime_at: null, last_seen_at: new Date().toISOString(),
    is_shadow_banned: false, is_hard_banned: false,
    is_admin: false, is_developer: false, trust_score: 100, total_flags: 0,
    user_tier: 'player', tier_expires_at: null, last_nerve_update: null,
    created_at: new Date().toISOString(), ...overrides,
  };
}

function makeCrime(overrides = {}) {
  return {
    id: 1, crime_key: 'pickpocket', name: 'Pickpocket',
    tier: 1, unlock_level: 1, nerve_cost: 2,
    min_reward: 100, max_reward: 500,
    jail_min_seconds: 60, jail_max_seconds: 300,
    is_federal: false, is_active: true, ...overrides,
  };
}

function makeProgress(overrides = {}) {
  return {
    id: 1, user_id: 1, crime_id: 1, crime_xp: 0, crime_level: 0,
    hidden_cpl: 0, attempts: 0, successes: 0, failures: 0,
    crit_failures: 0, specials_found_count: 0, ...overrides,
  };
}

// ── Redis setup for crime attempt ─────────────────────────
//
// The challenge token key is `challenge:{uid}:{token}`.
// We use mockImplementation so it returns '1' only for that key.
// All other keys return null (not blocked, not cached).
//
const VALID_TOKEN = 'a'.repeat(64);

function setupRedisForCrimeAttempt() {
  mocks.redisGet.mockImplementation((key: string) => {
    if (key === `challenge:test-uid-123:${VALID_TOKEN}`) {
      return Promise.resolve('1');
    }
    return Promise.resolve(null);
  });
}

// ── DB setup for full crime flow ──────────────────────────
//
// The crimeController calls pool.connect() to get a client,
// then runs all queries through that client.
// We need clientQuery to return the right data in order.
//
// Query order inside attemptCrime transaction:
//   1. BEGIN                   (client.query string — no return value needed)
//   2. getUserByFirebaseUid    → user row
//   3. loadCrime               → crime row
//   4. INSERT user_crime_progress (upsert) → empty
//   5. SELECT user_crime_progress → progress row
//   6. pickAvailableSpecial    → empty (no specials)
//   7. getTotalCrimeXp         → { total_xp: 0 }
//   8. updateProgress          → empty
//   9. updateUserStats         → empty
//  10. COMMIT                  (no return value needed)
//
// NOTE: BEGIN and COMMIT are called via client.query('BEGIN') and
// client.query('COMMIT') — mockResolvedValue handles them fine
// since we don't check their return values.
//
function setupCrimeFlowDb(userOverrides = {}, crimeOverrides = {}) {
  mocks.clientQuery
    .mockResolvedValueOnce({ rows: [],                          rowCount: 0 }) // BEGIN
    .mockResolvedValueOnce({ rows: [makeUser(userOverrides)],   rowCount: 1 }) // getUserByFirebaseUid
    .mockResolvedValueOnce({ rows: [makeCrime(crimeOverrides)], rowCount: 1 }) // loadCrime
    .mockResolvedValueOnce({ rows: [],                          rowCount: 0 }) // INSERT progress
    .mockResolvedValueOnce({ rows: [makeProgress()],            rowCount: 1 }) // SELECT progress
    .mockResolvedValueOnce({ rows: [],                          rowCount: 0 }) // pickAvailableSpecial
    .mockResolvedValueOnce({ rows: [{ total_xp: 0 }],          rowCount: 1 }) // getTotalCrimeXp
    .mockResolvedValueOnce({ rows: [],                          rowCount: 0 }) // updateProgress
    .mockResolvedValueOnce({ rows: [],                          rowCount: 0 }) // updateUserStats
    .mockResolvedValueOnce({ rows: [],                          rowCount: 0 }); // COMMIT
}

const AUTH = { Authorization: 'Bearer test-token' };

// ============================================================

describe('GET /api/v1/crimes', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisGet.mockResolvedValue(null);
    mocks.mockConnect.mockResolvedValue(mocks.mockClient);
  });

  it('TC-040 returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/crimes');
    expect(res.status).toBe(401);
  });

  it('TC-041 returns crimes list and user stats', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [makeUser()],         rowCount: 1 }) // user
      .mockResolvedValueOnce({ rows: [],                   rowCount: 0 }) // crimes list
      .mockResolvedValueOnce({ rows: [{ total_xp: 0 }],   rowCount: 1 }); // total xp

    const res = await request(app).get('/api/v1/crimes').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(Array.isArray(res.body.crimes)).toBe(true);
    expect(res.body.user.nerve).toBe(30);
    expect(res.body.user.money).toBe(750);
  });
});

describe('POST /api/v1/crimes/attempt', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisScan.mockResolvedValue(['0', []]);
    mocks.mockConnect.mockResolvedValue(mocks.mockClient);
  });

  it('TC-043 returns 403 without UAC challenge header', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    // ban check needs a user from pool.query (not connect)
    mocks.poolQuery.mockResolvedValue({ rows: [makeUser()], rowCount: 1 });

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .send({ crimeKey: 'pickpocket' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Security token required');
  });

  it('TC-044 returns 200 with valid challenge + crime attempt', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    setupRedisForCrimeAttempt();
    setupCrimeFlowDb();

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', VALID_TOKEN)
      .send({ crimeKey: 'pickpocket' });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toMatch(/^(success|fail|crit_fail|special)$/);
    expect(res.body.crime).toMatchObject({ key: 'pickpocket', tier: 1 });
    expect(res.body.rewards).toMatchObject({ money: expect.any(Number) });
    expect(res.body.penalties).toMatchObject({
      moneyLost: expect.any(Number), jailSeconds: expect.any(Number),
    });
    expect(res.body.progress).toMatchObject({ attempts: expect.any(Number) });
    expect(res.body.user).toMatchObject({
      nerve: expect.any(Number), money: expect.any(Number),
    });
  });

  it('TC-046 returns 403 for locked crime (level too low)', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    setupRedisForCrimeAttempt();

    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [],                            rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [makeUser({ level: 1 })],     rowCount: 1 }) // user
      .mockResolvedValueOnce({
        rows: [makeCrime({ unlock_level: 5, crime_key: 'burglary' })],
        rowCount: 1,
      }) // crime
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', VALID_TOKEN)
      .send({ crimeKey: 'burglary' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('level 5');
  });

  it('TC-047 returns 400 for insufficient nerve', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    setupRedisForCrimeAttempt();

    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [],                              rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [makeUser({ nerve: 1 })],       rowCount: 1 }) // user
      .mockResolvedValueOnce({ rows: [makeCrime({ nerve_cost: 5 })], rowCount: 1 }) // crime
      .mockResolvedValueOnce({ rows: [],                              rowCount: 0 }); // ROLLBACK

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', VALID_TOKEN)
      .send({ crimeKey: 'pickpocket' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('nerve');
  });

  it('TC-048 returns 423 when in jail', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    setupRedisForCrimeAttempt();

    const jailUntil = new Date(Date.now() + 3_600_000).toISOString();
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [],                                    rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [makeUser({ jail_until: jailUntil })], rowCount: 1 }) // user
      .mockResolvedValueOnce({ rows: [],                                    rowCount: 0 }); // ROLLBACK

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', VALID_TOKEN)
      .send({ crimeKey: 'pickpocket' });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe('IN_JAIL');
    expect(res.body.secondsRemaining).toBeGreaterThan(0);
  });

  it('TC-049 returns 423 when in hospital', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    setupRedisForCrimeAttempt();

    const hospitalUntil = new Date(Date.now() + 3_600_000).toISOString();
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [],                                             rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [makeUser({ hospital_until: hospitalUntil })],  rowCount: 1 }) // user
      .mockResolvedValueOnce({ rows: [],                                             rowCount: 0 }); // ROLLBACK

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', VALID_TOKEN)
      .send({ crimeKey: 'pickpocket' });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe('IN_HOSPITAL');
  });

  it('TC-151 returns 400 for invalid crimeKey type', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    setupRedisForCrimeAttempt();

    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', VALID_TOKEN)
      .send({ crimeKey: 12345 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('TC-153 error responses always include requestId', async () => {
    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .send({ crimeKey: 'pickpocket' });
    expect(res.body.requestId).toBeDefined();
  });
});
