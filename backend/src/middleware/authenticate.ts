import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../common/errors/app-error";
import { verifyAccessToken } from "../modules/auth/tokens";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError());
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  const auth = verifyAccessToken(token);
  if (!auth) {
    next(new UnauthorizedError("Invalid or expired token"));
    return;
  }

  req.auth = auth;
  next();
}
