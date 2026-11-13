import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

export function listCurrencies(): Promise<CurrencyOption[]> {
  return http
    .get<ApiSuccess<CurrencyOption[]>>("/api/v1/currencies")
    .then((response) => response.data.data ?? []);
}
