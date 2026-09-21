/**
 * GET /admin/dashboard
 * Get dashboard data for store management
 */

import { supabaseAdmin } from "../utils/supabase.js";
import type { DashboardResponse, ApiResult } from "../types/api.js";
import type { TicketStatus } from "../types/database.js";

export async function getDashboard(
  storeId: string
): Promise<ApiResult<DashboardResponse>> {
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
    .eq("id", storeId)
    .single();

  if (storeError || !store) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Store not found" },
    };
  }

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get stats for today
  const statuses: TicketStatus[] = [
    "waiting",
    "called",
    "seated",
    "no_show",
    "cancelled",
  ];
  const stats: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", status)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());

    stats[`${status}_count`] = count ?? 0;
  }

  // Get queue (waiting and called tickets)
  const { data: queue, error: queueError } = await supabaseAdmin
    .from("tickets")
    .select(
      `
      *,
      guests (name)
    `
    )
    .eq("store_id", storeId)
    .in("status", ["waiting", "called"])
    .order("status", { ascending: true }) // called first
    .order("waiting_number", { ascending: true });

  if (queueError) {
    return {
      data: null,
      error: { code: "DATABASE_ERROR", message: queueError.message },
    };
  }

  const now = new Date();
  const queueItems = (queue ?? []).map((ticket) => {
    const createdAt = new Date(ticket.created_at);
    const waitTimeMinutes = Math.floor(
      (now.getTime() - createdAt.getTime()) / 60000
    );
    const guestName =
      (ticket.guests as { name: string } | null)?.name ?? "Unknown";

    return {
      id: ticket.id,
      waiting_number: ticket.waiting_number,
      guest_name: guestName,
      party_size: ticket.party_size,
      status: ticket.status,
      wait_time_minutes: waitTimeMinutes,
      created_at: ticket.created_at,
    };
  });

  return {
    data: {
      store: {
        id: store.id,
        name: store.name,
        is_accepting: store.is_accepting,
      },
      stats: {
        waiting_count: stats["waiting_count"] ?? 0,
        called_count: stats["called_count"] ?? 0,
        seated_count: stats["seated_count"] ?? 0,
        no_show_count: stats["no_show_count"] ?? 0,
        cancelled_count: stats["cancelled_count"] ?? 0,
      },
      queue: queueItems,
    },
    error: null,
  };
}
