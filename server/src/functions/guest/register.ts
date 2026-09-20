/**
 * POST /guest/register
 *
 * phone_number + password でアカウントを新規作成する。
 * 既に同じ電話番号が登録済みの場合は success: false（login を使うべき）。
 */

import { hashPassword } from "../../utils/password.js";
import { guestRegisterSchema } from "../../utils/validation.js";
import { fail, prepare } from "../_shared.js";
import type { GuestAuthResponse } from "../../types/api.js";

const WHERE = "register";

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

export async function register(body: unknown): Promise<GuestAuthResponse> {
  const p = prepare(WHERE, guestRegisterSchema, body);
  if (!p.ok) return { ...p.response, accountID: null };

  const { phone, password } = p.data;

  const passwordHash = await hashPassword(password);

  const { data: created, error } = await p.db
    .from("accounts")
    .insert({ phone_number: phone, password: passwordHash })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ...fail(WHERE, `Phone already registered: ${phone}`), accountID: null };
    }
    return { ...fail(WHERE, `DB error: ${error.message}`), accountID: null };
  }
  if (!created) {
    return { ...fail(WHERE, "Insert returned no row"), accountID: null };
  }

  return { success: true, accountID: created.id };
}
