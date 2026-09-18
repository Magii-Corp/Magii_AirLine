/**
 * POST /guest/cancelTicket
 *
 * 状態遷移図（docs/requirements/overview.md 5章）の通り、キャンセルは
 * waiting からのみ可能。called 後（呼び出し済み）は不可 —
 * その場合は店舗側の finishTicket（no_show 等）に委ねる。
 */

import { cancelTicketSchema } from "../../utils/validation.js";
import { markEvent } from "../../utils/store-events.js";
import { moveTicketToHistory } from "../../utils/ticket-history.js";
import { OK, fail, prepare } from "../_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "cancelTicket";

export async function cancelTicket(body: unknown): Promise<SuccessResponse> {
  const p = prepare(WHERE, cancelTicketSchema, body);
  if (!p.ok) return p.response;

  const { ticketID } = p.data;

  const { data: ticket, error: fetchError } = await p.db
    .from("tickets")
    .select("*")
    .eq("id", ticketID)
    .maybeSingle();

  if (fetchError) return fail(WHERE, `DB error: ${fetchError.message}`);
  if (!ticket) return fail(WHERE, `Ticket not found: ${ticketID}`);
  if (ticket.status !== "waiting") {
    return fail(WHERE, `Ticket ${ticketID} is '${ticket.status}', cannot cancel`);
  }

  const result = await moveTicketToHistory(p.db, ticket, "cancelled", WHERE);
  if (!result.ok) return fail(WHERE, result.error);

  await markEvent(ticket.store_id, "remove");
  return OK;
}
