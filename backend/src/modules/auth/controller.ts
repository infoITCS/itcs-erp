import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import { env } from "../../config/env";
import { MICROSOFT_STATE_COOKIE, type MicrosoftAuthService } from "./microsoft";
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

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

const stateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProduction,
  path: "/api/v1/auth/microsoft",
};

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly microsoftAuth: MicrosoftAuthService,
  ) {}

  providers = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { message: "Sign-in providers", data: this.microsoftAuth.providers() });
  });

  microsoftStart = asyncHandler(async (_req: Request, res: Response) => {
    const { url, state } = this.microsoftAuth.begin();
    res.cookie(MICROSOFT_STATE_COOKIE, state, {
      ...stateCookieOptions,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(url);
  });

  microsoftCallback = asyncHandler(async (req: Request, res: Response) => {
    const state = readCookie(req, MICROSOFT_STATE_COOKIE);
    res.clearCookie(MICROSOFT_STATE_COOKIE, stateCookieOptions);
    const target = await this.microsoftAuth.completeCallback(req.originalUrl, state, meta(req));
    res.redirect(target);
  });

  microsoftExchange = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as { ticket: string };
    try {
      const session = this.microsoftAuth.exchangeTicket(body.ticket);
      sendSuccess(res, { message: "Signed in with Microsoft", data: session });
    } catch {
      throw new UnauthorizedError("Microsoft sign-in link expired. Please try again.");
    }
  });

  logoutAll = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      throw new UnauthorizedError();
    }
    await this.authService.logoutAll(req.auth.userId);
    sendSuccess(res, { message: "All sessions signed out" });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      throw new UnauthorizedError();
    }
    const body = req.validated?.body as { currentPassword: string; newPassword: string };
    await this.authService.changePassword(
      req.auth.userId,
      body.currentPassword,
      body.newPassword,
      meta(req),
    );
    sendSuccess(res, { message: "Password updated" });
  });

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
