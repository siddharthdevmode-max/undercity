import { Express } from "express";
import swaggerUi from "swagger-ui-express";

// ============================================================
// API DOCUMENTATION
// Auto-generated OpenAPI spec served at /api/docs
// ============================================================

const apiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Undercity API",
    version: "1.0.0",
    description: "Crime-based MMO with UAC Anti-Cheat System v1.0",
  },
  servers: [
    { url: "http://localhost:5000", description: "Development" },
    { url: "https://api.undercity.game", description: "Production" },
  ],
  components: {
    securitySchemes: {
      FirebaseAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Basic health check",
        responses: { "200": { description: "Service is up" } },
      },
    },
    "/api/health/detailed": {
      get: {
        summary: "Deep system health check",
        responses: { "200": { description: "Full system status" } },
      },
    },
    "/api/crimes": {
      get: {
        summary: "List all crimes with user progress",
        security: [{ FirebaseAuth: [] }],
        responses: {
          "200": { description: "Crimes list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/crimes/attempt": {
      post: {
        summary: "Attempt a crime",
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
                properties: { crimeKey: { type: "string", example: "beg_for_change" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Crime outcome" },
          "400": { description: "Validation error" },
          "403": { description: "Access denied (UAC blocked)" },
          "423": { description: "In jail" },
          "429": { description: "Rate limited or cooldown" },
        },
      },
    },
    "/api/challenge": {
      get: {
        summary: "Get one-time challenge token for state-changing requests",
        security: [{ FirebaseAuth: [] }],
        responses: { "200": { description: "Challenge token (expires in 30s)" } },
      },
    },
  },
};

export function setupApiDocs(app: Express) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(apiSpec, {
    customSiteTitle: "Undercity API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  }));
  
  app.get("/api/docs.json", (req, res) => res.json(apiSpec));
}
