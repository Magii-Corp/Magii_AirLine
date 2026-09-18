/**
 * GET /guest/getMyTicket
 *
 * 当日の自分のチケットを取得する。ポーリング用の唯一の窓口。
 * `ticket.status` で waiting/called を判定でき、店舗側が finishTicket で
 * 確定させた場合は tickets から消えるため、その際は ticket_history を見て
 * `finalStatus` を返す（呼ばれたか/取り消されたかは別APIにしない）。
 */

import { todayBusinessDate } from "../../utils/business-date.js";
import { getMyTicketSchema } from "../../utils/validation.js";
import { toTicket } from "../../utils/serialize.js";
import { prepare } from "../_shared.js";
import type { GetMyTicketResponse } from "../../types/api.js";

const WHERE = "getMyTicket";

const EMPTY: GetMyTicketResponse = { ticket: null, finalStatus: null };

export async function getMyTicket(query: unknown): Promise<GetMyTicketResponse> {
  const p = prepare(WHERE, getMyTicketSchema, query);
  if (!p.ok) return EMPTY;

  const { accountID, storeID } = p.data;
  const businessDate = todayBusinessDate();

  const { data: ticket, error: ticketError } = await p.db
    .from("tickets")
    .select("*")
    .eq("account_id", accountID)
    .eq("store_id", storeID)
    .eq("business_date", businessDate)
    .maybeSingle();

  if (ticketError) {
    console.warn(`[${WHERE}] DB error: ${ticketError.message}`);
    return EMPTY;
  }

  if (ticket) {
    const [{ data: account }, { data: store }] = await Promise.all([
      p.db.from("accounts").select("*").eq("id", accountID).maybeSingle(),
      p.db.from("stores").select("*").eq("id", storeID).maybeSingle(),
    ]);

    if (!store) return EMPTY;
    return { ticket: toTicket(ticket, account ?? null, store), finalStatus: null };
  }

  const { data: history, error: historyError } = await p.db
    .from("ticket_history")
    .select("final_status")
    .eq("account_id", accountID)
    .eq("store_id", storeID)
    .eq("business_date", businessDate)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (historyError) {
    console.warn(`[${WHERE}] DB error: ${historyError.message}`);
    return EMPTY;
  }

  return { ticket: null, finalStatus: history?.final_status ?? null };
}
