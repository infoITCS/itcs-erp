import type { PermissionsRepository } from "./repository";

export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  list() {
    return this.repository.list();
  }
}
