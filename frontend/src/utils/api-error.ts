import axios from "axios";
import type { ApiFailure } from "@/types/api.ts";

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiFailure | undefined;
    if (data && typeof data.message === "string") {
      const details = Object.entries(data.errors ?? {})
        .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
        .join("; ");
      return details ? `${data.message}: ${details}` : data.message;
    }
  }

  return "The request failed";
}
