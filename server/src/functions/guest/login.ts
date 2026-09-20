/**
 * POST /guest/login
 *
 * phone_number + password で既存アカウントを認証する。
 * admin/login.ts と対称的な構造（テーブル・カラム名が違うだけ）。
 */

import { verifyPassword } from "../../utils/password.js";
import { guestLoginSchema } from "../../utils/validation.js";
import { fail, prepare } from "../_shared.js";
import type { GuestAuthResponse } from "../../types/api.js";

const WHERE = "login";

export async function login(body: unknown): Promise<GuestAuthResponse> {
  const p = prepare(WHERE, guestLoginSchema, body);
  if (!p.ok) return { ...p.response, accountID: null };

  const { phone, password } = p.data;

  const { data: account, error } = await p.db
    .from("accounts")
    .select("id, password")
    .eq("phone_number", phone)
    .maybeSingle();

  if (error) return { ...fail(WHERE, `DB error: ${error.message}`), accountID: null };
  if (!account) return { ...fail(WHERE, `Account not found for phone ${phone}`), accountID: null };

  const matches = await verifyPassword(password, account.password);
  if (!matches) return { ...fail(WHERE, `Password mismatch for phone ${phone}`), accountID: null };

  return { success: true, accountID: account.id };
}
