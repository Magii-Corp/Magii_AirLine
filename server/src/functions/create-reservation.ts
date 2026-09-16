/**
 * POST /reservation
 * Create a new reservation (ticket) for a guest
 */

import { supabaseAdmin } from "../utils/supabase.js";
import { createReservationSchema, validate } from "../utils/validation.js";
import type {
  CreateReservationRequest,
  CreateReservationResponse,
  ApiResult,
} from "../types/api.js";

export async function createReservation(
  body: unknown
): Promise<ApiResult<CreateReservationResponse>> {
  // Validate request
  const validation = validate(createReservationSchema, body);
  if (!validation.success) {
    return {
      data: null,
      error: { code: "VALIDATION_ERROR", message: validation.error },
    };
  }

  const { store_id, guest_id, party_size } =
    validation.data as CreateReservationRequest;

  if (!supabaseAdmin) {
    return {
      data: null,
      error: { code: "SERVER_ERROR", message: "Database not configured" },
    };
  }

  // Check if store exists and is accepting
  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("id", store_id)
    .single();

  if (storeError || !store) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Store not found" },
    };
  }

  if (!store.is_accepting) {
    return {
      data: null,
      error: { code: "STORE_CLOSED", message: "Store is not accepting" },
    };
  }

  // Check if guest already has an active ticket
  const { data: existingTicket } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("store_id", store_id)
    .eq("guest_id", guest_id)
    .in("status", ["waiting", "called"])
    .single();

  if (existingTicket) {
    return {
      data: null,
      error: {
        code: "ALREADY_IN_QUEUE",
        message: "Guest already has an active ticket",
      },
    };
  }

  // Get next waiting number (today's tickets only)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: lastTicket } = await supabaseAdmin
    .from("tickets")
    .select("waiting_number")
    .eq("store_id", store_id)
    .gte("created_at", today.toISOString())
    .order("waiting_number", { ascending: false })
    .limit(1)
    .single();

  const nextWaitingNumber = (lastTicket?.waiting_number ?? 0) + 1;

  // Create ticket
  const { data: newTicket, error: insertError } = await supabaseAdmin
    .from("tickets")
    .insert({
      store_id,
      guest_id,
      party_size,
      waiting_number: nextWaitingNumber,
      status: "waiting",
    })
    .select()
    .single();

  if (insertError) {
    return {
      data: null,
      error: { code: "DATABASE_ERROR", message: insertError.message },
    };
  }

  // Count groups ahead
  const { count: groupsAhead } = await supabaseAdmin
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store_id)
    .eq("status", "waiting")
    .lt("waiting_number", nextWaitingNumber);

  const estimatedWaitMinutes =
    (groupsAhead ?? 0) * store.estimated_wait_time_per_group;

  return {
    data: {
      reservation: {
        id: newTicket.id,
        waiting_number: newTicket.waiting_number,
        party_size: newTicket.party_size,
        status: newTicket.status,
        groups_ahead: groupsAhead ?? 0,
        estimated_wait_minutes: estimatedWaitMinutes,
        created_at: newTicket.created_at,
      },
    },
    error: null,
  };
}
