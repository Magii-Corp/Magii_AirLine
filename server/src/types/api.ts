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
  /** `stores.store_mail`。ログインに使う店舗のメールアドレス */
  email: string;
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
  store: Store;
  /** "YYYY-MM-DD" */
  businessDate: string;
  waitingNumber: number;
  name: string;
  partySize: number | null;
  status: TicketStatus;
  /** 管理画面が待ち時間を算出するために必要（設計メモには無い追加分） */
  createdAt: string;
  calledAt: string | null;
  /** [到着しました] を押した時刻。status/確定とは独立 */
  arrivedAt: string | null;
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

/**
 * POST /admin/register — 店舗の新規作成。
 * 設計書のレスポンスは `{ success }` のみだが、それだと登録後に storeID を知る
 * 手段が無く login できないため、実用上の必要性から storeID を返すようにしている。
 */
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  openTime?: string;
  closeTime?: string;
  avgMinutesPerParty?: number;
  counterDate?: string | null;
  lastNumber?: number;
  status?: StoreStatus | null;
}

export interface RegisterResponse {
  success: boolean;
  storeID: string | null;
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

// ============================================================
// Guest Endpoints
// ============================================================

/**
 * POST /guest/register — phone_number + password でアカウントを新規作成する。
 * 電話番号が既に登録済みなら success: false（login を使うべき）。
 */
export interface GuestRegisterRequest {
  phone: string;
  password: string;
}

/**
 * POST /guest/login — phone_number + password で既存アカウントを認証する。
 * register/login とも accountID を返す。以降 createTicket 等はこの accountID を使う。
 */
export interface GuestLoginRequest {
  phone: string;
  password: string;
}

export interface GuestAuthResponse {
  success: boolean;
  accountID: string | null;
}

/** POST /guest/createTicket */
export interface CreateTicketRequest {
  storeID: string;
  accountID: string;
  name: string;
  partySize?: number;
}

export interface CreateTicketResponse {
  success: boolean;
  ticket: Ticket | null;
}

/** GET /guest/getMyTicket */
export interface GetMyTicketQuery {
  accountID: string;
  storeID: string;
}

export interface GetMyTicketResponse {
  ticket: Ticket | null;
  /** ticket が null かつ当日決着済みのチケットがあった場合のみ入る */
  finalStatus: FinalStatus | null;
}

/** POST /guest/cancelTicket — waiting の間のみ可能 */
export interface CancelTicketRequest {
  ticketID: string;
}

/** POST /guest/arrive — arrivedAt を記録するのみ。status/確定は変えない */
export interface ArriveRequest {
  ticketID: string;
}

/** GET /guest/getStore — QR読み取り後の表示用 */
export interface GetStoreQuery {
  storeID: string;
}

export interface GetStoreResponse {
  store: Store | null;
  waitingCount: number;
  estimatedWaitMinutes: number;
}
