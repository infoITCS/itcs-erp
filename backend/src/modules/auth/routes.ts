import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import type { AuthController } from "./controller";
import {
  changePasswordSchema,
  loginSchema,
  microsoftExchangeSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
} from "./validation";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    next();
  });
  router.get("/providers", controller.providers);
  router.get("/microsoft/start", controller.microsoftStart);
  router.get("/microsoft/callback", controller.microsoftCallback);
  router.post(
    "/microsoft/exchange",
    validate({ body: microsoftExchangeSchema }),
    controller.microsoftExchange,
  );
  router.post("/login", validate({ body: loginSchema }), controller.login);
  router.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
  router.post("/logout", validate({ body: refreshSchema }), controller.logout);
  router.post("/logout-all", authenticate, controller.logoutAll);
  router.post(
    "/change-password",
    authenticate,
    validate({ body: changePasswordSchema }),
    controller.changePassword,
  );
  router.get("/me", authenticate, controller.me);
  router.post(
    "/password-reset/request",
    validate({ body: passwordResetRequestSchema }),
    controller.requestPasswordReset,
  );
  router.post(
    "/password-reset/confirm",
    validate({ body: passwordResetConfirmSchema }),
    controller.confirmPasswordReset,
  );
  return router;
}
