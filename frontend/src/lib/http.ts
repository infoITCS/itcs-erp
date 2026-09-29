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
