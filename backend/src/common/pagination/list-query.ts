import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./cursor";

const dateQuery = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
  .optional();

export const listQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z.string().min(1).max(64).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().trim().max(200).optional(),
  from: dateQuery,
  to: dateQuery,
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function resolveSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  if (sort && allowed.includes(sort)) {
    return sort;
  }
  return fallback;
}

export function createdAtRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}
