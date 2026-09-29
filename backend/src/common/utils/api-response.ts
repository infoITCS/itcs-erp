import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  body: { message: string; data?: T },
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    ...(body.data !== undefined ? { data: body.data } : {}),
    message: body.message,
  });
}
