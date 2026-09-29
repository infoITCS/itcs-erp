import { createApp } from "./app";
import { logger } from "./common/logging";
import { disconnectDatabase } from "./config/database";
import { env } from "./config/env";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "ERP API listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    disconnectDatabase()
      .catch((error: unknown) => {
        logger.error({ err: error }, "database disconnect failed");
      })
      .finally(() => {
        process.exit(0);
      });
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
