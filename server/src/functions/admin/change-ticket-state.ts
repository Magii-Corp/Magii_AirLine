/**
 * POST /admin/changeTicketState
 *
 * waiting ↔ called の往復のみ。tickets.status の CHECK 制約がこの2値しか
 * 許さないため、seated / no_show / cancelled は finishTicket の担当。
 */

import { changeTicketStateSchema } from "../../utils/validation.js";
import { markEvent } from "../../utils/store-events.js";
import { OK, fail, prepare } from "./_shared.js";
import type { SuccessResponse } from "../../types/api.js";

const WHERE = "changeTicketState";

export async function changeTicketState(
  body: unknown
): Promise<SuccessResponse> {
  const p = prepare(WHERE, changeTicketStateSchema, body);
  if (!p.ok) return p.response;

  const { ticketID, newState } = p.data;

  const { data: ticket, error: fetchError } = await p.db
    .from("tickets")
    .select("store_id, status")
    .eq("id", ticketID)
    .maybeSingle();

  if (fetchError) return fail(WHERE, `DB error: ${fetchError.message}`);
  if (!ticket) return fail(WHERE, `Ticket not found: ${ticketID}`);

  if (ticket.status === newState) {
    return fail(WHERE, `Ticket ${ticketID} is already '${newState}'`);
  }

  // waiting に戻すときは呼び出し時刻も消す
  const { error: updateError } = await p.db
    .from("tickets")
    .update({
      status: newState,
      called_at: newState === "called" ? new Date().toISOString() : null,
    })
    .eq("id", ticketID);

  if (updateError) return fail(WHERE, `DB error: ${updateError.message}`);

  await markEvent(ticket.store_id, "update");
  return OK;
}
