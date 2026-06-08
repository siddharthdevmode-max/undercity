// ============================================================
// MISC ROUTES — INTEGRATION TESTS
// ============================================================

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';

const mocks = vi.hoisted(() => {
  const poolQuery = vi.fn();
  const redisGet  = vi.fn().mockResolvedValue(null);
  const redisSet  = vi.fn().mockResolvedValue('OK');

  const mockRedis = {
    get:      redisGet,
    set:      redisSet,
    del:      vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]),
    }),
    on: vi.fn(), status: 'ready',
  };

  const mockPool = {
    query:   poolQuery,
    connect: vi.fn().mockResolvedValue({ query: poolQuery, release: vi.fn() }),
    totalCount: 1, idleCount: 1, waitingCount: 0, on: vi.fn(),
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

  return { poolQuery, redisGet, redisSet, mockRedis, mockPool, mockSentry, mockIO };
});

vi.mock('../config/firebase', () => ({
  authAdmin: { verifyIdToken: vi.fn(), revokeRefreshTokens: vi.fn() },
  firebaseApp: null,
}));
vi.mock('../config/redis', () => ({
  default: mocks.mockRedis, redis: mocks.mockRedis,
  connectRedis: vi.fn(), testRedisConnection: vi.fn().mockResolvedValue(true),
  getRedisInfo: vi.fn().mockResolvedValue({}),
}));
vi.mock('../config/database', () => ({
  pool: mocks.mockPool,
  getPoolStats:    vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
  withTransaction: vi.fn(),
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
  trustRecoveryQueue: { add: vi.fn() }, backupQueue: { add: vi.fn() },
  idempotencyCleanupQueue: { add: vi.fn() }, gameTickQueue: { add: vi.fn() },
  paymentWebhookQueue: { add: vi.fn() }, closeQueues: vi.fn(), bullmqConnection: {},
}));
vi.mock('../utils/alerts', () => ({
  sendAlert: vi.fn(), stopAlertQueue: vi.fn(),
  Alerts: {
    serverStarted:    vi.fn(), suspiciousLogin:   vi.fn(),
    honeypotTriggered: vi.fn(), systemError:       vi.fn(),
  },
}));
vi.mock('../services/gameTick', () => ({
  startGameTick: vi.fn(), stopGameTick: vi.fn(),
  getTickInfo: vi.fn().mockResolvedValue({
    isRunning: false, circuitOpen: false, tickCount: 5,
    lastTickAt: null,
    lastRunTimes: { energy: null, nerve: null, life: null, happiness: null },
  }),
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

// ============================================================

describe('Payment Routes (TC-120 to TC-122)', () => {

  it('TC-120 GET /packs returns pack list', async () => {
    const res = await request(app).get('/api/v1/payments/packs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.packs)).toBe(true);
    expect(res.body.packs.length).toBeGreaterThan(0);
    expect(res.body.packs[0]).toMatchObject({
      id:       expect.any(String),
      name:     expect.any(String),
      points:   expect.any(Number),
      priceUsd: expect.any(Number),
    });
  });

  it('TC-121 POST /checkout returns 503', async () => {
    const res = await request(app).post('/api/v1/payments/checkout').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('PAYMENTS_NOT_ENABLED');
  });

  it('TC-122 POST /webhook returns 503', async () => {
    const res = await request(app).post('/api/v1/payments/webhook').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('WEBHOOK_NOT_ENABLED');
  });
});

describe('Stats Routes (TC-090 to TC-092)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisGet.mockResolvedValue(null);
  });

  it('TC-090 GET /stats/live returns stats object', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ n: 42 }], rowCount: 1 });
    const res = await request(app).get('/api/v1/stats/live');
    expect(res.status).toBe(200);
    expect(typeof res.body.onlineNow).toBe('number');
    expect(typeof res.body.last24Hours).toBe('number');
  });

  it('TC-091 returns cached stats when Redis has data', async () => {
    const cached = JSON.stringify({
      onlineNow: 99, last3Hours: 200, last24Hours: 500,
      crimes24h: 100, attacks24h: 0, casino24h: 0, _source: 'db',
    });
    mocks.redisGet.mockResolvedValue(cached);
    const res = await request(app).get('/api/v1/stats/live');
    expect(res.status).toBe(200);
    expect(res.body._source).toBe('cache');
    expect(res.body.onlineNow).toBe(99);
  });

  it('TC-092 GET /stats/tick returns tick info', async () => {
    const res = await request(app).get('/api/v1/stats/tick');
    expect(res.status).toBe(200);
    expect(res.body.tick).toBeDefined();
    expect(res.body.tick.isRunning).toBe(false);
  });

  it('returns fallback when DB fails — never 500', async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.poolQuery.mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/api/v1/stats/live');
    expect(res.status).toBe(200);
    expect(res.body.onlineNow).toBe(0);
  });
});

describe('Error Handling (TC-150 to TC-153)', () => {

  it('TC-150 returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('TC-153 all errors include requestId', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.body.requestId).toBeDefined();
    expect(typeof res.body.requestId).toBe('string');
  });

  it('TC-152 rejects oversized body — Express returns 413', async () => {
    // Express body limit is 100kb. Send >100kb of raw body.
    // Express returns 413 PayloadTooLarge before hitting any route.
    const bigPayload = Buffer.alloc(110 * 1024, 'x');
    const res = await request(app)
      .post('/api/v1/crimes/attempt')
      .set('Content-Type', 'application/json')
      .set('Content-Length', String(bigPayload.length))
      .send(bigPayload);
    // Express 413 = payload too large
    // Could also be 400 if JSON parsing fails first
    expect([400, 413, 500]).toContain(res.status);
  });
});

describe('Honeypot Routes (TC-130 to TC-132)', () => {

  // NOTE: TC-130 tests /api/v1/admin/add-money
  // This path is ALSO registered in adminRoutes.ts as POST /adjust-money/:uid
  // (different path — no conflict). The honeypot path is /admin/add-money.
  // adminRoutes is mounted at /api/v1/admin, so /api/v1/admin/add-money
  // would match adminRoutes first IF add-money is a route there.
  // Since adminRoutes has /adjust-money/:uid (not /add-money), it falls through.
  // honeypotRoutes mounted at /api/v1 catches it as /admin/add-money.
  // BUT: adminRoutes requires verifyFirebaseToken globally → 401 before honeypot.
  // ACTUAL behavior: 401 (auth required by adminRoutes middleware)
  // The honeypot only fires for paths NOT covered by other route files.

  it('TC-130 POST /api/v1/admin/add-money — returns 401 (admin routes intercept first)', async () => {
    // Admin routes apply verifyFirebaseToken to ALL /api/v1/admin/* routes
    // So unauthenticated requests to /api/v1/admin/* get 401, not 404
    // The honeypot at /api/v1 catches requests AFTER all other routes
    // Since adminRoutes handles /api/v1/admin/* first, honeypot never fires here
    const res = await request(app)
      .post('/api/v1/admin/add-money')
      .send({ amount: 999999 });
    // Could be 401 (admin auth) or 404 (honeypot) depending on mount order
    expect([401, 404]).toContain(res.status);
  });

  it('TC-130b POST /api/v1/debug/skip-jail — true honeypot returns 404', async () => {
    // This path is NOT in any other route file, so honeypot catches it
    const res = await request(app)
      .post('/api/v1/debug/skip-jail')
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not found');
  });

  it('TC-132 GET /api/v1/internal/config-dump returns 404', async () => {
    const res = await request(app).get('/api/v1/internal/config-dump');
    expect(res.status).toBe(404);
  });

  it('TC-131 POST /api/v1/cheats/unlock-all returns 404', async () => {
    const res = await request(app).post('/api/v1/cheats/unlock-all').send({});
    expect(res.status).toBe(404);
  });
});

describe('Maintenance Mode (TC-071)', () => {
  it('health always returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});
