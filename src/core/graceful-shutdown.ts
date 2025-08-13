import { FastifyInstance } from "fastify";
import { pool } from "../config/database";
import { redis, pubClient, subClient } from "../config/redis";
import { logger } from "../utils/logger";

export function setupGracefulShutdown(server: FastifyInstance) {
  const signals = ["SIGINT", "SIGTERM"];
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    setTimeout(() => {
      logger.error("Graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, 30000);

    try {
      logger.info("Closing server connections...");
      await server.close();

      logger.info("Closing database connections...");
      await pool.end();

      logger.info("Closing Redis connections...");
      redis.disconnect();
      pubClient.disconnect();
      subClient.disconnect();

      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error(error, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  signals.forEach((signal) => {
    process.on(signal, () => shutdown(signal));
  });

  process.on("uncaughtException", (error) => {
    logger.fatal(error, "Uncaught exception");
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal({ reason, promise }, "Unhandled rejection");
    shutdown("unhandledRejection");
  });
}
