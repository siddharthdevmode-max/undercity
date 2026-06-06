// ============================================================
// GRACEFUL SHUTDOWN — UNDERCITY
// Tracks in-flight requests.
// Order: stop accepting → drain → queues → game tick → DB → Redis
// ============================================================

import { Server, IncomingMessage, ServerResponse } from "http";
import * as Sentry from "@sentry/node";
import { pool }   from "../config/database";
import redis      from "../config/redis";
import { logger } from "./logger";
import { Alerts } from "./alerts";

// ─── In-flight Request Tracking ───────────────────────────
// Uses a WeakSet flag per response to prevent double-decrement
// when both "finish" and "close" fire on the same request.

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

  logger.warn(`⚠️  ${signal} received — graceful shutdown initiated`, {
    openRequests,
  });

  Alerts.gracefulShutdown(signal);

  // Force kill after 30s
  const forceKillTimer = setTimeout(() => {
    logger.error("💥 Forced shutdown after 30s timeout");
    process.exit(1);
  }, 30_000);
  forceKillTimer.unref();

  // ── Step 1: Stop accepting new connections ─────────────
  await new Promise<void>((resolve) => {
    server.close(() => {
      logger.info("✅ HTTP server closed (no new connections)");
      resolve();
    });
  });

  // ── Step 2: Wait for in-flight requests (max 15s) ─────
  if (openRequests > 0) {
    logger.info(`⏳ Waiting for ${openRequests} in-flight requests...`);

    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (openRequests <= 0) {
          clearInterval(poll);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(poll);
        logger.warn(`⚠️  Forcing close with ${openRequests} requests still open`);
        resolve();
      }, 15_000);
    });
  }

  // ── Step 3: Run registered cleanup functions ───────────
  for (const fn of cleanupFns) {
    try {
      await fn();
    } catch (err) {
      logger.error("Cleanup function failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 4: BullMQ queues and workers ─────────────────
  try {
    const [{ closeQueues }, { closeWorkers }] = await Promise.all([
      import("../queues/index"),
      import("../queues/workers"),
    ]);
    await Promise.allSettled([closeQueues(), closeWorkers()]);
    logger.info("✅ BullMQ queues and workers closed");
  } catch {
    logger.debug("BullMQ not initialized — skipping");
  }

  // ── Step 5: Game tick ─────────────────────────────────
  try {
    const { stopGameTick } = await import("../services/gameTick");
    stopGameTick();
    logger.info("✅ Game tick stopped");
  } catch {
    logger.debug("Game tick not initialized — skipping");
  }

  // ── Step 6: Database ──────────────────────────────────
  try {
    await pool.end();
    logger.info("✅ Database pool closed");
  } catch (err) {
    logger.error("Failed to close DB pool", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 7: Redis ─────────────────────────────────────
  try {
    await redis.quit();
    logger.info("✅ Redis connection closed");
  } catch (err) {
    logger.error("Failed to close Redis", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("✅ Graceful shutdown complete");
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

    logger.error("💥 Unhandled promise rejection", { reason: message, stack });

    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(
        reason instanceof Error ? reason : new Error(message)
      );
    }
  });

  process.on("uncaughtException", (error) => {
    logger.error("💥 Uncaught exception — process will exit", {
      error: error.message,
      stack: error.stack,
    });

    Sentry.captureException(error);

    setTimeout(() => process.exit(1), 2_000).unref();
  });
}
