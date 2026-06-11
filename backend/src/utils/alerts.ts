// ============================================================
// ALERT UTILITY — UNDERCITY
// Fire-and-forget alert system with Discord + Slack webhooks,
// deduplication, queue rate limiting, and memory bounds.
// ============================================================

import { logger } from "./logger";
import { config  } from "../config";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertPayload {
  title:      string;
  message:    string;
  severity:   AlertSeverity;
  fields?:    Record<string, string | number | boolean>;
  requestId?: string;
  dedupeKey?: string;
}

const DISCORD_COLORS: Record<AlertSeverity, number> = {
  info:     0x3498db,
  warning:  0xf39c12,
  critical: 0xe74c3c,
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info:     "ℹ️",
  warning:  "⚠️",
  critical: "🚨",
};

// ─── Dedupe ───────────────────────────────────────────────
// BUG FIX: bounded map — prune entries older than 24h on each check

const DEDUPE_COOLDOWN_MS = 5 * 60 * 1_000;
const DEDUPE_MAX_AGE_MS  = 24 * 60 * 60 * 1_000;
const dedupeMap = new Map<string, number>();

function pruneDedupe(): void {
  const cutoff = Date.now() - DEDUPE_MAX_AGE_MS;
  for (const [key, ts] of dedupeMap.entries()) {
    if (ts < cutoff) dedupeMap.delete(key);
  }
}

function isDuplicate(payload: AlertPayload): boolean {
  if (!payload.dedupeKey) return false;
  const lastSent = dedupeMap.get(payload.dedupeKey);
  if (!lastSent) return false;
  return Date.now() - lastSent < DEDUPE_COOLDOWN_MS;
}

function markSent(payload: AlertPayload): void {
  if (!payload.dedupeKey) return;
  dedupeMap.set(payload.dedupeKey, Date.now());
  // Prune on every write — keeps memory bounded
  if (dedupeMap.size > 500) pruneDedupe();
}

// ─── Queue ────────────────────────────────────────────────
// BUG FIX: max queue size — prevents unbounded growth when
// Discord is down or alerts fire faster than they send

const MAX_QUEUE_SIZE    = 50;
const alertQueue: AlertPayload[] = [];
let isProcessing        = false;
const QUEUE_INTERVAL_MS = 1_000;

let queueInterval: ReturnType<typeof setInterval> | null = null;

// ─── Webhook Senders ─────────────────────────────────────

async function sendDiscordAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = config.discordAlertWebhook;
  // BUG FIX: validate URL before fetch — empty string throws TypeError
  if (!webhookUrl || !webhookUrl.startsWith("https://")) return;

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (payload.fields) {
    for (const [name, value] of Object.entries(payload.fields)) {
      fields.push({ name, value: String(value), inline: true });
    }
  }
  if (payload.requestId) {
    fields.push({ name: "Request ID", value: payload.requestId, inline: true });
  }
  fields.push(
    { name: "Environment", value: config.nodeEnv,          inline: true  },
    { name: "Time",        value: new Date().toISOString(), inline: false }
  );

  const body = {
    embeds: [{
      title:       `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
      description: payload.message,
      color:       DISCORD_COLORS[payload.severity],
      fields,
      footer: { text: "Undercity Alert System" },
    }],
  };

  const res = await fetch(webhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(5_000),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    logger.warn("Discord rate limited", { retryAfter });
    return;
  }
  if (!res.ok) {
    logger.warn("Discord alert failed", { status: res.status });
  }
}

async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = config.slackAlertWebhook;
  if (!webhookUrl || !webhookUrl.startsWith("https://")) return;

  const fieldLines = payload.fields
    ? Object.entries(payload.fields).map(([k, v]) => `*${k}:* ${v}`).join("\n")
    : "";

  const text = [
    `${SEVERITY_EMOJI[payload.severity]} *${payload.title}*`,
    payload.message,
    fieldLines,
    `_Env: ${config.nodeEnv} | ${new Date().toISOString()}_`,
  ].filter(Boolean).join("\n");

  const body = {
    text,
    username:   "Undercity Alerts",
    icon_emoji: payload.severity === "critical" ? ":rotating_light:" : ":warning:",
  };

  const res = await fetch(webhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    logger.warn("Slack alert failed", { status: res.status });
  }
}

// ─── Queue Processor ─────────────────────────────────────

async function processQueue(): Promise<void> {
  if (isProcessing || alertQueue.length === 0) return;
  isProcessing = true;
  const payload = alertQueue.shift()!;
  try {
    await Promise.allSettled([
      sendDiscordAlert(payload),
      sendSlackAlert(payload),
    ]);
  } catch (err) {
    logger.warn("Alert queue error", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isProcessing = false;
  }
}

function ensureQueueStarted(): void {
  if (queueInterval || config.isTest) return;
  queueInterval = setInterval(() => void processQueue(), QUEUE_INTERVAL_MS);
  if (queueInterval.unref) queueInterval.unref();
}

export function stopAlertQueue(): void {
  if (queueInterval) {
    clearInterval(queueInterval);
    queueInterval = null;
    logger.info("Alert queue stopped");
  }
}

// ─── Core sendAlert ───────────────────────────────────────
// BUG FIX: returns Promise<void> so callers can await or void it
// This fixes the inconsistency where server.ts called .catch()
// on a void return value

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const forceAlerts = config.forceAlerts;
  if (!config.isProduction && !forceAlerts) return;

  const logFn =
    payload.severity === "critical" ? logger.error.bind(logger) :
    payload.severity === "warning"  ? logger.warn.bind(logger)  :
    logger.info.bind(logger);

  logFn(`ALERT [${payload.severity.toUpperCase()}]: ${payload.title}`, {
    message: payload.message,
    ...payload.fields,
  });

  if (isDuplicate(payload)) {
    logger.debug("Alert suppressed (dedupe)", { key: payload.dedupeKey });
    return;
  }

  markSent(payload);

  // BUG FIX: drop oldest if queue is full — prevents unbounded growth
  if (alertQueue.length >= MAX_QUEUE_SIZE) {
    alertQueue.shift(); // drop oldest
    logger.warn("Alert queue full — oldest alert dropped");
  }

  ensureQueueStarted();
  alertQueue.push(payload);
}

// ─── Shorthand helpers ────────────────────────────────────

export const alertCritical = (
  title:      string,
  message:    string,
  fields?:    Record<string, string | number | boolean>,
  dedupeKey?: string
): Promise<void> =>
  sendAlert({ title, message, severity: "critical", fields, dedupeKey });

export const alertWarning = (
  title:      string,
  message:    string,
  fields?:    Record<string, string | number | boolean>,
  dedupeKey?: string
): Promise<void> =>
  sendAlert({ title, message, severity: "warning", fields, dedupeKey });

export const alertInfo = (
  title:      string,
  message:    string,
  fields?:    Record<string, string | number | boolean>,
  dedupeKey?: string
): Promise<void> =>
  sendAlert({ title, message, severity: "info", fields, dedupeKey });

// ─── Alerts Object ────────────────────────────────────────

export const Alerts = {

  hardBan: (uid: string, reason: string, ip?: string) =>
    alertCritical(
      "User Hard Banned",
      `UID: ${uid.slice(0, 8)}... permanently banned`,
      { reason, ip: ip ?? "unknown", action: "Firebase session revoked" },
      `hard-ban:${uid}`
    ),

  softBan: (uid: string, reason: string, expiresAt: Date) =>
    alertWarning(
      "User Soft Banned",
      `UID: ${uid.slice(0, 8)}... temporarily banned`,
      { reason, expiresAt: expiresAt.toISOString() },
      `soft-ban:${uid}`
    ),

  massViolation: (uid: string, violationType: string, count: number) =>
    alertWarning(
      "Mass UAC Violation",
      "User triggering repeated violations",
      { uid: uid.slice(0, 8), violationType, count },
      `mass-violation:${uid}:${violationType}`
    ),

  honeypotTriggered: (uid: string, path: string, ip?: string) =>
    alertCritical(
      "Honeypot Triggered",
      "User accessed honeypot endpoint",
      { uid: uid.slice(0, 8), path, ip: ip ?? "unknown" },
      `honeypot:${uid}`
    ),

  dbPoolExhausted: (waiting: number, total: number) =>
    alertCritical(
      "DB Pool Exhausted",
      "All database connections in use — possible bottleneck",
      { waiting, total, action: "Investigate slow queries or scale DB" },
      "db-pool-exhausted"
    ),

  highErrorRate: (errorCount: number, windowMinutes: number) =>
    alertCritical(
      "High Error Rate",
      "Server error rate is elevated",
      { errors: errorCount, windowMins: windowMinutes, action: "Check Sentry" },
      "high-error-rate"
    ),

  serverStarted: (port: number, env: string) =>
    alertInfo(
      "Server Started",
      "Undercity backend is online",
      { port, environment: env },
      "server-started"
    ),

  gracefulShutdown: (signal: string) =>
    alertWarning(
      "Server Shutting Down",
      `Received signal: ${signal}`,
      { signal, action: "Graceful shutdown in progress" },
      "shutdown"
    ),

  // BUG FIX: was missing — referenced in redis.ts
  redisDown: (label: string) =>
    alertCritical(
      "Redis Connection Lost",
      `Redis client [${label}] has exhausted all reconnect attempts`,
      { label, action: "Check Redis health immediately" },
      `redis-down:${label}`
    ),

  // BUG FIX: was missing — referenced in server.ts
  scheduledJobsFailed: (error: string) =>
    alertCritical(
      "Scheduled Jobs Failed",
      "BullMQ scheduled jobs failed to start — game tick may be affected",
      { error, action: "Check BullMQ and Redis health" },
      "scheduled-jobs-failed"
    ),

  suspiciousLogin: (uid: string, ip: string, reason: string) =>
    alertWarning(
      "Suspicious Login Detected",
      `UID: ${uid.slice(0, 8)}... logged in from suspicious context`,
      { ip, reason },
      `suspicious-login:${uid}`
    ),

  paymentFailed: (uid: string, amount: number, reason: string) =>
    alertWarning(
      "Payment Failed",
      `UID: ${uid.slice(0, 8)}... payment of $${amount} failed`,
      { reason },
      `payment-failed:${uid}`
    ),

  newUser: (username: string, uid: string) =>
    alertInfo(
      "New User Registered",
      `${username} joined the Undercity`,
      { uid: uid.slice(0, 8) }
    ),

  maintenanceToggled: (enabled: boolean, adminUid: string) =>
    alertCritical(
      `Maintenance Mode ${enabled ? "ENABLED" : "DISABLED"}`,
      `Admin ${adminUid.slice(0, 8)} toggled maintenance mode`,
      { enabled, adminUid: adminUid.slice(0, 8) },
      "maintenance-toggle"
    ),

  systemError: (
    title:    string,
    message:  string,
    severity: "low" | "medium" | "high" = "medium"
  ) =>
    sendAlert({
      title,
      message,
      severity:
        severity === "high"   ? "critical" :
        severity === "medium" ? "warning"  : "info",
      dedupeKey: `system-error:${title}`,
    }),

  gameTickSlow: (durationMs: number) =>
    alertCritical(
      "Game Tick Slow",
      `Game tick took ${durationMs}ms — expected <30000ms`,
      { durationMs, threshold: 30000, action: "Check DB load and Redis health" },
      "game-tick-slow"
    ),

  gameTickFailed: (error: string) =>
    alertCritical(
      "Game Tick Failed",
      "Game tick threw an unhandled error and may have stopped",
      { error, action: "Restart server immediately" },
      "game-tick-failed"
    ),

  backupFailed: (error: string) =>
    alertCritical(
      "Database Backup Failed",
      "Scheduled backup did not complete successfully",
      { error, action: "Run manual backup immediately" },
      "backup-failed"
    ),

  backupSucceeded: (fileSizeKb: number, durationMs: number) =>
    alertInfo(
      "Database Backup Succeeded",
      "Scheduled backup completed successfully",
      { fileSizeKb, durationMs },
      "backup-succeeded"
    ),

  highMemory: (usedMb: number, totalMb: number, percentUsed: number) =>
    alertCritical(
      "High Memory Usage",
      `Server memory at ${percentUsed}% — risk of OOM`,
      { usedMb, totalMb, percentUsed, action: "Investigate memory leaks or scale up" },
      "high-memory"
    ),

  highDisk: (usedGb: number, totalGb: number, percentUsed: number) =>
    alertCritical(
      "High Disk Usage",
      `Disk at ${percentUsed}% — risk of write failures`,
      { usedGb, totalGb, percentUsed, action: "Clear logs or expand disk" },
      "high-disk"
    ),

} as const;
