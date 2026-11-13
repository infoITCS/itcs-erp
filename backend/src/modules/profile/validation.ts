import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => value === "" || /^[0-9+()\-\s.]{6,32}$/.test(value), {
    message: "Enter a valid phone number",
  });

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: phoneSchema.optional(),
    jobTitle: z.string().trim().max(120).optional(),
    department: z.string().trim().max(120).optional(),
    location: z.string().trim().max(160).optional(),
    bio: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one field to update",
  });

export const avatarBodySchema = z.object({
  dataUrl: z
    .string()
    .trim()
    .min(32)
    .max(700_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, {
      message: "Upload a PNG, JPEG, or WebP image",
    }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
