import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../../config/env";
import { AppError } from "../../common/errors/app-error";
import { logger } from "../../common/logging/logger";
import { createOpaqueToken } from "../../common/security/tokens";
import type { AuditWriter } from "../audit-logs/types";
import { hashPassword } from "./password";
import type { AuthRepository, AuthUserRecord } from "./repository";
import type { AuthService } from "./service";
import type { LoginResult, RequestMeta } from "./types";

const PENDING_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;
const MAX_PENDING_LOGINS = 1_000;
const MAX_PENDING_TICKETS = 2_000;

export const MICROSOFT_STATE_COOKIE = "itcs_ms_state";

interface PendingLogin {
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

interface PendingTicket {
  session: LoginResult;
  createdAt: number;
}

interface MicrosoftConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedDomain: string;
  authorizeUrl: string;
  tokenUrl: string;
  issuer: string[];
  jwks: ReturnType<typeof createRemoteJWKSet>;
}

export class MicrosoftAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MicrosoftAuthError";
  }
}

export function normalizeMicrosoftDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, "");
}

export function isAllowedMicrosoftEmail(email: string, domain: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDomain = normalizeMicrosoftDomain(domain);
  if (!normalizedEmail.includes("@") || normalizedDomain.length === 0) {
    return false;
  }
  const match = /^([^\s@]+)@([^\s@]+)$/.exec(normalizedEmail);
  return Boolean(match && match[2] === normalizedDomain);
}

function microsoftConfig(): MicrosoftConfig {
  if (!env.microsoftConfigured || !env.MICROSOFT_TENANT_ID || !env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new AppError("Microsoft sign-in is not configured", 503);
  }

  const tenantId = env.MICROSOFT_TENANT_ID;
  return {
    tenantId,
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    redirectUri: env.microsoftRedirectUri,
    allowedDomain: normalizeMicrosoftDomain(env.MICROSOFT_ALLOWED_DOMAIN),
    authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    issuer: [
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`,
    ],
    jwks: createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
    ),
  };
}

export class MicrosoftAuthService {
  private readonly pending = new Map<string, PendingLogin>();
  private readonly tickets = new Map<string, PendingTicket>();

  constructor(
    private readonly repository: AuthRepository,
    private readonly authService: AuthService,
    private readonly audit: AuditWriter,
  ) {}

  providers() {
    return {
      password: true,
      microsoft: env.microsoftConfigured,
      ...(env.microsoftConfigured
        ? { microsoftDomain: normalizeMicrosoftDomain(env.MICROSOFT_ALLOWED_DOMAIN) }
        : {}),
    };
  }

  begin(): { url: string; state: string } {
    const config = microsoftConfig();
    this.prune();

    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

    this.prune();
    while (this.pending.size >= MAX_PENDING_LOGINS) {
      const oldest = this.pending.keys().next().value;
      if (!oldest) {
        break;
      }
      this.pending.delete(oldest);
    }
    this.pending.set(state, { nonce, codeVerifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      response_mode: "query",
      scope: "openid profile email",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });

    return { url: `${config.authorizeUrl}?${params.toString()}`, state };
  }

  async completeCallback(
    rawUrl: string,
    stateCookie: string | null,
    meta: RequestMeta,
  ): Promise<string> {
    try {
      const config = microsoftConfig();
      const url = new URL(rawUrl, env.API_PUBLIC_URL);
      const oauthError = url.searchParams.get("error");
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");

      if (oauthError) {
        throw new MicrosoftAuthError("sso_cancelled", "Microsoft sign-in was cancelled");
      }
      if (!state || !code) {
        throw new MicrosoftAuthError("sso_failed", "Microsoft sign-in response is incomplete");
      }
      if (!stateCookie || stateCookie !== state) {
        throw new MicrosoftAuthError("sso_failed", "Microsoft sign-in session did not match");
      }

      const pending = this.pending.get(state);
      this.pending.delete(state);
      if (!pending || Date.now() - pending.createdAt > PENDING_TTL_MS) {
        throw new MicrosoftAuthError("sso_expired", "Microsoft sign-in session expired");
      }

      const tokenResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: config.redirectUri,
          code_verifier: pending.codeVerifier,
          scope: "openid profile email",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!tokenResponse.ok) {
        let providerError: string | null = null;
        try {
          const body = (await tokenResponse.json()) as { error?: unknown };
          providerError = typeof body.error === "string" ? body.error : null;
        } catch {
          providerError = null;
        }
        logger.warn(
          { status: tokenResponse.status, providerError },
          "microsoft token exchange failed",
        );
        throw new MicrosoftAuthError("sso_failed", "Microsoft token exchange failed");
      }

      const tokenBody = (await tokenResponse.json()) as { id_token?: unknown };
      if (typeof tokenBody.id_token !== "string") {
        throw new MicrosoftAuthError("sso_failed", "Microsoft did not return an identity token");
      }

      const verified = await jwtVerify(tokenBody.id_token, config.jwks, {
        issuer: config.issuer,
        audience: config.clientId,
        clockTolerance: 60,
      });
      const claims = verified.payload as Record<string, unknown>;

      if (claims.nonce !== pending.nonce) {
        throw new MicrosoftAuthError("sso_failed", "Microsoft sign-in nonce did not match");
      }
      if (claims.tid !== config.tenantId) {
        throw new MicrosoftAuthError("sso_tenant", "Use your ITCS Microsoft account");
      }

      const email = firstString(claims.email, claims.preferred_username, claims.upn)?.toLowerCase();
      if (!email || !isAllowedMicrosoftEmail(email, config.allowedDomain)) {
        throw new MicrosoftAuthError("sso_domain", "Use your ITCS Microsoft account");
      }

      const names = microsoftName(claims, email);
      let user = await this.repository.findByEmail(email);
      if (!user) {
        if (!env.microsoftAutoProvision) {
          throw new MicrosoftAuthError(
            "sso_account",
            "Your Microsoft account is not linked to an ERP user yet",
          );
        }
        user = await this.repository.findOrProvisionMicrosoftUser({
          email,
          firstName: names.firstName,
          lastName: names.lastName,
          passwordHash: await hashPassword(createOpaqueToken()),
          organizationCode: env.DEFAULT_ORGANIZATION_CODE,
          defaultRoleCode: env.MICROSOFT_DEFAULT_ROLE,
        });
      }

      if (!user) {
        throw new MicrosoftAuthError("sso_account", "Your account is not active in this organization");
      }
      const organizationId = user.organizationId;
      if (!organizationId) {
        throw new MicrosoftAuthError("sso_account", "Your account is not active in this organization");
      }
      if (user.status !== "ACTIVE") {
        throw new MicrosoftAuthError("sso_account", "This account is inactive or locked");
      }

      await this.repository.recordSuccessfulLogin(user.id);
      const session = await this.authService.issueSessionForUser({ ...user, organizationId }, meta);
      await this.audit.record({
        organizationId,
        userId: user.id,
        action: "auth.microsoft.login.succeeded",
        module: "auth",
        entityType: "user",
        entityId: user.id,
        newValues: { organizationId: user.organizationId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      this.prune();
      while (this.tickets.size >= MAX_PENDING_TICKETS) {
        const oldest = this.tickets.keys().next().value;
        if (!oldest) {
          break;
        }
        this.tickets.delete(oldest);
      }
      const ticket = createOpaqueToken();
      this.tickets.set(ticket, { session, createdAt: Date.now() });
      return `${env.FRONTEND_URL}/auth/callback?ticket=${encodeURIComponent(ticket)}`;
    } catch (error) {
      const code = error instanceof MicrosoftAuthError ? error.code : "sso_failed";
      logger.warn({ err: error, code }, "microsoft sign-in failed");
      return `${env.FRONTEND_URL}/login?error=${encodeURIComponent(code)}`;
    }
  }

  exchangeTicket(ticket: string): LoginResult {
    this.prune();
    const pending = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!pending || Date.now() - pending.createdAt > TICKET_TTL_MS) {
      throw new MicrosoftAuthError("sso_expired", "Microsoft sign-in link expired");
    }
    return pending.session;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, value] of this.pending) {
      if (now - value.createdAt > PENDING_TTL_MS) {
        this.pending.delete(key);
      }
    }
    for (const [key, value] of this.tickets) {
      if (now - value.createdAt > TICKET_TTL_MS) {
        this.tickets.delete(key);
      }
    }
  }
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function microsoftName(claims: Record<string, unknown>, email: string) {
  const displayName = firstString(claims.name);
  let firstName = firstString(claims.given_name);
  let lastName = firstString(claims.family_name);

  if (!firstName && !lastName && displayName) {
    const parts = displayName.split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.slice(1).join(" ") || null;
  }

  return {
    firstName: (firstName ?? email.split("@")[0] ?? "Microsoft").slice(0, 100),
    lastName: (lastName ?? "User").slice(0, 100),
  };
}

export type MicrosoftAuthUser = AuthUserRecord;
