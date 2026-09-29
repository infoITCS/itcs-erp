import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./common/errors";
import { requestLogger } from "./common/logging";
import { corsOptions } from "./config/cors";
import { prisma, readPrisma } from "./config/database";
import { env } from "./config/env";
import { apiRateLimiter } from "./middleware/rate-limit";
import { requestContext } from "./middleware/request-context";
import { createModules } from "./modules/registry";
import { healthRouter } from "./routes/health.routes";

export function createApp(): express.Express {
  const app = express();

  if (env.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);
  app.use(requestLogger);

  const v1 = express.Router();
  v1.use(apiRateLimiter);
  v1.use(healthRouter);

  for (const appModule of createModules({ db: prisma, readDb: readPrisma })) {
    v1.use(appModule.basePath, appModule.router);
  }

  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
