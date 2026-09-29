import pino from "pino";
import { env } from "../../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "password",
      "*.password",
      "body.password",
      "headers.authorization",
    ],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development" && process.stdout.isTTY
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});
