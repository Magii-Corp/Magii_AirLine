/**
 * DB 行 (snake_case) → API レスポンス (camelCase) の変換
 *
 * 命名の橋渡しはここだけで行う。各関数は必ずこれを通してから返すこと。
 */

import type {
  AccountRow,
  StoreRow,
  TicketRow,
  StoreEventsRow,
} from "../types/database.js";
import type {
  Account,
  Store,
  Ticket,
  GetEventResponse,
} from "../types/api.js";

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
  };
}

export function toStore(row: StoreRow): Store {
  return {
    id: row.id,
    ownerID: row.owner_id,
    name: row.name,
    openTime: row.open_time,
    closeTime: row.close_time,
    avgMinutesPerParty: row.avg_minutes_per_party,
    counterDate: row.counter_date,
    lastNumber: row.last_number,
    status: row.status,
  };
}

/**
 * account は join 済みの行を受け取る。
 * 取得できなかった場合は id だけ埋めた最小の Account を返す。
 */
export function toTicket(row: TicketRow, account: AccountRow | null): Ticket {
  return {
    id: row.id,
    account: account
      ? toAccount(account)
      : { id: row.account_id, phoneNumber: null },
    storeID: row.store_id,
    businessDate: row.business_date,
    waitingNumber: row.waiting_number,
    name: row.name,
    partySize: row.party_size,
    status: row.status,
    createdAt: row.created_at,
    calledAt: row.called_at,
  };
}

/** DB 側は予約語を避けて has_ 接頭辞。API はメモ通りの名前に戻す */
export function toEvent(row: StoreEventsRow | null): GetEventResponse {
  return {
    add: row?.has_add ?? false,
    remove: row?.has_remove ?? false,
    update: row?.has_update ?? false,
  };
}
