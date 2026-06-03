import { Express } from "express";
import swaggerUi from "swagger-ui-express";

// ============================================================
// API DOCUMENTATION (Swagger / OpenAPI 3.0)
// Documents user-facing endpoints only.
// Admin & honeypot routes are intentionally hidden.
// ============================================================

const apiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Undercity API",
    version: "1.0.0",
    description:
      "Crime-based MMO API. Includes UAC Anti-Cheat v1.0 with challenge tokens, trust scoring, and behavioral analysis.",
    contact: {
      name: "Challenger_69",
    },
  },
  servers: [
    { url: "http://localhost:5000", description: "Development" },
    { url: "https://api.undercity.online", description: "Production (future)" },
  ],
  tags: [
    { name: "Health", description: "Service health & monitoring" },
    { name: "Auth", description: "User authentication & profile" },
    { name: "Stats", description: "Public game statistics" },
    { name: "Challenge", description: "UAC anti-cheat challenge tokens" },
    { name: "Crimes", description: "Crime gameplay endpoints" },
  ],
  components: {
    securitySchemes: {
      FirebaseAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Firebase ID token from frontend",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: { type: "string" },
          code: { type: "string" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer" },
          firebase_uid: { type: "string" },
          email: { type: "string" },
          username: { type: "string" },
          level: { type: "integer" },
          money: { type: "integer" },
          points: { type: "integer" },
          nerve: { type: "integer" },
          max_nerve: { type: "integer" },
          life: { type: "integer" },
          max_life: { type: "integer" },
          jail_until: { type: "string", nullable: true },
          federal_jail_until: { type: "string", nullable: true },
          last_crime_at: { type: "string", nullable: true },
        },
      },
      Crime: {
        type: "object",
        properties: {
          id: { type: "integer" },
          key: { type: "string", example: "beg_for_change" },
          name: { type: "string" },
          tier: { type: "integer" },
          unlockLevel: { type: "integer" },
          nerveCost: { type: "integer" },
          minReward: { type: "integer" },
          maxReward: { type: "integer" },
          isFederal: { type: "boolean" },
          unlocked: { type: "boolean" },
        },
      },
      CrimeOutcome: {
        type: "object",
        properties: {
          outcome: {
            type: "string",
            enum: ["special", "success", "fail", "crit_fail"],
          },
          message: { type: "string" },
          rewards: {
            type: "object",
            properties: {
              money: { type: "integer" },
              points: { type: "integer" },
              xpGained: { type: "integer" },
            },
          },
          penalties: {
            type: "object",
            properties: {
              moneyLost: { type: "integer" },
              lifeLost: { type: "integer" },
              xpLost: { type: "integer" },
              jailSeconds: { type: "integer" },
              jailType: { type: "string", nullable: true, enum: ["normal", "federal"] },
            },
          },
        },
      },
    },
  },
  paths: {
    // ─────────── HEALTH ───────────
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Basic health check (for load balancers)",
        responses: {
          "200": {
            description: "Service is up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/health/detailed": {
      get: {
        tags: ["Health"],
        summary: "Deep system health (DB + Redis latency, memory, uptime)",
        responses: {
          "200": { description: "All systems operational" },
          "503": { description: "One or more services degraded" },
        },
      },
    },

    // ─────────── AUTH ───────────
    "/api/auth/sync": {
      post: {
        tags: ["Auth"],
        summary: "Create user on first login or return existing user",
        description:
          "Strict rate limit: 5 req per 15min per IP. Username required only for new accounts.",
        security: [{ FirebaseAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: {
                    type: "string",
                    minLength: 3,
                    maxLength: 20,
                    pattern: "^[a-zA-Z0-9_]+$",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Existing user returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "201": {
            description: "New user created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Invalid Firebase token" },
          "409": { description: "Username already taken" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user profile",
        description: "Lenient rate limit: 120 req/min per user.",
        security: [{ FirebaseAuth: [] }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "401": { description: "Invalid Firebase token" },
          "404": { description: "User not found in database" },
        },
      },
    },
    "/api/auth/check-username/{username}": {
      get: {
        tags: ["Auth"],
        summary: "Check if username is available (public)",
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Availability result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    available: { type: "boolean" },
                    reason: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          "429": { description: "Too many checks (20/min per IP)" },
        },
      },
    },

    // ─────────── STATS ───────────
    "/api/stats/live": {
      get: {
        tags: ["Stats"],
        summary: "Live player activity stats (public)",
        description: "Rate limited: 30 req/min per IP",
        responses: {
          "200": {
            description: "Live stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    onlineNow: { type: "integer" },
                    last3Hours: { type: "integer" },
                    last24Hours: { type: "integer" },
                    attacks24h: { type: "integer" },
                    crimes24h: { type: "integer" },
                    casino24h: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─────────── CHALLENGE ───────────
    "/api/challenge": {
      get: {
        tags: ["Challenge"],
        summary: "Get a one-time UAC challenge token",
        description:
          "Required for all POST/PUT/DELETE requests. Token expires in 30 seconds and can only be used once.",
        security: [{ FirebaseAuth: [] }],
        responses: {
          "200": {
            description: "Challenge token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { token: { type: "string" } },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Account hard-banned" },
          "429": { description: "Too many requests (60/min)" },
        },
      },
    },

    // ─────────── CRIMES ───────────
    "/api/crimes": {
      get: {
        tags: ["Crimes"],
        summary: "List all crimes with user progress",
        security: [{ FirebaseAuth: [] }],
        responses: {
          "200": {
            description: "Crimes list with user state",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    crimes: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Crime" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Account hard-banned" },
        },
      },
    },
    "/api/crimes/attempt": {
      post: {
        tags: ["Crimes"],
        summary: "Attempt a crime",
        description:
          "Requires valid UAC challenge token in header. Rate limited to 30 req/min per user.",
        security: [{ FirebaseAuth: [] }],
        parameters: [
          {
            name: "x-uac-challenge",
            in: "header",
            required: true,
            description: "One-time challenge token from /api/challenge",
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["crimeKey"],
                properties: {
                  crimeKey: {
                    type: "string",
                    pattern: "^[a-z0-9_]+$",
                    example: "beg_for_change",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Crime outcome",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CrimeOutcome" },
              },
            },
          },
          "400": { description: "Validation error or insufficient nerve" },
          "401": { description: "Unauthorized" },
          "403": {
            description: "UAC blocked, level too low, or account banned",
          },
          "404": { description: "Crime not found" },
          "423": { description: "Currently in jail" },
          "429": { description: "Rate limited or cooldown active" },
        },
      },
    },
  },
};

export function setupApiDocs(app: Express) {
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(apiSpec, {
      customSiteTitle: "Undercity API Docs",
      customCss: ".swagger-ui .topbar { display: none }",
    })
  );

  app.get("/api/docs.json", (_req, res) => res.json(apiSpec));
}
