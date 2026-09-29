import { Router } from "express";
import type { ProductsController } from "./controller";

export function createProductsRouter(_controller: ProductsController): Router {
  return Router();
}
