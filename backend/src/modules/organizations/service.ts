import type { OrganizationsRepository } from "./repository";

export class OrganizationsService {
  constructor(private readonly repository: OrganizationsRepository) {}

  async listForUser(userId: string) {
    const memberships = await this.repository.listForUser(userId);
    return memberships.map((membership) => membership.organization);
  }
}
