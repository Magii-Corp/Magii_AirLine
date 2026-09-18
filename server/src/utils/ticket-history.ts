/**
 * チケットの確定処理（tickets → ticket_history への移送）
 *
 * admin の finishTicket と guest の cancelTicket はどちらも
 * 「tickets の行を同じ id のまま ticket_history へ移し、tickets から削除する」
 * という処理が共通なため、ここに集約する。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinalStatus, TicketRow } from "../types/database.js";

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

export type MoveTicketToHistoryResult = { ok: true } | { ok: false; error: string };

/**
 * NOTE: insert と delete は別文なので厳密には原子的でない。
 * ticket_history.id は tickets.id を引き継ぐ主キーなので、
 * insert 済み / delete 未了の中断は再実行で回復できる（unique_violationの分岐）。
 * 完全な原子性が必要になったら DB 関数 (RPC) に寄せる。
 */
export async function moveTicketToHistory(
  db: SupabaseClient<Database>,
  ticket: TicketRow,
  finalState: FinalStatus,
  where: string
): Promise<MoveTicketToHistoryResult> {
  const { error: insertError } = await db.from("ticket_history").insert({
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
    return { ok: false, error: `DB error on history insert: ${insertError.message}` };
  }
  if (insertError) {
    // 前回の実行が delete 前に落ちたケース。履歴は既にあるので削除だけ進める。
    console.warn(
      `[${where}] History for ${ticket.id} already exists; deleting ticket only`
    );
  }

  const { error: deleteError } = await db
    .from("tickets")
    .delete()
    .eq("id", ticket.id);

  if (deleteError) {
    return { ok: false, error: `DB error on delete: ${deleteError.message}` };
  }

  return { ok: true };
}
