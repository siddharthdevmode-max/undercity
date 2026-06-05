// ============================================================
// ALERT UTILITY
// Sends critical alerts to Discord/Slack webhooks
// Fire-and-forget — never blocks the request
// Only fires in production to avoid noise in dev
// ============================================================

import { logger } from "./logger";
import { config } from "../config";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertPayload {
  title:      string;
  message:    string;
  severity:   AlertSeverity;
  fields?:    Record<string, string | number | boolean>;
  requestId?: string;
}

// Severity → Discord colour (decimal)
const DISCORD_COLORS: Record<AlertSeverity, number> = {
  info:     0x3498db,  // blue
  warning:  0xf39c12,  // orange
  critical: 0xe74c3c,  // red
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info:     "ℹ️",
  warning:  "⚠️",
  critical: "🚨",
};

// ============================================================
// DISCORD ALERT
// ============================================================
async function sendDiscordAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
  if (!webhookUrl) return;

  const fields = payload.fields
    ? Object.entries(payload.fields).map(([name, value]) => ({
        name,
        value:  String(value),
        inline: true,
      }))
    : [];

  if (payload.requestId) {
    fields.push({ name: "Request ID", value: payload.requestId, inline: true });
  }

  fields.push({
    name:   "Environment",
    value:  config.nodeEnv,
    inline: true,
  });

  fields.push({
    name:   "Time",
    value:  new Date().toISOString(),
    inline: false,
  });

  const body = {
    embeds: [
      {
        title:       `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
        description: payload.message,
        color:       DISCORD_COLORS[payload.severity],
        fields,
        footer: { text: "Undercity UAC Alert System" },
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    logger.warn("⚠️  Discord alert failed", { status: response.status });
  }
}

// ============================================================
// SLACK ALERT
// ============================================================
async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_ALERT_WEBHOOK;
  if (!webhookUrl) return;

  const fields = payload.fields
    ? Object.entries(payload.fields)
        .map(([k, v]) => `*${k}:* ${v}`)
        .join("\n")
    : "";

  const text = [
    `${SEVERITY_EMOJI[payload.severity]} *${payload.title}*`,
    payload.message,
    fields,
    `_Environment: ${config.nodeEnv} | ${new Date().toISOString()}_`,
  ]
    .filter(Boolean)
    .join("\n");

  const body = {
    text,
    username:   "Undercity Alerts",
    icon_emoji: payload.severity === "critical" ? ":rotating_light:" : ":warning:",
  };

  const response = await fetch(webhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    logger.warn("⚠️  Slack alert failed", { status: response.status });
  }
}

// ============================================================
// MAIN ALERT FUNCTION
// Sends to all configured channels simultaneously
// Never throws — swallows errors to avoid affecting app
// Only alerts in production (or if FORCE_ALERTS=true)
// ============================================================
export function sendAlert(payload: AlertPayload): void {
  const forceAlerts = process.env.FORCE_ALERTS === "true";

  if (!config.isProduction && !forceAlerts) return;

  // Log locally always
  const logFn =
    payload.severity === "critical" ? logger.error.bind(logger)
    : payload.severity === "warning" ? logger.warn.bind(logger)
    : logger.info.bind(logger);

  logFn(`🔔 ALERT [${payload.severity.toUpperCase()}]: ${payload.title}`, {
    message: payload.message,
    ...payload.fields,
  });

  // Fire and forget to all channels
  Promise.allSettled([
    sendDiscordAlert(payload),
    sendSlackAlert(payload),
  ]).catch(() => {
    // allSettled never rejects but TypeScript doesn't know that
  });
}

// ============================================================
// CONVENIENCE HELPERS
// ============================================================

export function alertCritical(
  title:   string,
  message: string,
  fields?: Record<string, string | number | boolean>
): void {
  sendAlert({ title, message, severity: "critical", fields });
}

export function alertWarning(
  title:   string,
  message: string,
  fields?: Record<string, string | number | boolean>
): void {
  sendAlert({ title, message, severity: "warning", fields });
}

export function alertInfo(
  title:   string,
  message: string,
  fields?: Record<string, string | number | boolean>
): void {
  sendAlert({ title, message, severity: "info", fields });
}

// ============================================================
// PRE-BUILT ALERT TEMPLATES
// Use these throughout the codebase for consistency
// ============================================================

export const Alerts = {

  hardBan: (uid: string, reason: string, ip?: string) =>
    alertCritical("User Hard Banned", `UID: ${uid.substring(0, 8)}...`, {
      reason,
      ip:          ip ?? "unknown",
      action:      "Firebase session revoked + IP blacklisted",
    }),

  massViolation: (uid: string, violationType: string, count: number) =>
    alertWarning("Mass UAC Violation", `User triggering repeated violations`, {
      uid:            uid.substring(0, 8),
      violationType,
      violationCount: count,
    }),

  dbPoolExhausted: (waiting: number, total: number) =>
    alertCritical("DB Pool Exhausted", "All database connections in use", {
      waiting,
      total,
      action: "Scale up DB connections or investigate slow queries",
    }),

  honeypotTriggered: (uid: string, path: string, ip?: string) =>
    alertCritical("Honeypot Triggered", "User accessed honeypot endpoint", {
      uid:  uid.substring(0, 8),
      path,
      ip:   ip ?? "unknown",
    }),

  highErrorRate: (errorCount: number, windowMinutes: number) =>
    alertCritical("High Error Rate", "Server error rate is elevated", {
      errors:     errorCount,
      windowMins: windowMinutes,
      action:     "Check Sentry for details",
    }),

  serverStarted: (port: number, env: string) =>
    alertInfo("Server Started", `Undercity backend is online`, {
      port,
      environment: env,
    }),

  gracefulShutdown: (signal: string) =>
    alertWarning("Server Shutting Down", `Received ${signal}`, {
      signal,
      action: "Graceful shutdown in progress",
    }),

} as const;
