import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { VendorsService } from "./service";
import type { CreateVendorInput, UpdateVendorInput, VendorListQuery } from "./validation";

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

export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as VendorListQuery;
    const page = await this.vendorsService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Vendors", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.vendorsService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Vendor form options", data: options });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const vendor = await this.vendorsService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Vendor", data: vendor });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateVendorInput;
    const vendor = await this.vendorsService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Vendor created", data: vendor }, 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateVendorInput;
    const vendor = await this.vendorsService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Vendor updated", data: vendor });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.vendorsService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Vendor deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const vendor = await this.vendorsService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Vendor restored", data: vendor });
  });
}
