/**
 * POST /admin/register
 *
 * 店舗の新規作成。これが無いと stores 行を作る手段が一切無いため追加した。
 *
 * NOTE: 設計書のレスポンスは `{ success }` のみだが、それだと登録後に storeID を
 * 知る手段が無く login できない。実用上の必要性から storeID を返すようにしている。
 */

import { hashPassword } from "../../utils/password.js";
import { registerSchema } from "../../utils/validation.js";
import { fail, prepare } from "../_shared.js";
import type { RegisterResponse } from "../../types/api.js";
import type { StoreInsert } from "../../types/database.js";

const WHERE = "register";

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

export async function register(body: unknown): Promise<RegisterResponse> {
  const p = prepare(WHERE, registerSchema, body);
  if (!p.ok) return { ...p.response, storeID: null };

  const { email, name, password, openTime, closeTime, avgMinutesPerParty, counterDate, lastNumber, status } =
    p.data;

  const passwordHash = await hashPassword(password);

  // 未指定のフィールドはキー自体を省略し、DBのDEFAULTに任せる
  // （exactOptionalPropertyTypesの都合上、undefinedを明示的に入れられないため）
  const insert: StoreInsert = {
    store_mail: email,
    password: passwordHash,
    name,
    ...(openTime !== undefined && { open_time: openTime }),
    ...(closeTime !== undefined && { close_time: closeTime }),
    ...(avgMinutesPerParty !== undefined && { avg_minutes_per_party: avgMinutesPerParty }),
    ...(counterDate !== undefined && { counter_date: counterDate }),
    ...(lastNumber !== undefined && { last_number: lastNumber }),
    ...(status !== undefined && { status }),
  };

  const { data: created, error } = await p.db
    .from("stores")
    .insert(insert)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ...fail(WHERE, `Email already registered: ${email}`), storeID: null };
    }
    return { ...fail(WHERE, `DB error: ${error.message}`), storeID: null };
  }
  if (!created) {
    return { ...fail(WHERE, "Insert returned no row"), storeID: null };
  }

  return { success: true, storeID: created.id };
}
