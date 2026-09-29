import { http } from "@/lib/http.ts";

export interface HealthResponse {
  success: boolean;
  message: string;
}

export function fetchHealth(): Promise<HealthResponse> {
  return http.get<HealthResponse>("/api/v1/health").then((response) => response.data);
}
