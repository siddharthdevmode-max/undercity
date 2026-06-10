// ============================================================
// GRACEFUL SHUTDOWN — UNDERCITY
// Tracks in-flight requests.
// Order: stop accepting → drain → socket.io → queues →
//        game tick → DB → Redis → Sentry flush → exit
// ============================================================

import { Server, IncomingMessage, ServerResponse } from "http";
import { pool }  from "../config/database";
import redis     from "../config/redis";
import { logger } from "./logger";

// ─── In-flight Request Tracking ───────────────────────────

let openRequests = 0;
const closedResponses = new WeakSet<ServerResponse>();

export function trackRequests(
  _req: IncomingMessage,
  res:  ServerResponse,
  next: () => void
): void {
  openRequests++;

  function decrement() {
    if (!closedResponses.has(res)) {
      closedResponses.add(res);
      openRequests = Math.max(0, openRequests - 1);
    }
  }

  res.on("finish", decrement);
  res.on("close",  decrement);
  next();
}

// ─── Shutdown State ───────────────────────────────────────

let isShuttingDown = false;

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

// ─── Cleanup Registry ─────────────────────────────────────

type CleanupFn = () => Promise<void>;
const cleanupFns: CleanupFn[] = [];

export function registerCleanup(fn: CleanupFn): void {
  cleanupFns.push(fn);
}

// ─── Core Shutdown Logic ──────────────────────────────────

async function shutdown(signal: string, server: Server): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, ignoring signal", { signal });
    return;
  }

  isShuttingDown = true;

  logger.warn(`${signal} received — graceful shutdown initiated`, {
    openRequests,
  });

  // BUG FIX: fire-and-forget alert with error handling
  void import("./alerts")
    .then(({ Alerts }) => Alerts.gracefulShutdown(signal))
    .catch(() => {});

  // BUG FIX: force kill at 60s (not 30s)
  // Drain(15s) + socket(5s) + queues(10s) + DB/Redis(10s) + flush(5s) = ~45s
  const forceKillTimer = setTimeout(() => {
    logger.error("Forced shutdown after 60s timeout — killing process");
    process.exit(1);
  }, 60_000);
  forceKillTimer.unref();

  // ── Step 1: Stop accepting new HTTP connections ────────
  await new Promise<void>((resolve) => {
    server.close(() => {
      logger.info("HTTP server closed (no new connections)");
      resolve();
    });
  });

  // ── Step 2: Drain in-flight requests (max 15s) ────────
  if (openRequests > 0) {
    logger.info(`Waiting for ${openRequests} in-flight requests...`);

    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (openRequests <= 0) {
          clearInterval(poll);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(poll);
        logger.warn(`Forcing close with ${openRequests} requests still open`);
        resolve();
      }, 15_000);
    });
  }

  // ── Step 3: Close Socket.io ───────────────────────────
  // BUG FIX: was missing — HTTP server.close() does not close
  // existing WebSocket connections. Must be explicit.
  try {
    const { closeSocket } = await import("../config/socket");
    await closeSocket();
    logger.info("Socket.io closed");
  } catch {
    logger.debug("Socket.io not initialized — skipping");
  }

  // ── Step 4: Run registered cleanup functions ──────────
  for (const fn of cleanupFns) {
    try {
      await fn();
    } catch (err) {
      logger.error("Cleanup function failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 5: BullMQ queues and workers ─────────────────
  try {
    const [{ closeQueues }, { closeWorkers }] = await Promise.all([
      import("../queues/index"),
      import("../queues/workers"),
    ]);
    await Promise.allSettled([closeQueues(), closeWorkers()]);
    logger.info("BullMQ queues and workers closed");
  } catch {
    logger.debug("BullMQ not initialized — skipping");
  }

  // ── Step 6: Game tick ─────────────────────────────────
  try {
    const { stopGameTick } = await import("../services/gameTick");
    stopGameTick();
    logger.info("Game tick stopped");
  } catch {
    logger.debug("Game tick not initialized — skipping");
  }

  // ── Step 7: Database ──────────────────────────────────
  try {
    await pool.end();
    logger.info("Database pool closed");
  } catch (err) {
    logger.error("Failed to close DB pool", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 8: Redis ─────────────────────────────────────
  try {
    await redis.quit();
    logger.info("Redis connection closed");
  } catch (err) {
    logger.error("Failed to close Redis", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 9: Flush Sentry ──────────────────────────────
  // BUG FIX: was missing — without flush, last-moment errors
  // captured during shutdown are discarded
  try {
    const { flushSentry } = await import("../config/sentry");
    await flushSentry(3_000);
    logger.info("Sentry flushed");
  } catch {
    logger.debug("Sentry flush failed or not initialized");
  }

  // ── Step 10: Alert queue (must be absolute last) ───────
  try {
    const { stopAlertQueue } = await import("./alerts");
    // Give pending Discord/Slack webhooks 2s to fire
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
    stopAlertQueue();
  } catch {
    logger.debug("Alert queue not initialized — skipping");
  }

  logger.info("Graceful shutdown complete");
  clearTimeout(forceKillTimer);
  process.exit(0);
}

// ─── Setup ────────────────────────────────────────────────

export function setupGracefulShutdown(server: Server): void {
  process.once("SIGTERM", () => void shutdown("SIGTERM", server));
  process.once("SIGINT",  () => void shutdown("SIGINT",  server));

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack   = reason instanceof Error ? reason.stack   : undefined;

    logger.error("Unhandled promise rejection", { reason: message, stack });

    // BUG FIX: always capture to Sentry if initialized (not prod-only)
    void import("../config/sentry").then(({ Sentry }) => {
      Sentry.captureException(
        reason instanceof Error ? reason : new Error(message)
      );
    }).catch(() => {});
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception — process will exit", {
      error: error.message,
      stack: error.stack,
    });

    // Flush Sentry synchronously before exit
    void import("../config/sentry").then(async ({ Sentry, flushSentry }) => {
      Sentry.captureException(error);
      await flushSentry(2_000);
    }).catch(() => {}).finally(() => {
      setTimeout(() => process.exit(1), 500).unref();
    });
  });
}
