/**
 * POST /admin/call-next
 * Call the next guest in queue
 */

import { supabaseAdmin } from "../utils/supabase.js";
import type { CallNextResponse, ApiResult } from "../types/api.js";

export async function callNext(
  storeId: string
): Promise<ApiResult<CallNextResponse>> {
  if (!supabaseAdmin) {
    return {
      data: null,
      error: { code: "SERVER_ERROR", message: "Database not configured" },
    };
  }

  // Get next waiting ticket
  const { data: nextTicket, error: fetchError } = await supabaseAdmin
    .from("tickets")
    .select(
      `
      *,
      guests (name)
    `
    )
    .eq("store_id", storeId)
    .eq("status", "waiting")
    .order("waiting_number", { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !nextTicket) {
    return {
      data: { ticket: null },
      error: null,
    };
  }

  // Update ticket status to called
  const { data: updatedTicket, error: updateError } = await supabaseAdmin
    .from("tickets")
    .update({
      status: "called",
      called_at: new Date().toISOString(),
    })
    .eq("id", nextTicket.id)
    .select()
    .single();

  if (updateError) {
    return {
      data: null,
      error: { code: "DATABASE_ERROR", message: updateError.message },
    };
  }

  // TODO: Send push notification to guest

  const guestName =
    (nextTicket.guests as { name: string } | null)?.name ?? "Unknown";

  return {
    data: {
      ticket: {
        id: updatedTicket.id,
        waiting_number: updatedTicket.waiting_number,
        guest_name: guestName,
        party_size: updatedTicket.party_size,
        status: updatedTicket.status,
      },
    },
    error: null,
  };
}
