import { BaseService } from "../../common/http/base-service";
import type { PaymentsRepository } from "./repository";

export class PaymentsService extends BaseService<PaymentsRepository> {}
