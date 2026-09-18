export type TicketStatus = "Waiting" | "Called" | "Done";
export type Account = { id: string; phone_number: string };
export type Store = {
  id: string; email: string; name: string; openTime: string; closeTime: string;
  avgMinutesPerParty: number; counterDate: string; lastNumber: number; status: string;
};
export type AdminTicket = {
  id: string; account: Account; store: Store; business_date: string;
  waitingNumber: number; name: string; partySize: number;
  status: TicketStatus; called_at: string | null;
};
export type LoginInput = { email: string; password: string };
export type StoreRegisterInput = {
  email: string; name: string; password: string; openTime: string; closeTime: string;
  avgMinutesPerParty: number; counterDate: string; lastNumber: number; status: string;
};
export type ApiResult = { success: boolean; message?: string };

const demoStore: Store = {
  id: "store-demo", email: "owner@example.com", name: "Magii Coffee 渋谷店",
  openTime: "10:00", closeTime: "20:00", avgMinutesPerParty: 8,
  counterDate: new Date().toISOString().slice(0, 10), lastNumber: 14, status: "open",
};
const demoTickets: AdminTicket[] = [
  { id: "ticket-12", account: { id: "account-1", phone_number: "090-0000-0001" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 12, name: "山田 太郎", partySize: 2, status: "Waiting", called_at: new Date().toISOString() },
  { id: "ticket-13", account: { id: "account-2", phone_number: "090-0000-0002" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 13, name: "鈴木 花子", partySize: 4, status: "Waiting", called_at: null },
  { id: "ticket-14", account: { id: "account-3", phone_number: "090-0000-0003" }, store: demoStore, business_date: demoStore.counterDate, waitingNumber: 14, name: "田中 一郎", partySize: 1, status: "Waiting", called_at: null },
];

// API接続時は、各関数の中身だけを fetch などに置き換えてください。
export async function getTickets(email: string): Promise<{ tickets: AdminTicket[] }> {
  void email;
  return { tickets: demoTickets.map((ticket) => ({ ...ticket })) };
}
export async function login(input: LoginInput): Promise<ApiResult> {
  void input;
  return { success: true };
}
export async function storeRegister(input: StoreRegisterInput): Promise<ApiResult> {
  void input;
  return { success: true };
}
export async function callNext(email: string): Promise<ApiResult> {
  void email;
  return { success: true };
}
export async function changeTicketState(ticketID: string, newState: TicketStatus): Promise<ApiResult> {
  void ticketID;
  void newState;
  return { success: true };
}

export async function changeAvgMinutesPerParty(email: string, newValue: number): Promise<ApiResult> {
  void email;
  void newValue;
  return { success: true };
}

export async function changeOpenTime(email: string, newValue: string): Promise<ApiResult> {
  void email;
  void newValue;
  return { success: true };
}

export async function changeCloseTime(email: string, newValue: string): Promise<ApiResult> {
  void email;
  void newValue;
  return { success: true };
}

export async function changeStoreState(email: string, newState: string): Promise<ApiResult> {
  void email;
  void newState;
  return { success: true };
}
