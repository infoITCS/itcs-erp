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

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
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
