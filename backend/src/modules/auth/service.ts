import { AccountStatus, type Prisma } from "@prisma/client";
import { UnauthorizedError, ValidationFailedError } from "../../common/errors/app-error";
import { createOpaqueToken, hashOpaqueToken } from "../../common/security/tokens";
import type { AuditEntry, AuditWriter } from "../audit-logs/types";
import { hashPassword, verifyPassword } from "./password";
import { MAX_FAILED_LOGINS, PASSWORD_RESET_TTL_MS, refreshTtlToMs } from "./policy";
import type { AuthStore } from "./repository";
import { signAccessToken } from "./tokens";
import type {
  LoginInput,
  LoginResult,
  PasswordResetConfirmInput,
  RequestMeta,
} from "./types";
import { env } from "../../config/env";

const INVALID_LOGIN = "Invalid email or password";

export class AuthService {
  constructor(
    private readonly repository: AuthStore,
    private readonly audit: AuditWriter,
  ) {}

  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
    const email = input.email.toLowerCase();
    const user = await this.repository.findByEmail(email);

    if (!user) {
      await this.audit.record(this.loginAudit(null, null, "auth.login.failed", meta, { email }));
      throw new UnauthorizedError(INVALID_LOGIN);
    }

    if (user.status === AccountStatus.INACTIVE) {
      throw new UnauthorizedError("This account is inactive");
    }

    if (user.status === AccountStatus.LOCKED) {
      throw new UnauthorizedError("This account is locked");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lock = failedLoginCount >= MAX_FAILED_LOGINS;
      await this.repository.recordFailedLogin(user.id, failedLoginCount, lock);
      await this.audit.record(
        this.loginAudit(user.organizationId, user.id, "auth.login.failed", meta, {
          locked: lock,
        }),
      );
      throw new UnauthorizedError(INVALID_LOGIN);
    }

    if (!user.organizationId) {
      throw new UnauthorizedError("This account is not a member of an organization");
    }

    await this.repository.recordSuccessfulLogin(user.id);
    const session = await this.issueSessionForUser(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: user.permissions,
      },
      meta,
    );
    await this.audit.record(
      this.loginAudit(user.organizationId, user.id, "auth.login.succeeded", meta, {
        organizationId: user.organizationId,
      }),
    );
    return session;
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<LoginResult> {
    const stored = await this.repository.findRefreshToken(hashOpaqueToken(refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("Refresh token is invalid");
    }

    const user = await this.repository.findById(stored.userId);
    if (!user || user.status !== AccountStatus.ACTIVE || !user.organizationId) {
      throw new UnauthorizedError("Refresh token is invalid");
    }

    await this.repository.revokeRefreshToken(stored.id);
    return this.issueSessionForUser(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: user.permissions,
      },
      meta,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.repository.findRefreshToken(hashOpaqueToken(refreshToken));
    if (stored && !stored.revokedAt) {
      await this.repository.revokeRefreshToken(stored.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repository.revokeAllRefreshTokens(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) {
      throw new ValidationFailedError({ currentPassword: ["Current password is incorrect"] });
    }

    await this.repository.updatePassword(user.id, await hashPassword(newPassword));
    await this.audit.record(
      this.loginAudit(user.organizationId, user.id, "auth.password.changed", meta, {}),
    );
  }

  async requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.repository.findByEmail(email.toLowerCase());
    if (!user || user.status === AccountStatus.INACTIVE) {
      return;
    }

    const token = createOpaqueToken();
    await this.repository.savePasswordReset(
      user.id,
      hashOpaqueToken(token),
      new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    );
    await this.audit.record(
      this.loginAudit(user.organizationId, user.id, "auth.password-reset.requested", meta, {}),
    );
  }

  async confirmPasswordReset(input: PasswordResetConfirmInput, meta: RequestMeta): Promise<void> {
    const stored = await this.repository.findPasswordReset(hashOpaqueToken(input.token));
    if (!stored || stored.usedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new ValidationFailedError({ token: ["Reset token is invalid or expired"] });
    }
    const user = await this.repository.findById(stored.userId);
    if (!user || user.status === AccountStatus.INACTIVE) {
      throw new ValidationFailedError({ token: ["Reset token is invalid or expired"] });
    }

    const passwordHash = await hashPassword(input.password);
    await this.repository.completePasswordReset(stored.userId, stored.id, passwordHash);
    await this.audit.record(
      this.loginAudit(null, stored.userId, "auth.password-reset.completed", meta, {}),
    );
  }

  async issueSessionForUser(
    user: AuthUserRecordActive,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const refreshToken = createOpaqueToken();
    await this.repository.saveRefreshToken({
      userId: user.id,
      tokenHash: hashOpaqueToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlToMs(env.JWT_REFRESH_TTL)),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: user.permissions,
      }),
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }

  private loginAudit(
    organizationId: string | null,
    userId: string | null,
    action: string,
    meta: RequestMeta,
    details: Prisma.InputJsonValue,
  ): AuditEntry {
    return {
      organizationId,
      userId,
      action,
      module: "auth",
      entityType: "user",
      entityId: userId,
      newValues: details,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    };
  }
}

interface AuthUserRecordActive {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}
