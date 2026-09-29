import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationFailedError } from "../errors/app-error";
import { zodFieldErrors } from "../errors/error-handler";

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates the request before it reaches a controller.
 * Parsed values are stored on `req.validated` so controllers stay free of parsing.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validated: Request["validated"] = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        next(new ValidationFailedError(zodFieldErrors(result.error)));
        return;
      }
      validated.body = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        next(new ValidationFailedError(zodFieldErrors(result.error)));
        return;
      }
      validated.query = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        next(new ValidationFailedError(zodFieldErrors(result.error)));
        return;
      }
      validated.params = result.data;
    }

    req.validated = validated;
    next();
  };
}
