import axios from "axios";
import type { ApiFailure } from "@/types/api.ts";

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiFailure | undefined;
    if (data && typeof data.message === "string") {
      return data.message;
    }
  }

  return "The request failed";
}
