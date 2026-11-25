import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { PROJECT_STATUSES } from "./types";

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

function optionalEmail() {
  return z
    .string()
    .trim()
    .max(320)
    .email("Enter a valid email address")
    .optional()
    .transform((value) => (value ? value : undefined));
}

const projectStatus = z.enum(PROJECT_STATUSES);
const dateOnly = z.iso.date();

export const createProjectSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter a project name").max(200),
  description: optionalText(4000),
  status: z.enum(["PLANNED", "IN_PROGRESS"]).optional(),
  customerId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  customerContactName: optionalText(120),
  customerContactEmail: optionalEmail(),
  customerContactPhone: optionalText(40),
  supplierCompany: optionalText(200),
  supplierContactName: optionalText(120),
  supplierContactEmail: optionalEmail(),
  supplierContactPhone: optionalText(40),
  currencyCode: currencyCode.optional(),
  startDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
  notes: optionalText(4000),
});

export const updateProjectSchema = z
  .strictObject({
    name: z.string().trim().min(1, "Enter a project name").max(200).optional(),
    description: optionalText(4000).nullable(),
    status: projectStatus.optional(),
    customerId: z.uuid().nullable().optional(),
    contactId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().nullable().optional(),
    invoiceId: z.uuid().nullable().optional(),
    customerContactName: optionalText(120).nullable(),
    customerContactEmail: optionalEmail().nullable(),
    customerContactPhone: optionalText(40).nullable(),
    supplierCompany: optionalText(200).nullable(),
    supplierContactName: optionalText(120).nullable(),
    supplierContactEmail: optionalEmail().nullable(),
    supplierContactPhone: optionalText(40).nullable(),
    currencyCode: currencyCode.optional(),
    startDate: dateOnly.nullable().optional(),
    dueDate: dateOnly.nullable().optional(),
    notes: optionalText(4000).nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const projectListQuerySchema = listQuerySchema.extend({
  status: projectStatus.optional(),
  customerId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "name", "projectNumber"]).optional(),
});

export const projectIdParamSchema = z.object({ id: z.uuid() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
