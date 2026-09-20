/**
 * NOTIFY ペイロード → 仕様のイベント名へ振り分けて SSE へ配る
 *
 * 通知の入口はここ1本だけ。REST ハンドラもジョブも SSE を直接叩かない。
 * コミット → トリガが pg_notify → LISTEN が受信 → ここ、という経路に
 * 統一することで、仕様の「通知は全DB更新経路から生成する」と
 * 「コミット後に配信する」が構造的に満たされる。
 */

import { todayBusinessDate } from "../domain/business-date.js";
import { estimatedMinutes } from "../domain/queue.js";
import * as registry from "./registry.js";
import * as ticketsRepo from "../repositories/tickets.repo.js";
import * as storesRepo from "../repositories/stores.repo.js";
import { toAdminStore, toAdminTicket, toCustomerStore, toCustomerTicket } from "../serialize/index.js";
import { sendCallNotification } from "../push/apns.js";

export interface TicketNotify {
  kind: "ticket";
  op: "insert" | "update" | "delete";
  ticketID: string;
  storeID: string;
  accountID: string;
  businessDate: string;
  waitingNumber: number;
  status: string;
  prevStatus: string | null;
}

export interface StoreNotify {
  kind: "store";
  op: "update";
  storeID: string;
  statusChanged: boolean;
  businessDateChanged: boolean;
  businessDate: string;
}

export interface AccountNotify {
  kind: "account";
  op: "update";
  accountID: string;
}

export type Notify = TicketNotify | StoreNotify | AccountNotify;

const now = () => new Date().toISOString();

export async function dispatch(payload: Notify): Promise<void> {
  switch (payload.kind) {
    case "ticket":
      await onTicket(payload);
      return;
    case "store":
      await onStore(payload);
      return;
    case "account":
      await onAccount(payload);
      return;
  }
}

/**
 * 状態変化から、お客様側の固有イベント名を決める。
 *
 * 固有イベントと ticket.updated を二重に送らないこと。iOSの画面遷移が
 * 固有名で分岐しているので、両方送ると遷移が二重に走る。
 * ticket.updated は状態以外（氏名・人数）が変わったとき専用。
 */
function customerEventName(status: string, prevStatus: string | null): string {
  if (prevStatus !== null && prevStatus !== status) {
    if (status === "called") return "ticket.called";
    if (status === "done") return "ticket.done";
    if (status === "cancelled") return "ticket.cancelled";
  }
  return "ticket.updated";
}

async function onTicket(p: TicketNotify): Promise<void> {
  // 行が消えている場合は読み直せないので再同期を促す
  if (p.op === "delete") {
    for (const conn of registry.admins(p.storeID)) {
      conn.send("sync.required", {
        type: "sync.required",
        storeID: p.storeID,
        serverTime: now(),
      });
    }
    return;
  }

  const hydrated = await ticketsRepo.readTicketById(p.ticketID);
  if (!hydrated) return;

  const { accounts: account, stores: store } = hydrated;
  const today = todayBusinessDate();
  const serverTime = now();

  // --- 管理側 -------------------------------------------------------
  // 前日のcalledも15分自動完了の対象だが、本日の一覧には含めない。
  // ここで営業日を見て落とすのがその実装。
  if (p.businessDate === today) {
    const event = p.op === "insert" ? "ticket.created" : "ticket.updated";
    const ticket = toAdminTicket(hydrated, account, store);
    for (const conn of registry.admins(p.storeID)) {
      conn.send(event, { type: event, storeID: p.storeID, ticket, serverTime });
    }
  }

  // --- お客様側 -----------------------------------------------------
  const waitingOrder = await ticketsRepo.readWaitingOrder(p.storeID, p.businessDate);
  const avg = store.avg_minutes_per_party;

  const own = registry.customersOfTicket(p.ticketID);
  if (own.length > 0) {
    const event = customerEventName(p.status, p.prevStatus);
    const ticket = toCustomerTicket(hydrated, account, store);
    const ahead = waitingOrder.indexOf(p.ticketID);
    const groupsAhead = ahead < 0 ? 0 : ahead;

    for (const conn of own) {
      conn.send(event, {
        type: event,
        ticket,
        groupsAhead,
        estimatedMinutes: estimatedMinutes(groupsAhead, avg),
        serverTime,
      });
    }
  }

  // 前の組が進んだので、同じ店舗の他の待ち客に位置を配り直す
  for (const conn of registry.customersOfStore(p.storeID)) {
    if (!conn.ticketID || conn.ticketID === p.ticketID) continue;
    const ahead = waitingOrder.indexOf(conn.ticketID);
    const groupsAhead = ahead < 0 ? 0 : ahead;
    conn.send("queue.updated", {
      type: "queue.updated",
      ticketID: conn.ticketID,
      groupsAhead,
      estimatedMinutes: estimatedMinutes(groupsAhead, avg),
      serverTime,
    });
  }

  // 呼び出しのタイミングでプッシュ通知（現状はスタブ）
  if (p.op === "update" && p.prevStatus !== "called" && p.status === "called") {
    await sendCallNotification({
      accountID: p.accountID,
      ticketID: p.ticketID,
      storeID: p.storeID,
      waitingNumber: p.waitingNumber,
    });
  }
}

async function onStore(p: StoreNotify): Promise<void> {
  const store = await storesRepo.readStoreById(p.storeID);
  if (!store) return;

  const serverTime = now();

  for (const conn of registry.admins(p.storeID)) {
    if (p.businessDateChanged) {
      conn.send("business-date.changed", {
        type: "business-date.changed",
        storeID: p.storeID,
        businessDate: p.businessDate,
        serverTime,
      });
    }
    conn.send("store.updated", {
      type: "store.updated",
      storeID: p.storeID,
      store: toAdminStore(store),
      serverTime,
    });
  }

  const customerStore = toCustomerStore(store);
  for (const conn of registry.customersOfStore(p.storeID)) {
    conn.send("store.updated", {
      type: "store.updated",
      store: customerStore,
      serverTime,
    });
  }
}

/**
 * 電話番号が変わると管理画面の表示に影響するが、どの行がどう変わったかを
 * 差分で伝える手段が無いので、対象店舗には再同期を促す。
 */
async function onAccount(p: AccountNotify): Promise<void> {
  const serverTime = now();
  const today = todayBusinessDate();

  for (const conn of registry.allAdmins()) {
    const ticket = await ticketsRepo.readMyTicket(p.accountID, conn.storeID, today);
    if (!ticket) continue;
    conn.send("sync.required", {
      type: "sync.required",
      storeID: conn.storeID,
      serverTime,
    });
  }
}

/**
 * LISTEN 接続が張り直されたときに呼ぶ。
 *
 * NOTIFY には永続性も再送も無く、接続が落ちている間の通知は完全に失われる。
 * したがって再接続のたびに、接続中の管理クライアント全部へ
 * 「取りこぼしたかもしれないのでスナップショットを取り直せ」と伝える。
 */
export function broadcastResync(): void {
  const serverTime = now();
  for (const conn of registry.allAdmins()) {
    conn.send("sync.required", {
      type: "sync.required",
      storeID: conn.storeID,
      serverTime,
    });
  }
}
