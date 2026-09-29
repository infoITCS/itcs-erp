import { BaseService } from "../../common/http/base-service";
import type { ProductsRepository } from "./repository";

export class ProductsService extends BaseService<ProductsRepository> {}
