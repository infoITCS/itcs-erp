import { BaseService } from "../../common/http/base-service";
import type { ContactsRepository } from "./repository";

export class ContactsService extends BaseService<ContactsRepository> {}
