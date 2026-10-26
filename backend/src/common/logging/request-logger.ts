import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

const sensitiveQueryKeys = new Set([
  "access_token",
  "accesstoken",
  "client_secret",
  "code",
  "id_token",
  "idtoken",
  "password",
  "refresh_token",
  "refreshtoken",
  "session_state",
  "sessionstate",
  "state",
  "ticket",
  "token",
]);

export function redactRequestUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "http://localhost");
    let redacted = false;

    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveQueryKeys.has(key.toLowerCase())) {
        url.searchParams.set(key, "[REDACTED]");
        redacted = true;
      }
    }

    return redacted ? `${url.pathname}${url.search}` : rawUrl;
  } catch {
    return rawUrl.split("?")[0] ?? rawUrl;
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: redactRequestUrl(req.originalUrl),
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      "request",
    );
  });

  next();
}
