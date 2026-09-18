/**
 * POST /admin/finishTicket
 *
 * チケットを確定させる。tickets.status は CHECK 制約で waiting/called しか
 * 取れないため、「確定」は ticket_history へ id ごと移送して tickets から
 * 削除することを意味する。created_at は引き継ぎ、finished_at に確定時刻が入る。
 */

import { finishTicketSchema } from "../../utils/validation.js";
import { markEvent } from "../../utils/store-events.js";
import { moveTicketToHistory } from "../../utils/ticket-history.js";
import { OK, fail, prepare } from "../_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "finishTicket";

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

  const result = await moveTicketToHistory(p.db, ticket, finalState, WHERE);
  if (!result.ok) return fail(WHERE, result.error);

  await markEvent(ticket.store_id, "remove");
  return OK;
}
