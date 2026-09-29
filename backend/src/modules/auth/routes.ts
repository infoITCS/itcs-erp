import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import type { AuthController } from "./controller";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
} from "./validation";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post("/login", validate({ body: loginSchema }), controller.login);
  router.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
  router.post("/logout", validate({ body: refreshSchema }), controller.logout);
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
