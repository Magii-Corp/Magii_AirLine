/**
 * GET /reservation
 * GET /waiting
 * Get current reservation status for a guest
 */

import { supabaseAdmin } from "../utils/supabase.js";
import { getReservationSchema, validate } from "../utils/validation.js";
import type {
  GetReservationRequest,
  GetReservationResponse,
  ApiResult,
} from "../types/api.js";

export async function getReservation(
  query: unknown
): Promise<ApiResult<GetReservationResponse>> {
  // Validate request
  const validation = validate(getReservationSchema, query);
  if (!validation.success) {
    return {
      data: null,
      error: { code: "VALIDATION_ERROR", message: validation.error },
    };
  }

  const { shop_id, user_id } = validation.data as GetReservationRequest;

  if (!supabaseAdmin) {
    return {
      data: null,
      error: { code: "SERVER_ERROR", message: "Database not configured" },
    };
  }

  // Get store info
  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("id", shop_id)
    .single();

  if (storeError || !store) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Store not found" },
    };
  }

  // Get active ticket for guest
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("store_id", shop_id)
    .eq("guest_id", user_id)
    .in("status", ["waiting", "called"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (ticketError || !ticket) {
    return {
      data: { reservation: null },
      error: null,
    };
  }

  // Count groups ahead (only for waiting status)
  let groupsAhead = 0;
  if (ticket.status === "waiting") {
    const { count } = await supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("store_id", shop_id)
      .eq("status", "waiting")
      .lt("waiting_number", ticket.waiting_number);

    groupsAhead = count ?? 0;
  }

  const estimatedWaitMinutes =
    groupsAhead * store.estimated_wait_time_per_group;

  return {
    data: {
      reservation: {
        id: ticket.id,
        waiting_number: ticket.waiting_number,
        party_size: ticket.party_size,
        status: ticket.status,
        groups_ahead: groupsAhead,
        estimated_wait_minutes: estimatedWaitMinutes,
        created_at: ticket.created_at,
        called_at: ticket.called_at,
      },
    },
    error: null,
  };
}
