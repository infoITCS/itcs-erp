import type { DocumentSequencesRepository } from "./repository";

export class DocumentSequencesService {
  constructor(private readonly repository: DocumentSequencesRepository) {}

  list(organizationId: string, year: number) {
    return this.repository.list(organizationId, year);
  }
}
