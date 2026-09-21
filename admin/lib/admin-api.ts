export type TicketStatus = "waiting" | "called" | "done" | "cancelled";
export type Account = { id: string; phone_number: string };
export type Store = {
  id: string; email: string; name: string; openTime: string; closeTime: string;
  avgMinutesPerParty: number; counterDate: string; lastNumber: number; status: "open" | "closed";
};
export type AdminTicket = {
  id: string; account: Account; store: Store; business_date: string;
  waitingNumber: number; name: string; partySize: number;
  status: TicketStatus; called_at: string | null; updated_at: string;
};
export type LoginInput = { email: string; password: string };
export type StoreRegisterInput = {
  email: string; name: string; password: string; openTime: string; closeTime: string;
  avgMinutesPerParty: number; counterDate: string; lastNumber: number; status: string;
};
export type ApiResult = { success: boolean; message?: string };
export type CallNextResult = ApiResult & { ticket: AdminTicket; serverTime: string };
export type TicketUpdatedEvent = { type: "ticket.updated"; ticket: AdminTicket; serverTime: string };
export type DashboardResult = { store: Store; tickets: AdminTicket[]; businessDate: string; serverTime: string };
export type StoreSettingsInput = {
  storeID: string;
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  status: "open" | "closed";
};

export const ADMIN_API_PATHS = {
  login: "/admin/auth/login",
  storeRegister: "/admin/stores",
  dashboard: "/admin/dashboard",
  callNext: "/admin/tickets/call-next",
  ticketState: (ticketID: string) => `/admin/tickets/${encodeURIComponent(ticketID)}/status`,
  ticketEvents: "/admin/tickets/events",
  storeSettings: "/admin/store/settings",
} as const;


/** Next.jsの中継パス、または管理バックエンドのURL。 */
const baseURL = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.trim().replace(/\/+$/, "");
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (!baseURL) throw new Error("管理APIの接続先が設定されていません");
  let response: Response;
  try {
    response = await fetch(baseURL + path, {
    method, cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("管理APIに接続できません。サーバーの起動状態と接続先を確認してください");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`管理APIから正しい応答を受け取れませんでした（HTTP ${response.status}）。接続先とサーバーの起動状態を確認してください`);
  }
  if (!result || typeof result !== "object") throw new Error("管理APIの応答形式が不正です");
  if (!response.ok || result.success === false) throw new Error(result.message || "通信に失敗しました");
  return result as T;
}
export function getDashboard(storeID: string): Promise<DashboardResult> {
  return request(ADMIN_API_PATHS.dashboard + "?storeID=" + encodeURIComponent(storeID));
}
export function login(input: LoginInput): Promise<ApiResult & { storeID: string }> {
  return request(ADMIN_API_PATHS.login, "POST", input);
}
export function storeRegister(input: StoreRegisterInput): Promise<ApiResult & { store: Store }> {
  return request(ADMIN_API_PATHS.storeRegister, "POST", input);
}
export function callNext(storeID: string): Promise<CallNextResult> {
  return request(ADMIN_API_PATHS.callNext, "POST", { storeID });
}
export function changeTicketState(storeID: string, ticketID: string, newState: TicketStatus): Promise<CallNextResult> {
  return request(ADMIN_API_PATHS.ticketState(ticketID), "PATCH", { storeID, newState });
}
export function setStoreSettings(input: StoreSettingsInput): Promise<ApiResult & { store: Store; serverTime: string }> {
  return request(ADMIN_API_PATHS.storeSettings, "PATCH", input);
}
/** 通知は再取得の契機。スナップショットで削除・営業日切替も同期する。 */
export function subscribeTicketUpdates(storeID: string, onChange: () => void): () => void {
  if (!baseURL) return () => undefined;
  const source = new EventSource(baseURL + ADMIN_API_PATHS.ticketEvents + "?storeID=" + encodeURIComponent(storeID));
  source.onopen = onChange;
  for (const event of ["ticket.created", "ticket.updated", "ticket.deleted", "store.updated", "business-date.changed", "sync.required"]) {
    source.addEventListener(event, onChange);
  }
  return () => source.close();
}
