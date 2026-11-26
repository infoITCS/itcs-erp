import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { InventoryService } from "./service";
import type { CreateAdjustmentInput, MovementQuery, StockQuery } from "./validation";

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

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  stock = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as StockQuery;
    const page = await this.inventoryService.stock(organizationId(req), query);
    sendSuccess(res, { message: "Inventory stock", data: page });
  });

  movements = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as MovementQuery;
    const page = await this.inventoryService.movements(organizationId(req), query);
    sendSuccess(res, { message: "Inventory movements", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.inventoryService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Inventory form options", data: options });
  });

  adjust = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateAdjustmentInput;
    const result = await this.inventoryService.adjust(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Inventory adjusted", data: result }, 201);
  });
}
