import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/app/config/env.ts";
import { tokenStore } from "@/lib/token-store.ts";
import type { LoginResult } from "@/services/auth.ts";
import type { ApiSuccess } from "@/types/api.ts";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise: Promise<string | null> | null = null;

function tokenExpiryMs(token: string | null): number | null {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiSuccess<LoginResult>>(
        `${env.apiUrl}/api/v1/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" }, timeout: 30_000 },
      )
      .then((response) => {
        const session = response.data.data;
        if (!session) {
          return null;
        }
        tokenStore.setSession(session);
        return session.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

http.interceptors.request.use(async (config) => {
  const url = String(config.url ?? "");
  const isAuthCall =
    url.includes("/api/v1/auth/login") ||
    url.includes("/api/v1/auth/refresh") ||
    url.includes("/api/v1/auth/microsoft/exchange");

  if (!tokenStore.isImpersonating() && !isAuthCall) {
    let token = tokenStore.getRealAccessToken();
    const expiry = tokenExpiryMs(token);
    if (token && expiry !== null && expiry - Date.now() < 60_000) {
      token = await refreshAccessToken();
    }
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  }

  const token = tokenStore.isImpersonating() ? tokenStore.getImpersonation()?.accessToken : null;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;
    const url = String(config?.url ?? "");
    const isLoginCall = url.includes("/api/v1/auth/login");
    const isRefreshCall = url.includes("/api/v1/auth/refresh");
    const isMicrosoftExchange = url.includes("/api/v1/auth/microsoft/exchange");

    // During impersonation, a 401 means the impersonation token expired - just stop impersonation
    if (error.response?.status === 401 && tokenStore.isImpersonating()) {
      tokenStore.stopImpersonation();
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !isLoginCall &&
      !isRefreshCall &&
      !isMicrosoftExchange
    ) {
      config._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
        return http.request(config);
      }
    }

    if (error.response?.status === 401 && !isLoginCall && !isRefreshCall) {
      tokenStore.clear();
      if (
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/auth/callback")
      ) {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  },
);
