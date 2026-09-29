import { BaseService } from "../../common/http/base-service";
import type { QuotesRepository } from "./repository";

export class QuotesService extends BaseService<QuotesRepository> {}
