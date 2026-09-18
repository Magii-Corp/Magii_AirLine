/**
 * admin/guest 関数の共通処理
 *
 * 設計メモの方針で操作系はすべて `{ success: boolean }` を返し、失敗理由はボディに
 * 載せない。代わりにここでサーバログへ残す。原因が追えなくなるのを防ぐため、
 * 失敗を返すときは必ず fail() を通すこと。
 */

import { supabaseAdmin } from "../utils/supabase.js";
import { markEvent, type EventKind } from "../utils/store-events.js";
import { validate, type ValidationResult } from "../utils/validation.js";
import type { SuccessResponse } from "../types/api.js";
import type { z } from "zod";

export const OK: SuccessResponse = { success: true };

export function fail(where: string, reason: string): SuccessResponse {
  console.warn(`[${where}] ${reason}`);
  return { success: false };
}

/** 入力検証 + supabaseAdmin の存在確認をまとめて行う */
export function prepare<T>(
  where: string,
  schema: z.ZodSchema<T>,
  input: unknown
):
  | { ok: true; data: T; db: NonNullable<typeof supabaseAdmin> }
  | { ok: false; response: SuccessResponse } {
  const validation: ValidationResult<T> = validate(schema, input);
  if (!validation.success) {
    return { ok: false, response: fail(where, validation.error) };
  }
  if (!supabaseAdmin) {
    return { ok: false, response: fail(where, "Database not configured") };
  }
  return { ok: true, data: validation.data, db: supabaseAdmin };
}

/**
 * stores の 1 カラムだけを更新する操作（設定変更系4種）の共通実装。
 * 更新できたら update イベントを立てる。
 */
export async function updateStoreField(
  where: string,
  storeID: string,
  patch: Record<string, unknown>,
  eventKind: EventKind = "update"
): Promise<SuccessResponse> {
  const db = supabaseAdmin;
  if (!db) return fail(where, "Database not configured");

  const { data, error } = await db
    .from("stores")
    .update(patch as never)
    .eq("id", storeID)
    .select("id");

  if (error) return fail(where, `DB error: ${error.message}`);
  if (!data || data.length === 0) return fail(where, `Store not found: ${storeID}`);

  await markEvent(storeID, eventKind);
  return OK;
}
