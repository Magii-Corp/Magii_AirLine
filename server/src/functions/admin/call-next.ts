/**
 * POST /admin/callNext
 * 当日の待ち行列の先頭を呼び出す
 */

import { todayBusinessDate } from "../../utils/business-date.js";
import { callNextSchema } from "../../utils/validation.js";
import { markEvent } from "../../utils/store-events.js";
import { OK, fail, prepare } from "./_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "callNext";

export async function callNext(body: unknown): Promise<SuccessResponse> {
  const p = prepare(WHERE, callNextSchema, body);
  if (!p.ok) return p.response;

  const { storeID } = p.data;
  const businessDate = todayBusinessDate();

  const { data: next, error: fetchError } = await p.db
    .from("tickets")
    .select("id")
    .eq("store_id", storeID)
    .eq("business_date", businessDate)
    .eq("status", "waiting")
    .order("waiting_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) return fail(WHERE, `DB error: ${fetchError.message}`);
  if (!next) return fail(WHERE, `No waiting ticket for store ${storeID}`);

  // status='waiting' を条件に含めることで、複数端末から同時に押しても
  // 同じ組を二重に呼び出さない
  const { data: updated, error: updateError } = await p.db
    .from("tickets")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("id", next.id)
    .eq("status", "waiting")
    .select("id");

  if (updateError) return fail(WHERE, `DB error: ${updateError.message}`);
  if (!updated || updated.length === 0) {
    return fail(WHERE, `Ticket ${next.id} was already called by someone else`);
  }

  await markEvent(storeID, "update");
  return OK;
}
