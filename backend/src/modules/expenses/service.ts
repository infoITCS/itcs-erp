import { BaseService } from "../../common/http/base-service";
import type { ExpensesRepository } from "./repository";

export class ExpensesService extends BaseService<ExpensesRepository> {}
