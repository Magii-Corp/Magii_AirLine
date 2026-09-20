/**
 * API の DTO
 *
 * DB は snake_case、API は camelCase。変換は serialize/ に集約する。
 *
 * ただし仕様が snake_case を指定しているフィールドはそのまま従う:
 *   Account.phone_number
 *   Ticket.business_date / called_at / updated_at
 * （仕様書の型定義をそのまま写したもの。勝手に camelCase へ直さないこと）
 */

import type { StoreStatus, TicketStatus } from "../domain/transitions.js";

export interface Account {
  id: string;
  phone_number: string;
}

/** 管理側に返す店舗。email / counterDate / lastNumber を含む */
export interface AdminStore {
  id: string;
  email: string;
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  counterDate: string;
  lastNumber: number;
  status: StoreStatus;
}

/** お客様側に返す店舗。email / counterDate / lastNumber は返さない */
export interface CustomerStore {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  status: StoreStatus;
}

export type Store = AdminStore | CustomerStore;

export interface Ticket<S extends Store = Store> {
  id: string;
  account: Account;
  store: S;
  business_date: string;
  waitingNumber: number;
  name: string;
  partySize: number;
  status: TicketStatus;
  called_at: string | null;
  updated_at: string;
}

export type AdminTicket = Ticket<AdminStore>;
export type CustomerTicket = Ticket<CustomerStore>;

export interface ErrorBody {
  success: false;
  code: string;
  message: string;
}
