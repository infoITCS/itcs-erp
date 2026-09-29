import type { AuthContext } from "../modules/auth/types";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthContext;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
