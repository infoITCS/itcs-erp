import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../logging/logger";
import { AppError } from "./app-error";

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    const messages = errors[field] ?? [];
    messages.push(issue.message);
    errors[field] = messages;
  }

  return errors;
}

function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors?: Record<string, string[]>,
): void {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    sendError(res, 400, "Validation failed", zodFieldErrors(error));
    return;
  }

  if (error instanceof AppError) {
    if (!error.isOperational) {
      logger.error({ err: error, requestId: req.requestId }, error.message);
    }
    sendError(res, error.statusCode, error.message, error.errors);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ err: error, requestId: req.requestId, code: error.code }, "database request failed");
    if (error.code === "P2002") {
      sendError(res, 409, "A record with this value already exists");
      return;
    }
    if (error.code === "P2025") {
      sendError(res, 404, "Resource not found");
      return;
    }
    sendError(res, 400, "The request could not be completed");
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error({ err: error, requestId: req.requestId }, "invalid database query");
    sendError(res, 400, "The request could not be completed");
    return;
  }

  if (error instanceof SyntaxError && "status" in error && (error as { status?: number }).status === 400) {
    sendError(res, 400, "Request body must be valid JSON");
    return;
  }

  logger.error({ err: error, requestId: req.requestId }, "unhandled error");
  sendError(res, 500, "Internal server error");
}
