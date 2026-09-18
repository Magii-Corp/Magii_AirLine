/**
 * API Request/Response Types
 *
 * DB は snake_case、API は camelCase。変換は utils/serialize.ts に集約する。
 */

import type {
  FinalStatus,
  StoreStatus,
  TicketStatus,
} from "./database.js";

// ============================================================
// Common
// ============================================================

/**
 * 操作系エンドポイントの共通レスポンス。
 * 設計メモの方針により、失敗理由はボディに含めない（サーバログには残す）。
 */
export interface SuccessResponse {
  success: boolean;
}

// ============================================================
// Entities
// ============================================================

export interface Account {
  id: string;
  phoneNumber: string | null;
}

export interface Store {
  id: string;
  ownerID: string;
  name: string;
  /** "HH:MM:SS" */
  openTime: string;
  /** "HH:MM:SS" */
  closeTime: string;
  avgMinutesPerParty: number;
  /** 採番カウンタの対象営業日 "YYYY-MM-DD" */
  counterDate: string | null;
  lastNumber: number;
  status: StoreStatus | null;
}

export interface Ticket {
  id: string;
  account: Account;
  /** 設計メモの `store: Store` から変更。一覧で店舗情報が件数分重複するため */
  storeID: string;
  /** "YYYY-MM-DD" */
  businessDate: string;
  waitingNumber: number;
  name: string;
  partySize: number | null;
  status: TicketStatus;
  /** 管理画面が待ち時間を算出するために必要（設計メモには無い追加分） */
  createdAt: string;
  calledAt: string | null;
}

// ============================================================
// Admin Endpoints
// ============================================================

/** GET /admin/getTickets */
export interface GetTicketsQuery {
  storeID: string;
}

export interface GetTicketsResponse {
  tickets: Ticket[];
}

/** POST /admin/login */
export interface LoginRequest {
  storeID: string;
  password: string;
}

/** POST /admin/callNext */
export interface CallNextRequest {
  storeID: string;
}

/** GET /admin/getEvent */
export interface GetEventQuery {
  storeID: string;
}

export interface GetEventResponse {
  add: boolean;
  remove: boolean;
  update: boolean;
}

/** POST /admin/resetEvent */
export interface ResetEventRequest {
  storeID: string;
}

/** POST /admin/changeTicketState — waiting / called の往復のみ */
export interface ChangeTicketStateRequest {
  ticketID: string;
  newState: TicketStatus;
}

/**
 * POST /admin/finishTicket
 * tickets の CHECK 制約が waiting/called しか許さないため、
 * 確定は ticket_history への移送になる。
 */
export interface FinishTicketRequest {
  ticketID: string;
  finalState: FinalStatus;
}

/** POST /admin/changeAvgMinutesPerParty */
export interface ChangeAvgMinutesPerPartyRequest {
  storeID: string;
  newValue: number;
}

/** POST /admin/changeOpenTime */
export interface ChangeOpenTimeRequest {
  storeID: string;
  /** "HH:MM:SS" */
  newValue: string;
}

/** POST /admin/changeCloseTime */
export interface ChangeCloseTimeRequest {
  storeID: string;
  /** "HH:MM:SS" */
  newValue: string;
}

/** POST /admin/changeStoreState */
export interface ChangeStoreStateRequest {
  storeID: string;
  newState: StoreStatus;
}
