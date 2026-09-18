/**
 * POST /guest/createTicket
 *
 * 発券。`stores.status === 'open'` のときのみ受け付ける。
 * 同一アカウント・同一店舗・当日のアクティブなチケット（waiting/called）が
 * 既にあれば新規作成せずそれをそのまま返す（二重タップ・リトライへの耐性）。
 * DB側の unique index (tickets_active_account_per_store_day) が最終防波堤。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayBusinessDate } from "../../utils/business-date.js";
import { createTicketSchema } from "../../utils/validation.js";
import { issueWaitingNumber } from "../../utils/waiting-number.js";
import { markEvent } from "../../utils/store-events.js";
import { toTicket } from "../../utils/serialize.js";
import { fail, prepare } from "../_shared.js";
import type { CreateTicketResponse } from "../../types/api.js";
import type { Database, TicketRow } from "../../types/database.js";

const WHERE = "createTicket";

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

export async function createTicket(body: unknown): Promise<CreateTicketResponse> {
  const p = prepare(WHERE, createTicketSchema, body);
  if (!p.ok) return { ...p.response, ticket: null };

  const { storeID, accountID, name, partySize } = p.data;

  const { data: store, error: storeError } = await p.db
    .from("stores")
    .select("*")
    .eq("id", storeID)
    .maybeSingle();

  if (storeError) {
    return { ...fail(WHERE, `DB error: ${storeError.message}`), ticket: null };
  }
  if (!store || store.status !== "open") {
    return { ...fail(WHERE, `Store ${storeID} is not open`), ticket: null };
  }

  const { data: account, error: accountError } = await p.db
    .from("accounts")
    .select("*")
    .eq("id", accountID)
    .maybeSingle();

  if (accountError) {
    return { ...fail(WHERE, `DB error: ${accountError.message}`), ticket: null };
  }
  if (!account) {
    return { ...fail(WHERE, `Account not found: ${accountID}`), ticket: null };
  }

  const businessDate = todayBusinessDate();

  const existing = await findActiveTicket(p.db, storeID, accountID, businessDate);
  if (existing.error) {
    return { ...fail(WHERE, `DB error: ${existing.error}`), ticket: null };
  }
  if (existing.ticket) {
    return { success: true, ticket: toTicket(existing.ticket, account, store) };
  }

  const issued = await issueWaitingNumber(storeID, businessDate);
  if ("error" in issued) {
    return { ...fail(WHERE, issued.error), ticket: null };
  }

  const { data: created, error: insertError } = await p.db
    .from("tickets")
    .insert({
      store_id: storeID,
      account_id: accountID,
      business_date: businessDate,
      waiting_number: issued.number,
      name,
      party_size: partySize ?? null,
      status: "waiting",
    })
    .select("*")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      // 採番の間に別リクエストが先に発券していた。既存のものを返す
      const retry = await findActiveTicket(p.db, storeID, accountID, businessDate);
      if (retry.ticket) return { success: true, ticket: toTicket(retry.ticket, account, store) };
    }
    return { ...fail(WHERE, `DB error: ${insertError.message}`), ticket: null };
  }
  if (!created) {
    return { ...fail(WHERE, "Insert returned no row"), ticket: null };
  }

  await markEvent(storeID, "add");
  return { success: true, ticket: toTicket(created, account, store) };
}

async function findActiveTicket(
  db: SupabaseClient<Database>,
  storeID: string,
  accountID: string,
  businessDate: string
): Promise<{ ticket: TicketRow | null; error?: string }> {
  const { data, error } = await db
    .from("tickets")
    .select("*")
    .eq("store_id", storeID)
    .eq("account_id", accountID)
    .eq("business_date", businessDate)
    .in("status", ["waiting", "called"])
    .maybeSingle();

  if (error) return { ticket: null, error: error.message };
  return { ticket: data ?? null };
}
