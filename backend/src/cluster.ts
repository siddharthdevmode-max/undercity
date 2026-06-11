import cluster from "cluster";
import os       from "os";
import { logger } from "./utils/logger";

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  logger.info(`Primary ${process.pid} starting ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died`, { code, signal });
    cluster.fork();
  });

  cluster.on("online", (worker) => {
    logger.debug(`Worker ${worker.process.pid} online`);
  });
} else {
  import("./server");
}
