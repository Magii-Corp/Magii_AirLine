/**
 * DB 行 → API DTO
 *
 * 命名の橋渡しはここだけで行う。ハンドラも SSE も必ずここを通すこと。
 * そうしないと REST と SSE で表現がずれる。
 */

import type { AccountRow, StoreRow, TicketRow } from "../types/rows.js";
import type {
  Account,
  AdminStore,
  AdminTicket,
  CustomerStore,
  CustomerTicket,
} from "../types/api.js";
import type { StoreStatus, TicketStatus } from "../domain/transitions.js";
import { todayBusinessDate } from "../domain/business-date.js";

/** Postgres の time は "HH:MM:SS" を返す。仕様は "HH:mm"。 */
function toHhMm(time: string): string {
  return time.slice(0, 5);
}

/**
 * timestamptz を UTC の ISO-8601 にする。
 * pg の型パーサを外しているので "2026-09-20 09:00:00+00" 形式で来る。
 */
export function toIsoUtc(ts: string): string {
  return new Date(ts.replace(" ", "T")).toISOString();
}

export function toAccount(row: AccountRow): Account {
  return { id: row.id, phone_number: row.phone_number };
}

/**
 * counter_date が今日より古い場合は「今日のカウンタはまだ0」として提示する。
 *
 * 仕様は「counterDateが古くてもGETが過去日を今日として返してはいけない」と
 * 「GET自体は書き込まない」を同時に要求する。DB を書き換えずに正しい値を
 * 見せるにはここで正規化するしかない。実際の行は営業日切り替えジョブか、
 * 次の発券時に店舗ロックの中で更新される。
 */
function normalizedCounter(row: StoreRow): { counterDate: string; lastNumber: number } {
  const today = todayBusinessDate();
  return row.counter_date === today
    ? { counterDate: row.counter_date, lastNumber: row.last_number }
    : { counterDate: today, lastNumber: 0 };
}

export function toAdminStore(row: StoreRow): AdminStore {
  const counter = normalizedCounter(row);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    openTime: toHhMm(row.open_time),
    closeTime: toHhMm(row.close_time),
    avgMinutesPerParty: row.avg_minutes_per_party,
    counterDate: counter.counterDate,
    lastNumber: counter.lastNumber,
    status: row.status as StoreStatus,
  };
}

export function toCustomerStore(row: StoreRow): CustomerStore {
  return {
    id: row.id,
    name: row.name,
    openTime: toHhMm(row.open_time),
    closeTime: toHhMm(row.close_time),
    avgMinutesPerParty: row.avg_minutes_per_party,
    status: row.status as StoreStatus,
  };
}

function ticketBase(ticket: TicketRow, account: AccountRow) {
  return {
    id: ticket.id,
    account: toAccount(account),
    business_date: ticket.business_date,
    waitingNumber: ticket.waiting_number,
    name: ticket.name,
    partySize: ticket.party_size,
    status: ticket.status as TicketStatus,
    called_at: ticket.called_at ? toIsoUtc(ticket.called_at) : null,
    updated_at: toIsoUtc(ticket.updated_at),
  };
}

export function toAdminTicket(
  ticket: TicketRow,
  account: AccountRow,
  store: StoreRow
): AdminTicket {
  return { ...ticketBase(ticket, account), store: toAdminStore(store) };
}

export function toCustomerTicket(
  ticket: TicketRow,
  account: AccountRow,
  store: StoreRow
): CustomerTicket {
  return { ...ticketBase(ticket, account), store: toCustomerStore(store) };
}
