export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthSessionUser;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  password: string;
}
