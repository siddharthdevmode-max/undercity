import { Resend } from "resend";
import { logger } from "../utils/logger";

// ============================================================
// EMAIL SERVICE — UNDERCITY
// Provider: Resend (resend.com)
// Templates: Welcome, Security Alert, Purchase Confirm
// ============================================================

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@undercity.app";
const GAME_NAME  = "Undercity";

if (!resend) {
  logger.warn("⚠️  RESEND_API_KEY not set — emails disabled");
}

async function sendEmail(opts: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<boolean> {
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
    });

    if (error) {
      logger.error("📧 Email send failed", { error, to: opts.to });
      return false;
    }

    logger.info("📧 Email sent", { to: opts.to, subject: opts.subject });
    return true;
  } catch (err) {
    logger.error("📧 Email exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ── Email Templates ────────────────────────────────────────

export const EmailService = {

  async sendWelcome(opts: {
    to:       string;
    username: string;
  }): Promise<boolean> {
    return sendEmail({
      to:      opts.to,
      subject: `Welcome to ${GAME_NAME}, ${opts.username}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;">
          <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #333;border-radius:8px;padding:40px;">
            <h1 style="color:#e63946;letter-spacing:4px;">UNDERCITY</h1>
            <h2>Welcome, ${opts.username}.</h2>
            <p style="color:#ccc;line-height:1.6;">
              You've entered the Undercity. Start as a nobody.<br/>
              Hustle, fight, and steal your way to the top.<br/>
              Build your empire. Leave your legacy.
            </p>
            <a href="https://undercity.app/home"
               style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;margin-top:20px;letter-spacing:2px;">
              ENTER THE CITY →
            </a>
            <p style="color:#666;font-size:12px;margin-top:40px;">
              You're receiving this because you registered at undercity.app.<br/>
              © ${new Date().getFullYear()} Undercity. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });
  },

  async sendSecurityAlert(opts: {
    to:       string;
    username: string;
    event:    string;
    ip?:      string;
  }): Promise<boolean> {
    return sendEmail({
      to:      opts.to,
      subject: `Security Alert — ${GAME_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;">
          <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #ff4444;border-radius:8px;padding:40px;">
            <h1 style="color:#e63946;">⚠️ Security Alert</h1>
            <p>Hello <strong>${opts.username}</strong>,</p>
            <p style="color:#ccc;">
              We detected the following security event on your account:
            </p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:20px;margin:20px 0;">
              <strong style="color:#e63946;">${opts.event}</strong>
              ${opts.ip ? `<br/><span style="color:#666;font-size:12px;">IP: ${opts.ip}</span>` : ""}
            </div>
            <p style="color:#ccc;">
              If this wasn't you, secure your account immediately.
            </p>
            <a href="https://undercity.app/settings"
               style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
              SECURE MY ACCOUNT →
            </a>
          </div>
        </body>
        </html>
      `,
    });
  },

  async sendPurchaseConfirm(opts: {
    to:       string;
    username: string;
    points:   number;
    packName: string;
    amount:   number;
  }): Promise<boolean> {
    return sendEmail({
      to:      opts.to,
      subject: `Purchase Confirmed — ${opts.points} Points Added`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;">
          <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #333;border-radius:8px;padding:40px;">
            <h1 style="color:#e63946;">UNDERCITY</h1>
            <h2>✅ Purchase Confirmed</h2>
            <p>Hello <strong>${opts.username}</strong>,</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:20px;margin:20px 0;">
              <p style="margin:0;"><strong>${opts.packName}</strong></p>
              <p style="margin:4px 0;color:#e63946;font-size:24px;font-weight:bold;">
                +${opts.points} Points
              </p>
              <p style="margin:0;color:#666;">
                $${(opts.amount / 100).toFixed(2)} USD
              </p>
            </div>
            <p style="color:#ccc;">
              Your points have been added to your account instantly.
            </p>
            <a href="https://undercity.app/home"
               style="display:inline-block;background:#e63946;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;">
              PLAY NOW →
            </a>
          </div>
        </body>
        </html>
      `,
    });
  },
};
