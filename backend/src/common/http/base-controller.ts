export abstract class BaseController<TService> {
  constructor(protected readonly service: TService) {}

  protected getService(): TService {
    return this.service;
  }
}
