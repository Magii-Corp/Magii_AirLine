/**
 * SSE 接続のレジストリ
 *
 * 顧客接続は ticketID と storeID の両方の索引に載せる。
 * store.updated / queue.updated を配るたびに DB を引かずに済ませるため、
 * 接続時に storeID / accountID / businessDate をキャッシュしておく。
 */

export interface SseConn {
  readonly id: string;
  readonly kind: "admin" | "customer";
  readonly storeID: string;
  readonly ticketID?: string | undefined;
  readonly accountID?: string | undefined;
  readonly businessDate?: string | undefined;
  send(event: string, data: unknown): void;
}

const adminByStore = new Map<string, Set<SseConn>>();
const customerByTicket = new Map<string, Set<SseConn>>();
const customerByStore = new Map<string, Set<SseConn>>();

/** 1店舗あたりの同時接続数の上限。無制限だとメモリが守れない。 */
const MAX_PER_STORE = 50;

function add(map: Map<string, Set<SseConn>>, key: string, conn: SseConn): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(conn);
}

function remove(map: Map<string, Set<SseConn>>, key: string, conn: SseConn): void {
  const set = map.get(key);
  if (!set) return;
  set.delete(conn);
  if (set.size === 0) map.delete(key);
}

export function countAdmins(storeID: string): number {
  return adminByStore.get(storeID)?.size ?? 0;
}

export function countCustomers(storeID: string): number {
  return customerByStore.get(storeID)?.size ?? 0;
}

export function isStoreFull(storeID: string): boolean {
  return countAdmins(storeID) + countCustomers(storeID) >= MAX_PER_STORE;
}

export function register(conn: SseConn): void {
  if (conn.kind === "admin") {
    add(adminByStore, conn.storeID, conn);
    return;
  }
  add(customerByStore, conn.storeID, conn);
  if (conn.ticketID) add(customerByTicket, conn.ticketID, conn);
}

export function unregister(conn: SseConn): void {
  if (conn.kind === "admin") {
    remove(adminByStore, conn.storeID, conn);
    return;
  }
  remove(customerByStore, conn.storeID, conn);
  if (conn.ticketID) remove(customerByTicket, conn.ticketID, conn);
}

export function admins(storeID: string): SseConn[] {
  return [...(adminByStore.get(storeID) ?? [])];
}

export function allAdmins(): SseConn[] {
  return [...adminByStore.values()].flatMap((set) => [...set]);
}

export function customersOfTicket(ticketID: string): SseConn[] {
  return [...(customerByTicket.get(ticketID) ?? [])];
}

export function customersOfStore(storeID: string): SseConn[] {
  return [...(customerByStore.get(storeID) ?? [])];
}

export function stats(): { admins: number; customers: number } {
  return {
    admins: [...adminByStore.values()].reduce((n, s) => n + s.size, 0),
    customers: [...customerByStore.values()].reduce((n, s) => n + s.size, 0),
  };
}
