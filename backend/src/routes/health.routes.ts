import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  sendSuccess(res, { message: "ERP API is running" });
});
