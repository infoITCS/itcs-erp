import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../common/errors/app-error";

export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }

    const isAdministrator = req.auth.roles?.includes("admin") ?? false;
    const allowed =
      isAdministrator || required.every((code) => req.auth?.permissions.includes(code));
    if (!allowed) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}

export function requireAnyPermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }

    const isAdministrator = req.auth.roles?.includes("admin") ?? false;
    const allowed =
      isAdministrator || required.some((code) => req.auth?.permissions.includes(code));
    if (!allowed) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
