import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { assertDecimalString } from "../../common/money/decimal";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import type { CurrenciesRepository } from "./repository";

const RATE_SCALE = 8;

export interface CreateExchangeRateInput {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: string;
  effectiveDate: string;
  source: string;
}

export class CurrenciesService {
  constructor(
    private readonly repository: CurrenciesRepository,
    private readonly audit: AuditWriter,
  ) {}

  list() {
    return this.repository.list();
  }

  async effectiveRate(organizationId: string, base: string, quote: string, asOf: string) {
    const rate = await this.repository.findRate({
      organizationId,
      baseCurrencyCode: base.toUpperCase(),
      quoteCurrencyCode: quote.toUpperCase(),
      asOf: new Date(`${asOf}T00:00:00.000Z`),
    });
    if (!rate) {
      throw new NotFoundError("No exchange rate is effective on that date");
    }
    return {
      ...rate,
      rate: rate.rate.toFixed(RATE_SCALE),
      effectiveDate: rate.effectiveDate.toISOString().slice(0, 10),
    };
  }

  async createRate(
    organizationId: string,
    actorId: string,
    input: CreateExchangeRateInput,
    meta: RequestMeta,
  ) {
    const rate = assertDecimalString(input.rate, RATE_SCALE);
    const baseCurrencyCode = input.baseCurrencyCode.toUpperCase();
    const quoteCurrencyCode = input.quoteCurrencyCode.toUpperCase();
    try {
      const created = await this.repository.createRate({
        organizationId,
        baseCurrencyCode,
        quoteCurrencyCode,
        rate,
        effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
        source: input.source,
      });
      await this.audit.record({
        organizationId,
        userId: actorId,
        action: "currencies.rate.created",
        module: "currencies",
        entityType: "exchange-rate",
        entityId: created.id,
        newValues: { baseCurrencyCode, quoteCurrencyCode, rate, effectiveDate: input.effectiveDate, source: input.source },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return {
        ...created,
        rate: created.rate.toFixed(RATE_SCALE),
        effectiveDate: created.effectiveDate.toISOString().slice(0, 10),
      };
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictError("An exchange rate already exists for that date");
      }
      throw error;
    }
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
