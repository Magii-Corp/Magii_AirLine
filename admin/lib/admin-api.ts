export type TicketStatus = "waiting" | "called" | "done" | "cancelled";
export type Account = { id: string; phone_number: string };
export type Store = {
  id: string; email: string; name: string; openTime: string; closeTime: string;
  avgMinutesPerParty: number; counterDate: string; lastNumber: number; status: string;
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
export type CallNextResult = ApiResult & { ticket?: AdminTicket; serverTime?: string };
export type TicketUpdatedEvent = { type: "ticket.updated"; ticket: AdminTicket; serverTime: string };
export type DashboardResult = { store: Store; tickets: AdminTicket[]; businessDate: string; serverTime: string };
export type StoreSettingsInput = {
  email: string;
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  status: string;
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

const demoStore: Store = {
  id: "store-demo", email: "owner@example.com", name: "Magii Coffee 渋谷店",
  openTime: "10:00", closeTime: "20:00", avgMinutesPerParty: 8,
  counterDate: new Date().toISOString().slice(0, 10), lastNumber: 9, status: "open",
};
const demoTickets: AdminTicket[] = [
  { id: "ticket-12", account: { id: "account-1", phone_number: "090-0000-0001" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 0, name: "山田 太郎", partySize: 2, status: "done", called_at: new Date(Date.now() - 2 * 60_000).toISOString(), updated_at: new Date().toISOString() },
  { id: "ticket-13", account: { id: "account-2", phone_number: "090-0000-0002" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 1, name: "鈴木 花子", partySize: 4, status: "cancelled", called_at: null, updated_at: new Date().toISOString() },
  { id: "ticket-14", account: { id: "account-3", phone_number: "090-0000-0003" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 2, name: "田中 一郎", partySize: 1, status: "called", called_at: new Date(Date.now() - 3 * 60_000).toISOString(), updated_at: new Date().toISOString() },
  { id: "ticket-15", account: { id: "account-4", phone_number: "090-0000-0004" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 3, name: "佐藤 美咲", partySize: 3, status: "done", called_at: new Date(Date.now() - 7 * 60_000).toISOString(), updated_at: new Date().toISOString() },
  { id: "ticket-16", account: { id: "account-5", phone_number: "090-0000-0005" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 4, name: "高橋 健", partySize: 2, status: "called", called_at: new Date(Date.now() - 11 * 60_000).toISOString(), updated_at: new Date().toISOString() },
  { id: "ticket-17", account: { id: "account-6", phone_number: "090-0000-0006" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 5, name: "伊藤 彩", partySize: 2, status: "called", called_at: new Date(Date.now() - 5 * 60_000).toISOString(), updated_at: new Date().toISOString() },
  { id: "ticket-18", account: { id: "account-7", phone_number: "090-0000-0007" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 6, name: "渡辺 誠", partySize: 5, status: "waiting", called_at: null, updated_at: new Date().toISOString() },
  { id: "ticket-19", account: { id: "account-8", phone_number: "090-0000-0008" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 7, name: "中村 由佳", partySize: 1, status: "waiting", called_at: null, updated_at: new Date().toISOString() },
  { id: "ticket-20", account: { id: "account-9", phone_number: "090-0000-0009" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 8, name: "小林 拓海", partySize: 4, status: "waiting", called_at: null, updated_at: new Date().toISOString() },
  { id: "ticket-21", account: { id: "account-10", phone_number: "090-0000-0010" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 9, name: "加藤 真央", partySize: 2, status: "waiting", called_at: null, updated_at: new Date().toISOString() },
];

// API接続時は、各関数の中身だけを fetch などに置き換えてください。
export async function getTickets(email: string): Promise<{ tickets: AdminTicket[] }> {
  const dashboard = await getDashboard(email);
  return { tickets: dashboard.tickets };
}
export async function getDashboard(email: string): Promise<DashboardResult> {
  void email;
  const businessDate = demoStore.counterDate;
  return {
    store: demoStore,
    tickets: demoTickets.filter((ticket) => ticket.business_date === businessDate).map((ticket) => ({ ...ticket })),
    businessDate,
    serverTime: new Date().toISOString(),
  };
}
export async function login(input: LoginInput): Promise<ApiResult> {
  void input;
  return { success: true };
}
export async function storeRegister(input: StoreRegisterInput): Promise<ApiResult> {
  void input;
  return { success: true };
}
export async function callNext(email: string): Promise<CallNextResult> {
  void email;
  const ticket = demoTickets.find((candidate) => candidate.status === "waiting");
  const serverTime = new Date().toISOString();
  if (!ticket) return { success: false, message: "待機中のチケットがありません", serverTime };
  ticket.status = "called";
  ticket.called_at = serverTime;
  ticket.updated_at = serverTime;
  return { success: true, ticket: { ...ticket }, serverTime };
}

// 管理バックエンドが公開するSSE（GET）へ接続するための購読境界。
// フロントからSupabaseへ直接接続せず、実装時はEventSourceで管理APIを購読する。
export function subscribeTicketUpdates(
  email: string,
  onEvent: (event: TicketUpdatedEvent) => void,
): () => void {
  void email;
  void onEvent;
  return () => undefined;
}
export async function changeTicketState(ticketID: string, newState: TicketStatus): Promise<ApiResult> {
  const ticket = demoTickets.find((candidate) => candidate.id === ticketID);
  if (!ticket) return { success: false, message: "チケットが見つかりません" };
  ticket.status = newState;
  ticket.called_at = newState === "called" ? (ticket.called_at ?? new Date().toISOString()) : ticket.called_at;
  ticket.updated_at = new Date().toISOString();
  return { success: true };
}

export async function setStoreSettings(input: StoreSettingsInput): Promise<ApiResult & { store?: Store }> {
  void input.email;
  demoStore.name = input.name;
  demoStore.openTime = input.openTime;
  demoStore.closeTime = input.closeTime;
  demoStore.avgMinutesPerParty = input.avgMinutesPerParty;
  demoStore.status = input.status;
  return { success: true, store: { ...demoStore } };
}
