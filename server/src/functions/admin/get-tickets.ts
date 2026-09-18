/**
 * GET /admin/getTickets
 * 当日の待ち行列を取得する
 */

import { todayBusinessDate } from "../../utils/business-date.js";
import { getTicketsSchema } from "../../utils/validation.js";
import { toTicket } from "../../utils/serialize.js";
import { prepare } from "../_shared.js";
import type { GetTicketsResponse, Ticket } from "../../types/api.js";
import type { AccountRow } from "../../types/database.js";

const WHERE = "getTickets";

export async function getTickets(
  query: unknown
): Promise<GetTicketsResponse> {
  const p = prepare(WHERE, getTicketsSchema, query);
  if (!p.ok) return { tickets: [] };

  const { storeID } = p.data;
  const businessDate = todayBusinessDate();

  const { data: store, error: storeError } = await p.db
    .from("stores")
    .select("*")
    .eq("id", storeID)
    .maybeSingle();

  if (storeError) {
    console.warn(`[${WHERE}] DB error: ${storeError.message}`);
    return { tickets: [] };
  }
  if (!store) return { tickets: [] };

  const { data: rows, error } = await p.db
    .from("tickets")
    .select("*")
    .eq("store_id", storeID)
    .eq("business_date", businessDate)
    .order("status", { ascending: true }) // called が waiting より先
    .order("waiting_number", { ascending: true });

  if (error) {
    console.warn(`[${WHERE}] DB error: ${error.message}`);
    return { tickets: [] };
  }
  if (!rows || rows.length === 0) return { tickets: [] };

  // account はまとめて 1 回で引く（join せず 2 クエリにすることで件数に依らず一定）
  const accountIds = [...new Set(rows.map((r) => r.account_id))];
  const { data: accounts } = await p.db
    .from("accounts")
    .select("*")
    .in("id", accountIds);

  const byId = new Map<string, AccountRow>(
    (accounts ?? []).map((a) => [a.id, a])
  );

  const tickets: Ticket[] = rows.map((row) =>
    toTicket(row, byId.get(row.account_id) ?? null, store)
  );

  return { tickets };
}
