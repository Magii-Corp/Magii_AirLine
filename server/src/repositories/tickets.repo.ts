/**
 * tickets へのアクセス
 */

import type { Tx } from "../db/tx.js";
import { supabaseRead } from "../db/supabase.js";
import type { AccountRow, StoreRow, TicketRow } from "../types/rows.js";

const COLUMNS = `
  id, store_id, account_id, business_date, waiting_number, name,
  party_size, status, created_at, called_at, updated_at
`;

export type TicketWithRelations = TicketRow & {
  accounts: AccountRow;
  stores: StoreRow;
};

// ---------------------------------------------------------------- 読み取り

export async function readTicketById(
  ticketId: string
): Promise<TicketWithRelations | null> {
  const { data, error } = await supabaseRead
    .from("tickets")
    .select("*, accounts(*), stores(*)")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) throw error;
  return (data as TicketWithRelations | null) ?? null;
}

/**
 * 指定アカウント・店舗・本日の waiting/called の受付。
 * done/cancelled は返さない（仕様）。
 * 部分ユニークインデックスにより最大1件であることが保証されている。
 */
export async function readMyTicket(
  accountId: string,
  storeId: string,
  businessDate: string
): Promise<TicketWithRelations | null> {
  const { data, error } = await supabaseRead
    .from("tickets")
    .select("*, accounts(*), stores(*)")
    .eq("account_id", accountId)
    .eq("store_id", storeId)
    .eq("business_date", businessDate)
    .in("status", ["waiting", "called"])
    .maybeSingle();

  if (error) throw error;
  return (data as TicketWithRelations | null) ?? null;
}

/**
 * 自分より前の waiting 件数。
 * 並び順のタイブレークはダッシュボードと同じ (waiting_number, id)。
 */
export async function countWaitingAhead(
  storeId: string,
  businessDate: string,
  waitingNumber: number,
  ticketId: string
): Promise<number> {
  const { count, error } = await supabaseRead
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("business_date", businessDate)
    .eq("status", "waiting")
    .or(
      `waiting_number.lt.${waitingNumber},and(waiting_number.eq.${waitingNumber},id.lt.${ticketId})`
    );

  if (error) throw error;
  return count ?? 0;
}

/**
 * 本日の waiting を並び順どおりに返す（id のみ）。
 *
 * queue.updated を配るとき、接続ごとに件数を数え直すと接続数ぶん
 * クエリが飛ぶ。1回取ってきて配列の添字を groupsAhead として使う。
 */
export async function readWaitingOrder(
  storeId: string,
  businessDate: string
): Promise<string[]> {
  const { data, error } = await supabaseRead
    .from("tickets")
    .select("id")
    .eq("store_id", storeId)
    .eq("business_date", businessDate)
    .eq("status", "waiting")
    .order("waiting_number", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => (r as { id: string }).id);
}

// ---------------------------------------------------------------- 書き込み

/** 書き込みトランザクション内で読むための版 */
export async function getTicketInTx(tx: Tx, ticketId: string): Promise<TicketRow | null> {
  const res = await tx.query<TicketRow>(
    `select ${COLUMNS} from public.tickets where id = $1`,
    [ticketId]
  );
  return res.rows[0] ?? null;
}

export async function countWaitingAheadInTx(
  tx: Tx,
  ticket: TicketRow
): Promise<number> {
  const res = await tx.query<{ count: string }>(
    `select count(*) as count from public.tickets
      where store_id = $1 and business_date = $2 and status = 'waiting'
        and (waiting_number, id) < ($3, $4)`,
    [ticket.store_id, ticket.business_date, ticket.waiting_number, ticket.id]
  );
  return Number(res.rows[0]?.count ?? 0);
}

/**
 * 待機列の先頭を1件 called にする。
 *
 * 選択と更新を1文にまとめているので「二重呼び出しを防ぐため選択と更新を
 * 同一トランザクションで行う」を満たす。
 *
 * SKIP LOCKED により「同時呼び出し数に上限なし」が実性能として成立する。
 * 同時に2リクエストが来ても1番で詰まらず、それぞれ1番と2番を取る。
 */
export async function callNext(
  tx: Tx,
  storeId: string,
  businessDate: string
): Promise<TicketRow | null> {
  const res = await tx.query<TicketRow>(
    `with next as (
       select id from public.tickets
        where store_id = $1 and business_date = $2 and status = 'waiting'
        order by waiting_number, id
        limit 1
        for update skip locked
     )
     update public.tickets t
        set status = 'called', called_at = now()
       from next
      where t.id = next.id
     returning t.id, t.store_id, t.account_id, t.business_date, t.waiting_number,
               t.name, t.party_size, t.status, t.created_at, t.called_at, t.updated_at`,
    [storeId, businessDate]
  );
  return res.rows[0] ?? null;
}

/**
 * 状態を更新する。called にする場合だけ called_at を DB 時刻で設定し、
 * 他の状態では既存値を保持する。
 */
export async function updateStatus(
  tx: Tx,
  ticketId: string,
  newStatus: string,
  setCalledAt: boolean
): Promise<TicketRow> {
  const res = await tx.query<TicketRow>(
    `update public.tickets
        set status = $2,
            called_at = case when $3 then now() else called_at end
      where id = $1
     returning ${COLUMNS}`,
    [ticketId, newStatus, setCalledAt]
  );
  return res.rows[0]!;
}

export interface CreateTicketInput {
  storeId: string;
  accountId: string;
  businessDate: string;
  waitingNumber: number;
  name: string;
  partySize: number;
}

export async function createTicket(
  tx: Tx,
  input: CreateTicketInput
): Promise<TicketRow> {
  const res = await tx.query<TicketRow>(
    `insert into public.tickets
       (store_id, account_id, business_date, waiting_number, name, party_size)
     values ($1, $2, $3, $4, $5, $6)
     returning ${COLUMNS}`,
    [
      input.storeId,
      input.accountId,
      input.businessDate,
      input.waitingNumber,
      input.name,
      input.partySize,
    ]
  );
  return res.rows[0]!;
}

/** 本日そのアカウントがこの店舗で持っているアクティブな券 */
export async function findActiveTicket(
  tx: Tx,
  storeId: string,
  accountId: string,
  businessDate: string
): Promise<TicketRow | null> {
  const res = await tx.query<TicketRow>(
    `select ${COLUMNS} from public.tickets
      where store_id = $1 and account_id = $2 and business_date = $3
        and status in ('waiting', 'called')`,
    [storeId, accountId, businessDate]
  );
  return res.rows[0] ?? null;
}

/** id と accountID の両方で特定する。不一致は「見つからない」として扱う。 */
export async function getOwnedTicket(
  tx: Tx,
  ticketId: string,
  accountId: string
): Promise<TicketRow | null> {
  const res = await tx.query<TicketRow>(
    `select ${COLUMNS} from public.tickets where id = $1 and account_id = $2 for update`,
    [ticketId, accountId]
  );
  return res.rows[0] ?? null;
}

/** レスポンス用に、同じトランザクション内で関連行ごと読み直す */
export async function hydrateInTx(
  tx: Tx,
  ticketId: string
): Promise<{ ticket: TicketRow; account: AccountRow; store: StoreRow } | null> {
  const res = await tx.query<{
    ticket: TicketRow;
    account: AccountRow;
    store: StoreRow;
  }>(
    `select to_jsonb(t) as ticket, to_jsonb(a) as account, to_jsonb(s) as store
       from public.tickets t
       join public.accounts a on a.id = t.account_id
       join public.stores   s on s.id = t.store_id
      where t.id = $1`,
    [ticketId]
  );
  return res.rows[0] ?? null;
}
