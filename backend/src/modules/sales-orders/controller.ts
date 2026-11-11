import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { SalesOrdersService } from "./service";
import type {
  ChangeSalesOrderStatusInput,
  ConvertSalesOrderInput,
  CreateSalesOrderInput,
  SalesOrderListQuery,
  UpdateSalesOrderInput,
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

export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as SalesOrderListQuery;
    const page = await this.salesOrdersService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Sales orders", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.salesOrdersService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Sales order form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateSalesOrderInput;
    const order = await this.salesOrdersService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Sales order created", data: order }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const order = await this.salesOrdersService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Sales order", data: order });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateSalesOrderInput;
    const order = await this.salesOrdersService.update(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Sales order updated", data: order });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.salesOrdersService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Sales order deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const order = await this.salesOrdersService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Sales order restored", data: order });
  });

  changeStatus = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ChangeSalesOrderStatusInput;
    const order = await this.salesOrdersService.changeStatus(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Sales order status updated", data: order });
  });

  convertToInvoice = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ConvertSalesOrderInput;
    const result = await this.salesOrdersService.convertToInvoice(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Invoice created", data: result }, 201);
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.salesOrdersService.listAudit(
      organizationId(req),
      params.id,
      query.limit,
      query.cursor,
    );
    sendSuccess(res, { message: "Sales order audit log", data: page });
  });
}
