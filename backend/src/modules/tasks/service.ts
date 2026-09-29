import { BaseService } from "../../common/http/base-service";
import type { TasksRepository } from "./repository";

export class TasksService extends BaseService<TasksRepository> {}
