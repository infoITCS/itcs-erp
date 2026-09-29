import type { Prisma, PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

export class CurrenciesRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list() {
    return this.db.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true, symbol: true, decimalPlaces: true, isActive: true },
    });
  }

  async findRate(input: {
    organizationId: string;
    baseCurrencyCode: string;
    quoteCurrencyCode: string;
    asOf: Date;
  }) {
    return this.db.exchangeRate.findFirst({
      where: {
        organizationId: input.organizationId,
        baseCurrencyCode: input.baseCurrencyCode,
        quoteCurrencyCode: input.quoteCurrencyCode,
        isActive: true,
        effectiveDate: { lte: input.asOf },
      },
      orderBy: { effectiveDate: "desc" },
      select: {
        id: true,
        baseCurrencyCode: true,
        quoteCurrencyCode: true,
        rate: true,
        effectiveDate: true,
        source: true,
        isActive: true,
      },
    });
  }

  async createRate(input: {
    organizationId: string;
    baseCurrencyCode: string;
    quoteCurrencyCode: string;
    rate: string;
    effectiveDate: Date;
    source: string;
  }) {
    return this.db.exchangeRate.create({
      data: {
        organizationId: input.organizationId,
        baseCurrencyCode: input.baseCurrencyCode,
        quoteCurrencyCode: input.quoteCurrencyCode,
        rate: input.rate,
        effectiveDate: input.effectiveDate,
        source: input.source,
      },
      select: {
        id: true,
        baseCurrencyCode: true,
        quoteCurrencyCode: true,
        rate: true,
        effectiveDate: true,
        source: true,
        isActive: true,
      },
    });
  }
}

export type ExchangeRateRow = Prisma.ExchangeRateGetPayload<{
  select: {
    id: true;
    baseCurrencyCode: true;
    quoteCurrencyCode: true;
    rate: true;
    effectiveDate: true;
    source: true;
    isActive: true;
  };
}>;
