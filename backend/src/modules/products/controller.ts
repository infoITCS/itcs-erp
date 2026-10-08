import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { ProductsService } from "./service";
import type {
  CreateCategoryInput,
  CreateProductInput,
  ProductListQuery,
  ProductPriceInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from "./validation";

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

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

export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as ProductListQuery;
    const page = await this.productsService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Products", data: page });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const product = await this.productsService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Product", data: product });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateProductInput;
    const product = await this.productsService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Product created", data: product }, 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateProductInput;
    const product = await this.productsService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Product updated", data: product });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.productsService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Product deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const product = await this.productsService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Product restored", data: product });
  });

  listPrices = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const prices = await this.productsService.listPrices(organizationId(req), params.id);
    sendSuccess(res, { message: "Prices", data: prices });
  });

  createPrice = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ProductPriceInput;
    const price = await this.productsService.createPrice(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Price created", data: price }, 201);
  });

  updatePrice = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ProductPriceInput;
    const price = await this.productsService.updatePrice(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Price updated", data: price });
  });

  removePrice = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.productsService.removePrice(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Price deleted", data: result });
  });

  listCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await this.productsService.listCategories(organizationId(req));
    sendSuccess(res, { message: "Categories", data: categories });
  });

  createCategory = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateCategoryInput;
    const category = await this.productsService.createCategory(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Category created", data: category }, 201);
  });

  updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateCategoryInput;
    const category = await this.productsService.updateCategory(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Category updated", data: category });
  });

  removeCategory = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.productsService.removeCategory(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Category deleted", data: result });
  });

  listUnits = asyncHandler(async (req: Request, res: Response) => {
    const units = await this.productsService.listUnits(organizationId(req));
    sendSuccess(res, { message: "Units of measure", data: units });
  });

  listTaxCodes = asyncHandler(async (req: Request, res: Response) => {
    const codes = await this.productsService.listTaxCodes(organizationId(req));
    sendSuccess(res, { message: "Tax codes", data: codes });
  });
}
