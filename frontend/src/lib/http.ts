import axios from "axios";
import { env } from "@/app/config/env.ts";
import { tokenStore } from "@/lib/token-store.ts";

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = String(error.config?.url ?? "");
      const isAuthCall = url.includes("/api/v1/auth/");
      if (!isAuthCall) {
        tokenStore.clear();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
      }
    }
    return Promise.reject(error);
  },
);
