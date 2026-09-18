/**
 * POST /admin/login
 *
 * storeID で stores を引き、stores.password と直接照合する
 * （旧 staff_accounts 経由の間接照合は廃止。stores自身が認証情報を持つ）。
 *
 * NOTE: 設計メモの方針によりトークンは発行しない。したがって成功しても
 * 以降のリクエストが認証済みになるわけではない（他のエンドポイントは
 * storeID さえ分かれば誰でも呼べる）。公開前に必ず塞ぐこと。
 */

import { verifyPassword } from "../../utils/password.js";
import { loginSchema } from "../../utils/validation.js";
import { OK, fail, prepare } from "../_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "login";

export async function login(body: unknown): Promise<SuccessResponse> {
  const p = prepare(WHERE, loginSchema, body);
  if (!p.ok) return p.response;

  const { storeID, password } = p.data;

  const { data: store, error: storeError } = await p.db
    .from("stores")
    .select("password")
    .eq("id", storeID)
    .maybeSingle();

  if (storeError) return fail(WHERE, `DB error: ${storeError.message}`);
  if (!store) return fail(WHERE, `Store not found: ${storeID}`);

  const matches = await verifyPassword(password, store.password);
  if (!matches) return fail(WHERE, `Password mismatch for store ${storeID}`);

  return OK;
}
