/**
 * Cache port for read-heavy queries. The default store does nothing.
 * A Redis (or similar) implementation can replace it without changing modules.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class NoOpCache implements CacheStore {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {
    return undefined;
  }

  async delete(_key: string): Promise<void> {
    return undefined;
  }
}

export const cache: CacheStore = new NoOpCache();
