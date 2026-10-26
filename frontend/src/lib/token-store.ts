export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const STORAGE_KEY = "itcs-erp-session";

interface StoredSession {
  refreshToken: string;
  user: SessionUser;
}

function readStored(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.refreshToken !== "string" ||
      !parsed.user ||
      typeof parsed.user.email !== "string"
    ) {
      return null;
    }
    return {
      refreshToken: parsed.refreshToken,
      user: {
        ...parsed.user,
        roles: Array.isArray(parsed.user.roles) ? parsed.user.roles : [],
        permissions: Array.isArray(parsed.user.permissions) ? parsed.user.permissions : [],
      },
    };
  } catch {
    return null;
  }
}

function writeStored(session: StoredSession | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    return;
  }
}

const initial = typeof window === "undefined" ? null : readStored();
let accessToken: string | null = null;
let refreshToken: string | null = initial?.refreshToken ?? null;
let user: SessionUser | null = initial?.user ?? null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    return refreshToken;
  },
  getEmail(): string | null {
    return user?.email ?? null;
  },
  getUser(): SessionUser | null {
    return user;
  },
  hasPermission(code: string): boolean {
    return user?.permissions.includes(code) ?? false;
  },
  hasRole(code: string): boolean {
    return user?.roles.includes(code) ?? false;
  },
  setSession(session: Session): void {
    accessToken = session.accessToken;
    refreshToken = session.refreshToken;
    user = session.user;
    writeStored({ refreshToken: session.refreshToken, user: session.user });
    notify();
  },
  setUser(nextUser: SessionUser): void {
    user = nextUser;
    if (refreshToken) {
      writeStored({ refreshToken, user: nextUser });
    }
    notify();
  },
  clear(): void {
    accessToken = null;
    refreshToken = null;
    user = null;
    writeStored(null);
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
