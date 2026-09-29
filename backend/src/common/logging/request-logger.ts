import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      "request",
    );
  });

  next();
}
