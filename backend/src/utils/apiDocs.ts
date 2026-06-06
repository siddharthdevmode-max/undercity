import { Express, Request, Response } from "express";
import { config } from "../config";
import { logger } from "./logger";

export function setupApiDocs(app: Express): void {
  if (!config.features.enableApiDocs) {
    logger.debug("API docs disabled");
    return;
  }

  // Serve a simple JSON spec — no swagger-ui-express needed
  app.get("/api/docs", (_req: Request, res: Response) => {
    res.json({
      openapi: "3.0.0",
      info: {
        title:       "Undercity API",
        version:     "1.0.0",
        description: "Undercity game backend API — full docs coming soon"
      },
      servers: [{ url: "/api/v1" }],
      paths:   {}
    });
  });

  logger.info("API docs available at /api/docs");
}
