import { createApp } from "./app";
import { logger } from "./common/logging";
import { disconnectDatabase, prisma } from "./config/database";
import { env } from "./config/env";
import { syncRbacCatalog } from "./modules/permissions/bootstrap";

async function start(): Promise<void> {
  await syncRbacCatalog(prisma);

  const app = createApp();

  // Azure App Service expects the process to listen on 0.0.0.0:$PORT
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "ERP API listening");
  });

  const shutdown = (signal: string): void => {
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
  };

  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}

start().catch((error: unknown) => {
  logger.error({ err: error }, "failed to start ERP API");
  process.exit(1);
});
