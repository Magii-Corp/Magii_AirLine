/**
 * POST /admin/finishTicket
 *
 * チケットを確定させる。tickets.status は CHECK 制約で waiting/called しか
 * 取れないため、「確定」は ticket_history へ id ごと移送して tickets から
 * 削除することを意味する。created_at は引き継ぎ、finished_at に確定時刻が入る。
 */

import { finishTicketSchema } from "../../utils/validation.js";
import { markEvent } from "../../utils/store-events.js";
import { OK, fail, prepare } from "./_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "finishTicket";

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

export async function finishTicket(body: unknown): Promise<SuccessResponse> {
  const p = prepare(WHERE, finishTicketSchema, body);
  if (!p.ok) return p.response;

  const { ticketID, finalState } = p.data;

  const { data: ticket, error: fetchError } = await p.db
    .from("tickets")
    .select("*")
    .eq("id", ticketID)
    .maybeSingle();

  if (fetchError) return fail(WHERE, `DB error: ${fetchError.message}`);
  if (!ticket) return fail(WHERE, `Ticket not found: ${ticketID}`);

  // NOTE: insert と delete は別文なので厳密には原子的でない。
  // ticket_history.id は tickets.id を引き継ぐ主キーなので、
  // insert 済み / delete 未了の中断は再実行で回復できる（下の重複キー処理）。
  // 完全な原子性が必要になったら DB 関数 (RPC) に寄せる。
  const { error: insertError } = await p.db.from("ticket_history").insert({
    id: ticket.id,
    store_id: ticket.store_id,
    account_id: ticket.account_id,
    business_date: ticket.business_date,
    name: ticket.name,
    party_size: ticket.party_size,
    final_status: finalState,
    created_at: ticket.created_at,
  });

  if (insertError && insertError.code !== UNIQUE_VIOLATION) {
    return fail(WHERE, `DB error on history insert: ${insertError.message}`);
  }
  if (insertError) {
    // 前回の実行が delete 前に落ちたケース。履歴は既にあるので削除だけ進める。
    console.warn(`[${WHERE}] History for ${ticketID} already exists; deleting ticket only`);
  }

  const { error: deleteError } = await p.db
    .from("tickets")
    .delete()
    .eq("id", ticketID);

  if (deleteError) return fail(WHERE, `DB error on delete: ${deleteError.message}`);

  await markEvent(ticket.store_id, "remove");
  return OK;
}
