// ============================================================
// CHALLENGE ROUTES — INTEGRATION TESTS
// ============================================================

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const poolQuery     = vi.fn();
  const redisGet      = vi.fn().mockResolvedValue(null);
  const redisSet      = vi.fn().mockResolvedValue('OK');
  const redisDel      = vi.fn().mockResolvedValue(1);
  const redisScan     = vi.fn().mockResolvedValue(['0', []]);

  const pipeline = {
    set: vi.fn().mockReturnThis(), incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([['OK'], [1], [1]]),
  };
  const mockRedis = {
    get: redisGet, set: redisSet, del: redisDel, scan: redisScan,
    pipeline: vi.fn().mockReturnValue(pipeline), on: vi.fn(), status: 'ready',
  };
  const mockPool = {
    query: poolQuery, connect: vi.fn().mockResolvedValue({ query: poolQuery, release: vi.fn() }),
    totalCount: 1, idleCount: 1, waitingCount: 0, on: vi.fn(),
  };
  const mockSentry = {
    init: vi.fn(), captureException: vi.fn(),
    setupExpressErrorHandler: vi.fn().mockReturnValue(
      (_e: unknown, _r: unknown, _s: unknown, n: () => void) => n()
    ),
  };
  const mockIO = { to: vi.fn().mockReturnThis(), emit: vi.fn(), sockets: { sockets: { size: 0 } }, on: vi.fn() };

  return { verifyIdToken, poolQuery, redisGet, redisSet, redisDel, redisScan, mockRedis, mockPool, mockSentry, mockIO };
});

vi.mock('../config/firebase', () => ({
  authAdmin: { verifyIdToken: mocks.verifyIdToken, revokeRefreshTokens: vi.fn() },
  firebaseApp: null,
}));
vi.mock('../config/redis', () => ({
  default: mocks.mockRedis, redis: mocks.mockRedis,
  connectRedis: vi.fn(), testRedisConnection: vi.fn().mockResolvedValue(true), getRedisInfo: vi.fn().mockResolvedValue({}),
}));
vi.mock('../config/database', () => ({
  pool: mocks.mockPool,
  getPoolStats: vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
  withTransaction: vi.fn(),
}));
vi.mock('../config/sentry', () => ({ initSentry: vi.fn(), Sentry: mocks.mockSentry }));
vi.mock('../config/socket', () => ({
  initSocket:   vi.fn().mockReturnValue(mocks.mockIO),
  getIO:        vi.fn().mockReturnValue(mocks.mockIO),
  SocketNotify: { statUpdate: vi.fn(), crimeResult: vi.fn(), onlineCount: vi.fn(), toUser: vi.fn() },
  closeSocket:  vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../queues/index', () => ({
  queueEmail: vi.fn(), emailQueue: { add: vi.fn() },
  trustRecoveryQueue: { add: vi.fn() }, backupQueue: { add: vi.fn() },
  idempotencyCleanupQueue: { add: vi.fn() }, gameTickQueue: { add: vi.fn() },
  paymentWebhookQueue: { add: vi.fn() }, closeQueues: vi.fn(), bullmqConnection: {},
}));
vi.mock('../utils/alerts', () => ({
  sendAlert: vi.fn(), stopAlertQueue: vi.fn(),
  Alerts: { serverStarted: vi.fn(), suspiciousLogin: vi.fn() },
}));
vi.mock('../services/gameTick', () => ({
  startGameTick: vi.fn(), stopGameTick: vi.fn(),
  getTickInfo: vi.fn().mockResolvedValue({ isRunning: false }),
}));
vi.mock('../services/trustEngine', () => ({
  flagUser:     vi.fn().mockResolvedValue({ skipped: true }),
  getTrustInfo: vi.fn().mockResolvedValue({ trustScore: 100, tier: 'CLEAN' }),
}));
vi.mock('../services/immunityCheck', () => ({
  isImmuneFromUAC: vi.fn().mockResolvedValue(false),
}));

let request: typeof import('supertest').default;
let app: Express;

beforeAll(async () => {
  const supertest = await import('supertest');
  const appModule = await import('../app');
  request = supertest.default;
  app     = appModule.default;
});

function makeToken() {
  return {
    uid: 'test-uid-123', email: 'test@test.com', email_verified: true,
    name: 'Test', aud: 'test', auth_time: 0, exp: 9999999999,
    firebase: { identities: {}, sign_in_provider: 'password' },
    iat: 0, iss: 'test', sub: 'test-uid-123',
  };
}

function makeUser() {
  return {
    id: 1, firebase_uid: 'test-uid-123', email: 'test@test.com',
    username: 'testplayer', level: 1, money: 750,
    nerve: 30, max_nerve: 30, life: 100, max_life: 100,
    is_shadow_banned: false, is_hard_banned: false,
    trust_score: 100, total_flags: 0,
    jail_until: null, hospital_until: null, federal_jail_until: null,
    last_crime_at: null,
  };
}

const AUTH = { Authorization: 'Bearer test-token' };

// ============================================================

describe('Challenge Routes — GET /api/v1/challenge', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisScan.mockResolvedValue(['0', []]);
  });

  it('TC-060 returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/challenge');
    expect(res.status).toBe(401);
  });

  it('TC-061 returns token with 64 hex chars and ttlSeconds: 30', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    mocks.poolQuery.mockResolvedValue({ rows: [makeUser()], rowCount: 1 });
    const res = await request(app).get('/api/v1/challenge').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(res.body.token)).toBe(true);
    expect(res.body.ttlSeconds).toBe(30);
  });

  it('TC-062 returns 429 when 5 outstanding tokens exist', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    mocks.poolQuery.mockResolvedValue({ rows: [makeUser()], rowCount: 1 });
    mocks.redisScan.mockResolvedValue(['0', [
      'challenge:test-uid-123:t1', 'challenge:test-uid-123:t2',
      'challenge:test-uid-123:t3', 'challenge:test-uid-123:t4',
      'challenge:test-uid-123:t5',
    ]]);
    const res = await request(app).get('/api/v1/challenge').set(AUTH);
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('pending challenge tokens');
  });

  it('sets no-cache headers', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    mocks.poolQuery.mockResolvedValue({ rows: [makeUser()], rowCount: 1 });
    const res = await request(app).get('/api/v1/challenge').set(AUTH);
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('stores token in Redis with TTL 30', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    mocks.poolQuery.mockResolvedValue({ rows: [makeUser()], rowCount: 1 });
    await request(app).get('/api/v1/challenge').set(AUTH);
    expect(mocks.redisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^challenge:test-uid-123:/), '1', 'EX', 30
    );
  });

  it('TC-065 returns 403 for malformed challenge token in crime attempt', async () => {
    mocks.verifyIdToken.mockResolvedValue(makeToken());
    mocks.poolQuery.mockResolvedValue({ rows: [makeUser()], rowCount: 1 });
    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set(AUTH)
      .set('X-UAC-Challenge', '../../etc/passwd')
      .send({ crimeKey: 'pickpocket' });
    expect(res.status).toBe(403);
  });
});
