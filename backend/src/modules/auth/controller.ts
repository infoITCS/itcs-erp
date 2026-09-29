import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { AuthService } from "./service";
import type {
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  RefreshInput,
  RequestMeta,
} from "./types";

function meta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as LoginInput;
    const result = await this.authService.login(body, meta(req));
    sendSuccess(res, { message: "Signed in", data: result });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as RefreshInput;
    const result = await this.authService.refresh(body.refreshToken, meta(req));
    sendSuccess(res, { message: "Session refreshed", data: result });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as RefreshInput;
    await this.authService.logout(body.refreshToken);
    sendSuccess(res, { message: "Signed out" });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, {
      message: "Current session",
      data: req.auth ?? null,
    });
  });

  requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as PasswordResetRequestInput;
    await this.authService.requestPasswordReset(body.email, meta(req));
    sendSuccess(res, {
      message: "If an account exists for that email, a reset token was created",
    });
  });

  confirmPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as PasswordResetConfirmInput;
    await this.authService.confirmPasswordReset(body, meta(req));
    sendSuccess(res, { message: "Password updated" });
  });
}
