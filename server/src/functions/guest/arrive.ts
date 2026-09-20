/**
 * POST /guest/arrive
 *
 * [到着しました] ボタン。arrivedAt を記録するだけで status は変えない。
 * 着席確定 (seated) は引き続き店舗側の finishTicket が行う
 * （要件定義書「未決定事項5」— 飲食店の席の準備を想定した設計）。
 */

import { arriveSchema } from "../../utils/validation.js";
import { markEvent } from "../../utils/store-events.js";
import { OK, fail, prepare } from "../_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "arrive";

export async function arrive(body: unknown): Promise<SuccessResponse> {
  const p = prepare(WHERE, arriveSchema, body);
  if (!p.ok) return p.response;

  const { ticketID } = p.data;

  const { data: updated, error } = await p.db
    .from("tickets")
    .update({ arrived_at: new Date().toISOString() })
    .eq("id", ticketID)
    .select("store_id");

  if (error) return fail(WHERE, `DB error: ${error.message}`);
  if (!updated || updated.length === 0) {
    return fail(WHERE, `Ticket not found: ${ticketID}`);
  }

  await markEvent(updated[0]!.store_id, "update");
  return OK;
}
