import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { RequestMeta } from "../auth/types";
import type { CreateUserInput, UpdateUserInput, UserListInput, UsersService } from "./service";
import type { AccountStatus } from "@prisma/client";

function meta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as UserListInput;
    const page = await this.usersService.list(organizationId(req), query);
    sendSuccess(res, { message: "Users", data: page });
  });

  stats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.usersService.stats(organizationId(req));
    sendSuccess(res, { message: "User statistics", data: stats });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const user = await this.usersService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "User", data: user });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateUserInput;
    const user = await this.usersService.create(organizationId(req), req.auth?.userId ?? "", body, meta(req));
    sendSuccess(res, { message: "User created", data: user }, 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateUserInput;
    const user = await this.usersService.update(
      organizationId(req),
      req.auth?.userId ?? "",
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "User updated", data: user });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as { status: AccountStatus };
    const user = await this.usersService.updateStatus(
      organizationId(req),
      req.auth?.userId ?? "",
      params.id,
      body.status,
      meta(req),
    );
    sendSuccess(res, { message: "User status updated", data: user });
  });

  deactivate = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    await this.usersService.deactivate(
      organizationId(req),
      req.auth?.userId ?? "",
      params.id,
      meta(req),
    );
    sendSuccess(res, { message: "User access removed" });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as { newPassword: string };
    const user = await this.usersService.resetPassword(
      organizationId(req),
      req.auth?.userId ?? "",
      params.id,
      body.newPassword,
      meta(req),
    );
    sendSuccess(res, { message: "Password reset", data: user });
  });
}
