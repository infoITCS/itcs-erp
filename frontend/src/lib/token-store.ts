let accessToken: string | null = null;
let refreshToken: string | null = null;
let email: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** In-memory session. Tokens are not written to localStorage. */
export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    return refreshToken;
  },
  getEmail(): string | null {
    return email;
  },
  setSession(session: { accessToken: string; refreshToken: string; email: string }): void {
    accessToken = session.accessToken;
    refreshToken = session.refreshToken;
    email = session.email;
    notify();
  },
  clear(): void {
    accessToken = null;
    refreshToken = null;
    email = null;
    notify();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): string | null {
    return accessToken;
  },
};
