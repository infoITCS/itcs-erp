import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .transform((value) => (value ? value.toLowerCase() : undefined))
  .refine((value) => value === undefined || z.email().safeParse(value).success, "Enter a valid email");

export const contactBodySchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: optionalText(200),
  jobTitle: optionalText(120),
  department: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  mobile: optionalText(40),
  isPrimary: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: optionalText(4000),
});

export const updateContactSchema = contactBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Provide a field to update",
});

export const contactListQuerySchema = listQuerySchema.extend({
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const contactIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type ContactBody = z.infer<typeof contactBodySchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
