import { z } from "zod";

// ============================================================
// Common Schemas
// ============================================================

export const uuidSchema = z.string().uuid();

/** time without time zone。"HH:MM:SS" と "HH:MM" の両方を受け、秒を補って返す */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time format (HH:MM:SS)")
  .transform((v) => (v.length === 5 ? `${v}:00` : v));

/** tickets.status — changeTicketState で指定できるのはこの2値のみ */
export const ticketStatusSchema = z.enum(["waiting", "called"]);

/** ticket_history.final_status */
export const finalStatusSchema = z.enum(["seated", "no_show", "cancelled"]);

/** stores.status */
export const storeStatusSchema = z.enum(["open", "paused", "closed"]);

// ============================================================
// Admin Schemas
// ============================================================

export const getTicketsSchema = z.object({
  storeID: uuidSchema,
});

export const loginSchema = z.object({
  storeID: uuidSchema,
  password: z.string().min(1, "Password is required"),
});

export const callNextSchema = z.object({
  storeID: uuidSchema,
});

export const getEventSchema = z.object({
  storeID: uuidSchema,
});

export const resetEventSchema = z.object({
  storeID: uuidSchema,
});

export const changeTicketStateSchema = z.object({
  ticketID: uuidSchema,
  newState: ticketStatusSchema,
});

export const finishTicketSchema = z.object({
  ticketID: uuidSchema,
  finalState: finalStatusSchema,
});

export const changeAvgMinutesPerPartySchema = z.object({
  storeID: uuidSchema,
  newValue: z.number().int().min(1).max(120),
});

export const changeOpenTimeSchema = z.object({
  storeID: uuidSchema,
  newValue: timeSchema,
});

export const changeCloseTimeSchema = z.object({
  storeID: uuidSchema,
  newValue: timeSchema,
});

export const changeStoreStateSchema = z.object({
  storeID: uuidSchema,
  newState: storeStatusSchema,
});

/** 新規作成時のみパスワード強度を要求する（loginは存在チェックのみ） */
export const newPasswordSchema = z.string().min(8).max(72);

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: newPasswordSchema,
  openTime: timeSchema.optional(),
  closeTime: timeSchema.optional(),
  avgMinutesPerParty: z.number().int().min(1).max(120).optional(),
  counterDate: z.string().optional().nullable(),
  lastNumber: z.number().int().min(0).optional(),
  status: storeStatusSchema.optional().nullable(),
});

// ============================================================
// Guest Schemas
// ============================================================

export const phoneSchema = z.string().min(10).max(20);

export const guestRegisterSchema = z.object({
  phone: phoneSchema,
  password: newPasswordSchema,
});

export const guestLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Password is required"),
});

export const createTicketSchema = z.object({
  storeID: uuidSchema,
  accountID: uuidSchema,
  name: z.string().min(1).max(50),
  partySize: z.number().int().min(1).max(20).optional(),
});

export const getMyTicketSchema = z.object({
  accountID: uuidSchema,
  storeID: uuidSchema,
});

export const cancelTicketSchema = z.object({
  ticketID: uuidSchema,
});

export const arriveSchema = z.object({
  ticketID: uuidSchema,
});

export const getStoreSchema = z.object({
  storeID: uuidSchema,
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
