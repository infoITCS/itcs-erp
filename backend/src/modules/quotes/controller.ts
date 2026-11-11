import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { QuotesService } from "./service";
import type {
  ChangeQuoteStatusInput,
  ConvertQuoteInput,
  CreateQuoteInput,
  QuoteListQuery,
  UpdateQuoteInput,
} from "./validation";

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

function actorId(req: Request): string {
  if (!req.auth?.userId) {
    throw new UnauthorizedError();
  }
  return req.auth.userId;
}

export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as QuoteListQuery;
    const page = await this.quotesService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Quotes", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.quotesService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Quote form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateQuoteInput;
    const quote = await this.quotesService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Quote created", data: quote }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const quote = await this.quotesService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Quote", data: quote });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateQuoteInput;
    const quote = await this.quotesService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Quote updated", data: quote });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.quotesService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Quote deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const quote = await this.quotesService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Quote restored", data: quote });
  });

  changeStatus = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ChangeQuoteStatusInput;
    const quote = await this.quotesService.changeStatus(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Quote status updated", data: quote });
  });

  convertToOrder = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ConvertQuoteInput;
    const result = await this.quotesService.convertToOrder(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Sales order created", data: result }, 201);
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.quotesService.listAudit(organizationId(req), params.id, query.limit, query.cursor);
    sendSuccess(res, { message: "Quote audit log", data: page });
  });
}
