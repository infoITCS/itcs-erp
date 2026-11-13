import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { ProfileService } from "./service";
import type { UpdateProfileInput } from "./validation";

function meta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

function authContext(req: Request): { userId: string; organizationId: string } {
  if (!req.auth?.userId || !req.auth.organizationId) {
    throw new UnauthorizedError();
  }
  return { userId: req.auth.userId, organizationId: req.auth.organizationId };
}

export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  get = asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = authContext(req);
    const profile = await this.profileService.get(userId, organizationId);
    sendSuccess(res, { message: "Profile", data: profile });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = authContext(req);
    const body = req.validated?.body as UpdateProfileInput;
    const profile = await this.profileService.update(
      userId,
      organizationId,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Profile updated", data: profile });
  });

  updateAvatar = asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = authContext(req);
    const body = req.validated?.body as { dataUrl: string };
    const profile = await this.profileService.updateAvatar(
      userId,
      organizationId,
      body.dataUrl,
      meta(req),
    );
    sendSuccess(res, { message: "Profile photo updated", data: profile });
  });

  removeAvatar = asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = authContext(req);
    const profile = await this.profileService.removeAvatar(
      userId,
      organizationId,
      meta(req),
    );
    sendSuccess(res, { message: "Profile photo removed", data: profile });
  });
}
