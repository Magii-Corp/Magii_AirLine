/**
 * POST /admin/resetEvent
 * 管理画面がイベントを確認したあと、フラグを寝かせる
 */

import { resetEventSchema } from "../../utils/validation.js";
import { OK, fail, prepare } from "./_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "resetEvent";

export async function resetEvent(body: unknown): Promise<SuccessResponse> {
  const p = prepare(WHERE, resetEventSchema, body);
  if (!p.ok) return p.response;

  const { storeID } = p.data;

  // 行が無ければ作る（全 false なので実質「イベント無し」のまま）
  const { error } = await p.db.from("store_events").upsert(
    {
      store_id: storeID,
      has_add: false,
      has_remove: false,
      has_update: false,
    },
    { onConflict: "store_id" }
  );

  if (error) return fail(WHERE, `DB error: ${error.message}`);

  return OK;
}
