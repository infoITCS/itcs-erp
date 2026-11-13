import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import type { ProfileController } from "./controller";
import { avatarBodySchema, updateProfileSchema } from "./validation";

export function createProfileRouter(controller: ProfileController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", controller.get);
  router.patch("/", validate({ body: updateProfileSchema }), controller.update);
  router.put("/avatar", validate({ body: avatarBodySchema }), controller.updateAvatar);
  router.delete("/avatar", controller.removeAvatar);
  return router;
}
