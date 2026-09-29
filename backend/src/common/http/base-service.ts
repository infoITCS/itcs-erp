export abstract class BaseService<TRepository> {
  constructor(protected readonly repository: TRepository) {}

  protected getRepository(): TRepository {
    return this.repository;
  }
}
