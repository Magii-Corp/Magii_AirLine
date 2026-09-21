import { z } from "zod";

// ============================================================
// Common Schemas
// ============================================================

export const uuidSchema = z.string().uuid();

export const phoneSchema = z
  .string()
  .regex(/^[0-9-]+$/, "Invalid phone number format")
  .optional();

// ============================================================
// Guest Schemas
// ============================================================

export const registerUserSchema = z.object({
  device_id: z.string().min(1, "Device ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  phone: phoneSchema,
});

export const createReservationSchema = z.object({
  store_id: uuidSchema,
  guest_id: uuidSchema,
  party_size: z.number().int().min(1).max(20),
});

export const getReservationSchema = z.object({
  shop_id: uuidSchema,
  user_id: uuidSchema,
});

// ============================================================
// Admin Schemas
// ============================================================

export const registerShopSchema = z.object({
  name: z.string().min(1, "Store name is required").max(100),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["waiting", "called", "seated", "no_show", "cancelled"]),
});

export const updateStoreSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  estimated_wait_time_per_group: z.number().int().min(1).max(120).optional(),
  is_accepting: z.boolean().optional(),
});

// ============================================================
// Validation Helper
// ============================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessage = result.error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");

  return { success: false, error: errorMessage };
}
