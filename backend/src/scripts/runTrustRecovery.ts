import path from "path";
import dotenv from "dotenv";

// Load .env FIRST before any other imports
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { runTrustRecovery } from "../services/trustRecovery";
import { logger } from "../utils/logger";

// ============================================================
// Run this script daily via cron:
// 0 3 * * * cd /app/backend && npx ts-node src/scripts/runTrustRecovery.ts
// ============================================================

async function main() {
  logger.info("🔄 Starting daily trust recovery...");
  const result = await runTrustRecovery();
  logger.info("🏁 Trust recovery finished", result);
  process.exit(0);
}

main().catch((err) => {
  logger.error("Trust recovery script crashed", { error: err });
  process.exit(1);
});
