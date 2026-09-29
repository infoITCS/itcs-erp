import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { CreateExchangeRateInput, CurrenciesService } from "./service";

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  list = asyncHandler(async (_req: Request, res: Response) => {
    const currencies = await this.currenciesService.list();
    sendSuccess(res, { message: "Currencies", data: currencies });
  });

  rate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const query = req.validated?.query as { base: string; quote: string; asOf: string };
    const rate = await this.currenciesService.effectiveRate(
      req.auth.organizationId,
      query.base,
      query.quote,
      query.asOf,
    );
    sendSuccess(res, { message: "Exchange rate", data: rate });
  });

  createRate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId || !req.auth.userId) {
      throw new UnauthorizedError();
    }
    const body = req.validated?.body as CreateExchangeRateInput;
    const rate = await this.currenciesService.createRate(req.auth.organizationId, req.auth.userId, body, meta(req));
    sendSuccess(res, { message: "Exchange rate created", data: rate }, 201);
  });
}
