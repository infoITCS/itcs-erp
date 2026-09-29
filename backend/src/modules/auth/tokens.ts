import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import type { AuthContext } from "./types";

const accessTokenSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  organizationId: z.string().uuid(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

export function signAccessToken(auth: AuthContext, expiresIn = env.JWT_ACCESS_TTL): string {
  return jwt.sign(
    {
      email: auth.email,
      organizationId: auth.organizationId,
      roles: auth.roles,
      permissions: auth.permissions,
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: auth.userId,
      expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    },
  );
}

export function verifyAccessToken(token: string): AuthContext | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const parsed = accessTokenSchema.safeParse(decoded);
    if (!parsed.success) {
      return null;
    }

    return {
      userId: parsed.data.sub,
      email: parsed.data.email,
      organizationId: parsed.data.organizationId,
      roles: parsed.data.roles,
      permissions: parsed.data.permissions,
    };
  } catch {
    return null;
  }
}
