import { BaseRepository } from "../../common/database/base-repository";
import { displayKey, idFieldType, type AuditDisplayContext, type AuditDisplayRef } from "./presenter";
import type { AuditListRow } from "./repository";

type DisplayRecord = Record<string, unknown>;

interface FindManyDelegate {
  findMany(args: {
    where: { id: { in: string[] } };
    select: Record<string, boolean>;
  }): Promise<DisplayRecord[]>;
}

interface ResolverConfig {
  delegate: string;
  select: Record<string, boolean>;
  format: (row: DisplayRecord) => AuditDisplayRef;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(row: DisplayRecord, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberText(row: DisplayRecord, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return null;
}

function dateText(row: DisplayRecord, key: string): string | null {
  const value = row[key];
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.length >= 10) {
    return value.slice(0, 10);
  }
  return null;
}

function firstValid(...values: Array<string | null>): string {
  return values.find((value) => Boolean(value)) ?? "";
}

function joinValid(values: Array<string | null>): string | undefined {
  const filtered = values.filter((value): value is string => Boolean(value));
  return filtered.length > 0 ? filtered.join(" · ") : undefined;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const RESOLVERS: Record<string, ResolverConfig> = {
  user: {
    delegate: "user",
    select: { id: true, email: true, firstName: true, lastName: true, jobTitle: true, department: true },
    format: (row) => {
      const name = firstValid(joinValid([str(row, "firstName"), str(row, "lastName")])?.replace(" · ", " ") ?? null, str(row, "email"));
      return {
        label: name,
        detail: joinValid([str(row, "jobTitle"), str(row, "department")]),
        email: str(row, "email") ?? undefined,
        initials: initials(name),
      };
    },
  },
  organization: {
    delegate: "organization",
    select: { id: true, name: true, code: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "code"), "Organization"),
      detail: str(row, "code") ?? undefined,
    }),
  },
  role: {
    delegate: "role",
    select: { id: true, name: true, code: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "code"), "Role"),
      detail: str(row, "code") ?? undefined,
    }),
  },
  contact: {
    delegate: "contact",
    select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    format: (row) => {
      const name = firstValid(str(row, "displayName"), joinValid([str(row, "firstName"), str(row, "lastName")])?.replace(" · ", " ") ?? null, str(row, "email"));
      return { label: name, detail: str(row, "email") ?? undefined };
    },
  },
  customer: {
    delegate: "customer",
    select: { id: true, displayName: true, legalName: true, customerNumber: true, customerCode: true, email: true },
    format: (row) => ({
      label: firstValid(str(row, "displayName"), str(row, "legalName"), str(row, "email"), "Customer"),
      detail: joinValid([str(row, "customerNumber"), str(row, "customerCode")]),
      email: str(row, "email") ?? undefined,
    }),
  },
  customer_address: {
    delegate: "customerAddress",
    select: { id: true, label: true, purpose: true, line1: true, city: true },
    format: (row) => ({
      label: firstValid(str(row, "label"), str(row, "purpose"), "Customer address"),
      detail: joinValid([str(row, "line1"), str(row, "city")]),
    }),
  },
  payment_term: {
    delegate: "paymentTerm",
    select: { id: true, name: true, code: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "code"), "Payment term"),
      detail: str(row, "code") ?? undefined,
    }),
  },
  accounting_category: {
    delegate: "accountingCategory",
    select: { id: true, name: true, code: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "code"), "Accounting category"),
      detail: str(row, "code") ?? undefined,
    }),
  },
  "exchange-rate": {
    delegate: "exchangeRate",
    select: { id: true, baseCurrencyCode: true, quoteCurrencyCode: true, rate: true, effectiveDate: true, source: true },
    format: (row) => ({
      label: `${str(row, "baseCurrencyCode") ?? "?"} → ${str(row, "quoteCurrencyCode") ?? "?"}`,
      detail: joinValid([numberText(row, "rate"), dateText(row, "effectiveDate"), str(row, "source")]),
    }),
  },
  lead: {
    delegate: "lead",
    select: { id: true, displayName: true, companyName: true, firstName: true, lastName: true, leadNumber: true, email: true },
    format: (row) => ({
      label: firstValid(str(row, "displayName"), str(row, "companyName"), joinValid([str(row, "firstName"), str(row, "lastName")])?.replace(" · ", " ") ?? null, str(row, "email"), "Lead"),
      detail: str(row, "leadNumber") ?? undefined,
      email: str(row, "email") ?? undefined,
    }),
  },
  opportunity: {
    delegate: "opportunity",
    select: { id: true, title: true, prospectDisplayName: true, opportunityNumber: true, prospectEmail: true },
    format: (row) => ({
      label: firstValid(str(row, "title"), str(row, "prospectDisplayName"), str(row, "prospectEmail"), "Opportunity"),
      detail: str(row, "opportunityNumber") ?? undefined,
      email: str(row, "prospectEmail") ?? undefined,
    }),
  },
  opportunity_product_interest: {
    delegate: "opportunityProductInterest",
    select: { id: true, productName: true, productCode: true },
    format: (row) => ({
      label: firstValid(str(row, "productName"), str(row, "productCode"), "Product interest"),
      detail: str(row, "productCode") ?? undefined,
    }),
  },
  product: {
    delegate: "product",
    select: { id: true, name: true, code: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "code"), "Product"),
      detail: str(row, "code") ?? undefined,
    }),
  },
  product_price: {
    delegate: "productPrice",
    select: { id: true, priceType: true, priceListCode: true, currencyCode: true, amount: true, effectiveDate: true },
    format: (row) => ({
      label: firstValid(str(row, "priceType"), str(row, "priceListCode"), "Product price"),
      detail: joinValid([str(row, "priceListCode"), str(row, "currencyCode"), numberText(row, "amount"), dateText(row, "effectiveDate")]),
    }),
  },
  product_category: {
    delegate: "productCategory",
    select: { id: true, name: true, code: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "code"), "Product category"),
      detail: str(row, "code") ?? undefined,
    }),
  },
  quote: {
    delegate: "quote",
    select: { id: true, quoteNumber: true, customerReference: true },
    format: (row) => ({
      label: firstValid(str(row, "quoteNumber"), "Quote"),
      detail: str(row, "customerReference") ?? undefined,
    }),
  },
  "sales-order": {
    delegate: "salesOrder",
    select: { id: true, salesOrderNumber: true, customerReference: true },
    format: (row) => ({
      label: firstValid(str(row, "salesOrderNumber"), "Sales order"),
      detail: str(row, "customerReference") ?? undefined,
    }),
  },
  invoice: {
    delegate: "invoice",
    select: { id: true, invoiceNumber: true, customerReference: true },
    format: (row) => ({
      label: firstValid(str(row, "invoiceNumber"), "Invoice"),
      detail: str(row, "customerReference") ?? undefined,
    }),
  },
  payment: {
    delegate: "payment",
    select: { id: true, paymentNumber: true, reference: true },
    format: (row) => ({
      label: firstValid(str(row, "paymentNumber"), str(row, "reference"), "Payment"),
      detail: str(row, "reference") ?? undefined,
    }),
  },
  project: {
    delegate: "project",
    select: { id: true, name: true, projectNumber: true },
    format: (row) => ({
      label: firstValid(str(row, "name"), str(row, "projectNumber"), "Project"),
      detail: str(row, "projectNumber") ?? undefined,
    }),
  },
  tender: {
    delegate: "tender",
    select: { id: true, title: true, tenderNumber: true, referenceNumber: true },
    format: (row) => ({
      label: firstValid(str(row, "title"), str(row, "tenderNumber"), "Tender"),
      detail: joinValid([str(row, "tenderNumber"), str(row, "referenceNumber")]),
    }),
  },
  reseller: {
    delegate: "reseller",
    select: { id: true, displayName: true, legalName: true, resellerNumber: true, email: true },
    format: (row) => ({
      label: firstValid(str(row, "displayName"), str(row, "legalName"), str(row, "email"), "Reseller"),
      detail: str(row, "resellerNumber") ?? undefined,
      email: str(row, "email") ?? undefined,
    }),
  },
  reseller_address: {
    delegate: "resellerAddress",
    select: { id: true, label: true, purpose: true, line1: true, city: true },
    format: (row) => ({
      label: firstValid(str(row, "label"), str(row, "purpose"), "Reseller address"),
      detail: joinValid([str(row, "line1"), str(row, "city")]),
    }),
  },
  reseller_contact: {
    delegate: "resellerContact",
    select: { id: true, displayName: true, firstName: true, lastName: true, email: true, jobTitle: true },
    format: (row) => {
      const name = firstValid(str(row, "displayName"), joinValid([str(row, "firstName"), str(row, "lastName")])?.replace(" · ", " ") ?? null, str(row, "email"));
      return {
        label: name,
        detail: joinValid([str(row, "jobTitle"), str(row, "email")]),
        email: str(row, "email") ?? undefined,
      };
    },
  },
};

export class AuditEnrichmentRepository extends BaseRepository {
  async resolve(rows: AuditListRow[]): Promise<AuditDisplayContext> {
    const ids = new Map<string, Set<string>>();
    const add = (type: string | null, id: unknown): void => {
      if (!type || typeof id !== "string" || !UUID_PATTERN.test(id)) {
        return;
      }
      const set = ids.get(type) ?? new Set<string>();
      set.add(id);
      ids.set(type, set);
    };

    for (const row of rows) {
      add(row.entityType, row.entityId);
      add("user", row.userId);
      for (const value of [row.oldValues, row.newValues]) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          continue;
        }
        for (const [key, item] of Object.entries(value)) {
          add(idFieldType(key), item);
        }
      }
    }

    const context: AuditDisplayContext = {};
    const delegates = this.db as unknown as Record<string, FindManyDelegate | undefined>;
    await Promise.all(
      Object.entries(RESOLVERS).map(async ([type, config]) => {
        const set = ids.get(type);
        if (!set || set.size === 0) {
          return;
        }
        const delegate = delegates[config.delegate];
        if (!delegate) {
          return;
        }
        const records = await delegate.findMany({
          where: { id: { in: Array.from(set) } },
          select: config.select,
        });
        for (const record of records) {
          const id = str(record, "id");
          if (!id) {
            continue;
          }
          context[displayKey(type, id)] = config.format(record);
        }
      }),
    );
    return context;
  }
}
