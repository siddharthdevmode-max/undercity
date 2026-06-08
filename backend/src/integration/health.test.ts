// ============================================================
// HEALTH ROUTES — INTEGRATION TESTS
// ============================================================

import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { Express } from 'express';

const mocks = vi.hoisted(() => {
  const mockSentry = {
    init:                    vi.fn(),
    captureException:        vi.fn(),
    setupExpressErrorHandler: vi.fn().mockReturnValue(
      (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next()
    ),
  };
  const mockIO = {
    to:      vi.fn().mockReturnThis(),
    emit:    vi.fn(),
    sockets: { sockets: { size: 0 } },
    close:   vi.fn().mockImplementation((cb: () => void) => cb()),
    on:      vi.fn(),
  };
  const poolQuery = vi.fn().mockResolvedValue({
    rows: [{ '?column?': 1 }], rowCount: 1,
  });
  const mockPool = {
    query: poolQuery, connect: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
    totalCount: 1, idleCount: 1, waitingCount: 0, on: vi.fn(),
  };
  const redisGet = vi.fn().mockResolvedValue(null);
  const redisSet = vi.fn().mockResolvedValue('OK');
  const mockRedis = {
    get:  redisGet,
    set:  redisSet,
    del:  vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    pipeline: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]),
    }),
    on: vi.fn(), status: 'ready',
  };
  return { mockSentry, mockIO, mockPool, mockRedis, poolQuery, redisGet, redisSet };
});

vi.mock('../config/firebase', () => ({
  authAdmin:   { verifyIdToken: vi.fn(), revokeRefreshTokens: vi.fn(), getUser: vi.fn() },
  firebaseApp: null,
}));
vi.mock('../config/redis', () => ({
  default: mocks.mockRedis, redis: mocks.mockRedis,
  connectRedis:        vi.fn(),
  testRedisConnection: vi.fn().mockResolvedValue(true),
  getRedisInfo:        vi.fn().mockResolvedValue({}),
}));
vi.mock('../config/database', () => ({
  pool:                   mocks.mockPool,
  testDatabaseConnection: vi.fn().mockResolvedValue(undefined),
  getPoolStats:           vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
  withTransaction:        vi.fn().mockImplementation(
    async (fn: (c: unknown) => Promise<unknown>) => fn({ query: vi.fn() })
  ),
}));
vi.mock('../config/sentry',  () => ({ initSentry: vi.fn(), Sentry: mocks.mockSentry }));
vi.mock('../config/socket',  () => ({
  initSocket:   vi.fn().mockReturnValue(mocks.mockIO),
  getIO:        vi.fn().mockReturnValue(mocks.mockIO),
  SocketNotify: {
    statUpdate: vi.fn(), crimeResult: vi.fn(),
    onlineCount: vi.fn(), toUser: vi.fn(),
    broadcast: vi.fn(), system: vi.fn(), maintenance: vi.fn(),
  },
  closeSocket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../queues/index', () => ({
  queueEmail:              vi.fn().mockResolvedValue(undefined),
  emailQueue:              { add: vi.fn(), close: vi.fn() },
  trustRecoveryQueue:      { add: vi.fn(), close: vi.fn() },
  backupQueue:             { add: vi.fn(), close: vi.fn() },
  idempotencyCleanupQueue: { add: vi.fn(), close: vi.fn() },
  gameTickQueue:           { add: vi.fn(), close: vi.fn() },
  paymentWebhookQueue:     { add: vi.fn(), close: vi.fn() },
  closeQueues:             vi.fn().mockResolvedValue(undefined),
  isQueueHealthy:          vi.fn().mockResolvedValue(true),
  getQueueStats:           vi.fn().mockResolvedValue([]),
  initQueueEvents:         vi.fn(),
  bullmqConnection:        {},
}));
vi.mock('../utils/alerts', () => ({
  sendAlert: vi.fn(), alertCritical: vi.fn(), alertWarning: vi.fn(), alertInfo: vi.fn(),
  stopAlertQueue: vi.fn(),
  Alerts: {
    serverStarted:      vi.fn(), gracefulShutdown:  vi.fn(),
    suspiciousLogin:    vi.fn(), honeypotTriggered: vi.fn(),
    dbPoolExhausted:    vi.fn(), highErrorRate:     vi.fn(),
    hardBan:            vi.fn(), softBan:           vi.fn(),
    gameTickSlow:       vi.fn(), gameTickFailed:    vi.fn(),
    backupFailed:       vi.fn(), backupSucceeded:   vi.fn(),
    systemError:        vi.fn(), newUser:           vi.fn(),
    maintenanceToggled: vi.fn(), paymentFailed:     vi.fn(),
    massViolation:      vi.fn(), highMemory:        vi.fn(), highDisk: vi.fn(),
  },
}));
vi.mock('../services/gameTick', () => ({
  startGameTick: vi.fn(), stopGameTick: vi.fn(), runGameTick: vi.fn().mockResolvedValue(null),
  getTickInfo: vi.fn().mockResolvedValue({
    isRunning: false, circuitOpen: false, tickCount: 0,
    lastTickAt: null,
    lastRunTimes: { energy: null, nerve: null, life: null, happiness: null },
  }),
}));

// ── Mock internalOnly middleware to enforce key check ─────
// In test env, the internalOnly middleware may skip or pass.
// We mock it to always enforce the key requirement.
vi.mock('../middleware/internalOnly', () => ({
  internalOnly: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const key = req.headers['x-internal-key'];
    if (!key || key !== 'internal-secret') {
      res.status(403).json({ message: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    next();
  },
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

describe('Health Routes', () => {

  describe('GET /api/v1/health (TC-001)', () => {
    it('returns 200 with ok status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
    it('sets no-cache headers', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['cache-control']).toContain('no-store');
    });
    it('TC-140 includes X-Request-ID', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });
    it('TC-140 includes X-API-Version: 1', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-api-version']).toBe('1');
    });
  });

  describe('GET /api/health (TC-002 legacy alias)', () => {
    it('returns 200', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /api/v1/health/detailed (TC-003)', () => {
    it('returns services object', async () => {
      const res = await request(app).get('/api/v1/health/detailed');
      expect(res.status).toBe(200);
      expect(res.body.services).toBeDefined();
      expect(res.body.services.database).toBeDefined();
      expect(res.body.services.redis).toBeDefined();
      expect(res.body.services.memory).toBeDefined();
    });
    it('includes uptime_seconds', async () => {
      const res = await request(app).get('/api/v1/health/detailed');
      expect(typeof res.body.uptime_seconds).toBe('number');
    });
  });

  describe('GET /api/v1/health/metrics (TC-005)', () => {
    it('returns 403 without internal key', async () => {
      const res = await request(app).get('/api/v1/health/metrics');
      expect(res.status).toBe(403);
    });
    it('returns 200 with correct internal key', async () => {
      const res = await request(app)
        .get('/api/v1/health/metrics')
        .set('X-Internal-Key', 'internal-secret');
      expect(res.status).toBe(200);
    });
  });

  describe('Security Headers (TC-140)', () => {
    it('sets X-Content-Type-Options: nosniff', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
    it('sets X-Frame-Options: DENY', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });
    it('sets Referrer-Policy', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['referrer-policy']).toBeDefined();
    });
  });

  describe('404 handling (TC-150)', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
    it('TC-153 includes requestId in error response', async () => {
      const res = await request(app).get('/api/v1/does-not-exist');
      expect(res.body.requestId).toBeTruthy();
    });
  });

  describe('CORS (TC-141, TC-142)', () => {
    it('TC-141 allows localhost:5173', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
    it('TC-142 blocks unknown origins', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://evil.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
