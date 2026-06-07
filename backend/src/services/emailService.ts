// ============================================================
// EMAIL SERVICE — UNDERCITY
// ============================================================

import { Resend }  from "resend";
import { logger }  from "../utils/logger";
import type { EmailJob, PaymentWebhookJob } from "../queues/index";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@undercity.online";
const GAME_NAME  = "Undercity";

if (!resend) {
  logger.warn("⚠️  RESEND_API_KEY not set — emails disabled");
}

// ── Core send (exported for workers.ts) ───────────────────
export async function sendEmail(job: EmailJob): Promise<boolean> {
  if (!resend) return false;

  let subject = "";
  let html    = "";

  switch (job.type) {
    case "welcome":
      subject = `Welcome to ${GAME_NAME}, ${job.username}!`;
      html    = welcomeHtml(job.username);
      break;
    case "security_alert":
      subject = `Security Alert — ${GAME_NAME}`;
      html    = securityAlertHtml(job.username, job.event, job.ip);
      break;
    case "purchase_confirm":
      subject = `Purchase Confirmed — ${job.points} Points Added`;
      html    = purchaseHtml(job.username, job.points, job.packName, job.amountCents);
      break;
    case "ban_notice":
      subject = `Account Notice — ${GAME_NAME}`;
      html    = banNoticeHtml(job.username, job.reason, job.expiresAt);
      break;
    case "email_verify":
      subject = `Verify your email — ${GAME_NAME}`;
      html    = verifyHtml(job.username, job.link);
      break;
    case "password_reset":
      subject = `Reset your password — ${GAME_NAME}`;
      html    = resetHtml(job.username, job.link);
      break;
    case "support_reply":
      subject = `Support Reply — Ticket #${job.ticketId}`;
      html    = supportReplyHtml(job.username, job.ticketId, job.message);
      break;
    default:
      logger.warn("📧 Unknown email job type", { job });
      return false;
  }

  try {
    const { error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      job.to,
      subject,
      html,
    });

    if (error) {
      logger.error("📧 Email send failed", { error, to: job.to });
      return false;
    }

    logger.info("📧 Email sent", { to: job.to, type: job.type });
    return true;
  } catch (err) {
    logger.error("📧 Email exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ── Stripe webhook processor (exported for workers.ts) ────
export async function processStripeWebhook(job: PaymentWebhookJob): Promise<void> {
  logger.info("💳 Processing Stripe webhook", {
    eventId:   job.stripeEventId,
    eventType: job.stripeEventType,
  });

  // TODO: implement full Stripe webhook handling
  // For now: log and acknowledge — prevents worker crash
  switch (job.stripeEventType) {
    case "checkout.session.completed":
      logger.info("💳 Checkout session completed", { eventId: job.stripeEventId });
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      logger.info("💳 Subscription event", {
        type:    job.stripeEventType,
        eventId: job.stripeEventId,
      });
      break;
    case "customer.subscription.deleted":
      logger.info("💳 Subscription cancelled", { eventId: job.stripeEventId });
      break;
    case "invoice.payment_failed":
      logger.warn("💳 Invoice payment failed", { eventId: job.stripeEventId });
      break;
    default:
      logger.debug("💳 Unhandled Stripe event", { type: job.stripeEventType });
  }
}

// ── HTML Templates ────────────────────────────────────────

function baseHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #333;border-radius:8px;padding:40px;">
    <h1 style="color:#e63946;letter-spacing:4px;">UNDERCITY</h1>
    ${content}
    <p style="color:#666;font-size:12px;margin-top:40px;">
      © ${new Date().getFullYear()} Undercity. All rights reserved.
    </p>
  </div>
</body>
</html>`;
}

function welcomeHtml(username: string): string {
  return baseHtml(`
    <h2>Welcome, ${username}.</h2>
    <p style="color:#ccc;line-height:1.6;">
      You've entered the Undercity. Start as a nobody.<br/>
      Hustle, fight, and steal your way to the top.
    </p>
    <a href="https://undercity.online/home"
       style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;margin-top:20px;">
      ENTER THE CITY →
    </a>
  `);
}

function securityAlertHtml(username: string, event: string, ip?: string): string {
  return baseHtml(`
    <h1 style="color:#e63946;">⚠️ Security Alert</h1>
    <p>Hello <strong>${username}</strong>,</p>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:20px;margin:20px 0;">
      <strong style="color:#e63946;">${event}</strong>
      ${ip ? `<br/><span style="color:#666;font-size:12px;">IP: ${ip}</span>` : ""}
    </div>
    <p style="color:#ccc;">If this wasn't you, secure your account immediately.</p>
    <a href="https://undercity.online/settings"
       style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
      SECURE MY ACCOUNT →
    </a>
  `);
}

function purchaseHtml(username: string, points: number, packName: string, amountCents: number): string {
  return baseHtml(`
    <h2>✅ Purchase Confirmed</h2>
    <p>Hello <strong>${username}</strong>,</p>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:20px;margin:20px 0;">
      <p style="margin:0;"><strong>${packName}</strong></p>
      <p style="margin:4px 0;color:#e63946;font-size:24px;font-weight:bold;">+${points} Points</p>
      <p style="margin:0;color:#666;">$${(amountCents / 100).toFixed(2)} USD</p>
    </div>
    <a href="https://undercity.online/home"
       style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
      PLAY NOW →
    </a>
  `);
}

function banNoticeHtml(username: string, reason: string, expiresAt?: string): string {
  return baseHtml(`
    <h2>⛔ Account Notice</h2>
    <p>Hello <strong>${username}</strong>,</p>
    <p style="color:#ccc;">Your account has been restricted.</p>
    <div style="background:#1a1a1a;border:1px solid #e63946;border-radius:4px;padding:20px;margin:20px 0;">
      <strong>Reason:</strong> ${reason}<br/>
      ${expiresAt ? `<strong>Expires:</strong> ${new Date(expiresAt).toUTCString()}` : "<strong>Duration:</strong> Permanent"}
    </div>
    <p style="color:#ccc;">To appeal, contact support.</p>
  `);
}

function verifyHtml(username: string, link: string): string {
  return baseHtml(`
    <h2>Verify your email</h2>
    <p>Hello <strong>${username}</strong>, click below to verify your email.</p>
    <a href="${link}"
       style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
      VERIFY EMAIL →
    </a>
  `);
}

function resetHtml(username: string, link: string): string {
  return baseHtml(`
    <h2>Reset your password</h2>
    <p>Hello <strong>${username}</strong>, click below to reset your password.</p>
    <a href="${link}"
       style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
      RESET PASSWORD →
    </a>
    <p style="color:#666;font-size:12px;">This link expires in 1 hour.</p>
  `);
}

function supportReplyHtml(username: string, ticketId: string, message: string): string {
  return baseHtml(`
    <h2>Support Reply — Ticket #${ticketId}</h2>
    <p>Hello <strong>${username}</strong>,</p>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:20px;margin:20px 0;">
      ${message}
    </div>
    <a href="https://undercity.online/support"
       style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
      VIEW TICKET →
    </a>
  `);
}

// ── Legacy EmailService object (backwards compat) ─────────
export const EmailService = {
  sendWelcome:        (opts: { to: string; username: string }) =>
    sendEmail({ type: "welcome", ...opts }),
  sendSecurityAlert:  (opts: { to: string; username: string; event: string; ip?: string }) =>
    sendEmail({ type: "security_alert", ...opts }),
  sendPurchaseConfirm: (opts: { to: string; username: string; points: number; packName: string; amountCents: number }) =>
    sendEmail({ type: "purchase_confirm", ...opts }),
};
