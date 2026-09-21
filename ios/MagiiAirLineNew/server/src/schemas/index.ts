/**
 * リクエストの検証スキーマ
 *
 * 失敗はすべて INVALID_INPUT(400)。ただし電話番号だけは仕様が
 * 専用コード INVALID_PHONE を定めているのでハンドラ側で分岐する。
 */

import { z } from "zod";
import { STORE_STATUSES, TICKET_STATUSES } from "../domain/transitions.js";

export const uuid = z.string().uuid();

/** "HH:mm" と "HH:mm:ss" の両方を受け、"HH:mm" に寄せる */
export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "時刻は HH:mm 形式で指定してください")
  .transform((v) => v.slice(0, 5));

export const storeStatus = z.enum(STORE_STATUSES);
export const ticketStatus = z.enum(TICKET_STATUSES);

export const storeName = z.string().min(1).max(100);
export const avgMinutes = z.number().int().min(1).max(120);
export const partySize = z.number().int().min(1).max(99);
export const personName = z.string().min(1).max(100);

/**
 * openTime == closeTime は切り替え先が曖昧になるため拒否する。
 * 仕様が「登録・設定保存とも400で拒否する」と定めている。
 */
const hoursDistinct = <T extends { openTime: string; closeTime: string }>(
  schema: z.ZodType<T>
) =>
  schema.refine((v) => v.openTime !== v.closeTime, {
    message: "開店時刻と閉店時刻を同じ値にはできません",
    path: ["closeTime"],
  });

// ---------------------------------------------------------------- 管理API

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createStoreSchema = hoursDistinct(
  z.object({
    email: z.string().email(),
    name: storeName,
    password: z.string().min(1),
    openTime: hhmm,
    closeTime: hhmm,
    avgMinutesPerParty: avgMinutes,
    // counterDate / lastNumber は互換用入力。受け取るが保存値には使わない。
    counterDate: z.string().optional(),
    lastNumber: z.number().optional(),
    status: storeStatus,
  })
);

export const storeIdQuerySchema = z.object({ storeID: uuid });

export const callNextSchema = z.object({ storeID: uuid });

export const changeTicketStatusSchema = z.object({
  storeID: uuid,
  newState: ticketStatus,
});

export const storeSettingsSchema = hoursDistinct(
  z.object({
    storeID: uuid,
    name: storeName,
    openTime: hhmm,
    closeTime: hhmm,
    avgMinutesPerParty: avgMinutes,
    status: storeStatus,
  })
);

// ------------------------------------------------------------- お客様API

export const phoneAuthSchema = z.object({ phone_number: z.string().min(1) });

export const createTicketSchema = z.object({
  storeID: uuid,
  accountID: uuid,
  name: personName,
  phone_number: z.string().min(1),
  partySize,
});

export const myTicketQuerySchema = z.object({
  accountID: uuid,
  storeID: uuid,
});

export const cancelTicketSchema = z.object({ accountID: uuid });

export const registerDeviceSchema = z.object({
  accountID: uuid,
  deviceToken: z.string().min(1).max(512),
  platform: z.literal("ios"),
});
