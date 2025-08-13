import { createServer } from "./core/server";
import { config } from "./config/environment";
import { pool } from "./config/database";
import { redis } from "./config/redis";
import { setupGracefulShutdown } from "./core/graceful-shutdown";
import { logger } from "./utils/logger";

async function start() {
  try {
    await pool.query("SELECT 1");
    logger.info("Database connected");

    await redis.ping();
    logger.info("Redis connected");

    const server = await createServer();

    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`Server running at http://${config.HOST}:${config.PORT}`);
    logger.info(
      `API docs available at http://${config.HOST}:${config.PORT}/docs`
    );

    setupGracefulShutdown(server);
  } catch (error) {
    logger.error(error, "Failed to start server");
    process.exit(1);
  }
}

start();
