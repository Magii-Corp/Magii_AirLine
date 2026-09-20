/**
 * お客様API
 */

import { Hono } from "hono";
import { AppError } from "../../domain/errors.js";
import { todayBusinessDate } from "../../domain/business-date.js";
import { canCancel } from "../../domain/transitions.js";
import type { TicketStatus } from "../../domain/transitions.js";
import { estimatedMinutes, groupsAheadFor } from "../../domain/queue.js";
import { isValidPhone, normalizePhone } from "../../domain/phone.js";
import { withTransaction } from "../../db/tx.js";
import { isUniqueViolation } from "../../db/errors.js";
import * as storesRepo from "../../repositories/stores.repo.js";
import * as ticketsRepo from "../../repositories/tickets.repo.js";
import * as accountsRepo from "../../repositories/accounts.repo.js";
import * as devicesRepo from "../../repositories/devices.repo.js";
import {
  cancelTicketSchema,
  createTicketSchema,
  myTicketQuerySchema,
  phoneAuthSchema,
  registerDeviceSchema,
  uuid,
} from "../../schemas/index.js";
import { toAccount, toCustomerStore, toCustomerTicket } from "../../serialize/index.js";
import { openSseStream } from "../../http/sse.js";
import { isStoreFull } from "../../realtime/registry.js";

export const customerRoutes = new Hono();

const serverTime = () => new Date().toISOString();

// ---------------------------------------------------------------- 店舗情報

customerRoutes.get("/stores/:storeID", async (c) => {
  const storeID = uuid.parse(c.req.param("storeID"));

  const store = await storesRepo.readStoreById(storeID);
  if (!store) throw new AppError("STORE_NOT_FOUND");

  return c.json({
    success: true as const,
    store: toCustomerStore(store),
    businessDate: todayBusinessDate(),
    serverTime: serverTime(),
  });
});

// ------------------------------------------------------------ 電話番号認証

customerRoutes.post("/auth/phone", async (c) => {
  const body = phoneAuthSchema.parse(await c.req.json());

  const normalized = normalizePhone(body.phone_number);
  if (!isValidPhone(normalized)) throw new AppError("INVALID_PHONE");

  const { account, isNew } = await withTransaction((tx) =>
    accountsRepo.upsertByPhone(tx, normalized)
  );

  return c.json({
    success: true as const,
    account: toAccount(account),
    isNewAccount: isNew,
  });
});

// ---------------------------------------------------------------- 受付作成

customerRoutes.post("/tickets", async (c) => {
  const body = createTicketSchema.parse(await c.req.json());

  // 電話番号は形式だけ検証し、アカウントは書き換えない。
  // accountID と食い違っていた場合の扱いが仕様で未定義なため、
  // 破壊的なほう（アカウントの電話番号を上書きする）は採らない。
  const normalized = normalizePhone(body.phone_number);
  if (!isValidPhone(normalized)) throw new AppError("INVALID_PHONE");

  const businessDate = todayBusinessDate();

  const result = await withTransaction(async (tx) => {
    // ① 店舗行をロックしつつ受付状態を確定させる。
    //    ジョブの実行間隔ぶん「閉店すべきなのにまだopen」の窓があるが、
    //    ここで追いつかせることでその窓を塞ぐ。
    //    これはPOSTなので「GETで状態を変更しない」には抵触しない。
    const store = await storesRepo.lockAndApplyAutoSwitch(tx, body.storeID);
    if (!store) throw new AppError("STORE_NOT_FOUND");

    // ② 受付可否はサーバーで確定した status で判定する
    if (store.status !== "open") throw new AppError("STORE_CLOSED");

    const account = await accountsRepo.getAccountInTx(tx, body.accountID);
    if (!account) throw new AppError("INVALID_INPUT");

    // ③ 事前チェック。レースは④のユニーク制約が止める。
    const active = await ticketsRepo.findActiveTicket(
      tx,
      body.storeID,
      body.accountID,
      businessDate
    );
    if (active) throw new AppError("ALREADY_WAITING");

    // ④ 採番。店舗行をロック済みなので歯抜けも重複も起きない。
    const waitingNumber = await storesRepo.issueWaitingNumber(tx, store, businessDate);

    let ticket;
    try {
      ticket = await ticketsRepo.createTicket(tx, {
        storeId: body.storeID,
        accountId: body.accountID,
        businessDate,
        waitingNumber,
        name: body.name,
        partySize: body.partySize,
      });
    } catch (e) {
      // 事前チェックをすり抜けた同時リクエスト
      if (isUniqueViolation(e, "tickets_one_active_per_account_uidx")) {
        throw new AppError("ALREADY_WAITING");
      }
      throw e;
    }

    const groupsAhead = await ticketsRepo.countWaitingAheadInTx(tx, ticket);
    const hydrated = await ticketsRepo.hydrateInTx(tx, ticket.id);
    return { hydrated, groupsAhead, avg: store.avg_minutes_per_party };
  });

  if (!result.hydrated) throw new AppError("SERVER_ERROR");

  const { ticket, account, store } = result.hydrated;
  return c.json(
    {
      success: true as const,
      ticket: toCustomerTicket(ticket, account, store),
      groupsAhead: result.groupsAhead,
      estimatedMinutes: estimatedMinutes(result.groupsAhead, result.avg),
      serverTime: serverTime(),
    },
    201
  );
});

// ------------------------------------------------------------ 自分の受付

customerRoutes.get("/tickets/mine", async (c) => {
  const q = myTicketQuerySchema.parse(c.req.query());
  const businessDate = todayBusinessDate();

  const row = await ticketsRepo.readMyTicket(q.accountID, q.storeID, businessDate);

  if (!row) {
    return c.json({
      success: true as const,
      ticket: null,
      groupsAhead: 0,
      estimatedMinutes: 0,
      serverTime: serverTime(),
    });
  }

  const ahead = await ticketsRepo.countWaitingAhead(
    row.store_id,
    row.business_date,
    row.waiting_number,
    row.id
  );
  const groupsAhead = groupsAheadFor(row.status as TicketStatus, ahead);

  return c.json({
    success: true as const,
    ticket: toCustomerTicket(row, row.accounts, row.stores),
    groupsAhead,
    estimatedMinutes: estimatedMinutes(groupsAhead, row.stores.avg_minutes_per_party),
    serverTime: serverTime(),
  });
});

// ------------------------------------------------------------ リアルタイム
//
// ⚠️ この定義は /tickets/:ticketID より前に置くこと。
// Hono は登録順に照合するため、後ろに置くと "events" が ticketID として
// 解釈されてしまう。

customerRoutes.get("/tickets/events", async (c) => {
  const ticketID = uuid.parse(c.req.query("ticketID") ?? "");

  const row = await ticketsRepo.readTicketById(ticketID);
  if (!row) throw new AppError("TICKET_NOT_FOUND");
  if (isStoreFull(row.store_id)) {
    throw new AppError("SERVER_ERROR", "接続数の上限に達しました");
  }

  const ahead = await ticketsRepo.countWaitingAhead(
    row.store_id,
    row.business_date,
    row.waiting_number,
    row.id
  );
  const groupsAhead = groupsAheadFor(row.status as TicketStatus, ahead);

  return openSseStream(c, {
    kind: "customer",
    storeID: row.store_id,
    ticketID: row.id,
    accountID: row.account_id,
    businessDate: row.business_date,
    onOpen: (conn) => {
      // 現在値を最初に流しておくと、アプリ再起動時の状態復元に
      // 別途 GET を投げる必要がなくなる。
      conn.send("ticket.updated", {
        type: "ticket.updated",
        ticket: toCustomerTicket(row, row.accounts, row.stores),
        groupsAhead,
        estimatedMinutes: estimatedMinutes(
          groupsAhead,
          row.stores.avg_minutes_per_party
        ),
        serverTime: serverTime(),
      });
    },
  });
});

// ---------------------------------------------------------------- 受付詳細

customerRoutes.get("/tickets/:ticketID", async (c) => {
  const ticketID = uuid.parse(c.req.param("ticketID"));

  const row = await ticketsRepo.readTicketById(ticketID);
  if (!row) throw new AppError("TICKET_NOT_FOUND");

  const ahead = await ticketsRepo.countWaitingAhead(
    row.store_id,
    row.business_date,
    row.waiting_number,
    row.id
  );
  const groupsAhead = groupsAheadFor(row.status as TicketStatus, ahead);

  return c.json({
    success: true as const,
    ticket: toCustomerTicket(row, row.accounts, row.stores),
    groupsAhead,
    estimatedMinutes: estimatedMinutes(groupsAhead, row.stores.avg_minutes_per_party),
    serverTime: serverTime(),
  });
});

// ------------------------------------------------------------ キャンセル

customerRoutes.post("/tickets/:ticketID/cancel", async (c) => {
  const ticketID = uuid.parse(c.req.param("ticketID"));
  const body = cancelTicketSchema.parse(await c.req.json());

  const result = await withTransaction(async (tx) => {
    // accountID 不一致は存在を伏せて TICKET_NOT_FOUND にする
    const current = await ticketsRepo.getOwnedTicket(tx, ticketID, body.accountID);
    if (!current) throw new AppError("TICKET_NOT_FOUND");

    if (!canCancel(current.status as TicketStatus)) {
      throw new AppError("CANNOT_CANCEL");
    }

    await ticketsRepo.updateStatus(tx, ticketID, "cancelled", false);
    return ticketsRepo.hydrateInTx(tx, ticketID);
  });

  if (!result) throw new AppError("TICKET_NOT_FOUND");

  return c.json({
    success: true as const,
    ticket: toCustomerTicket(result.ticket, result.account, result.store),
    serverTime: serverTime(),
  });
});

// ------------------------------------------------------ プッシュ通知トークン

customerRoutes.post("/devices", async (c) => {
  const body = registerDeviceSchema.parse(await c.req.json());

  await withTransaction(async (tx) => {
    const account = await accountsRepo.getAccountInTx(tx, body.accountID);
    if (!account) throw new AppError("INVALID_INPUT");
    await devicesRepo.upsertDevice(tx, body.accountID, body.deviceToken, body.platform);
  });

  return c.json({ success: true as const });
});

customerRoutes.delete("/devices/:deviceToken", async (c) => {
  const deviceToken = c.req.param("deviceToken");

  await withTransaction((tx) => devicesRepo.deleteByToken(tx, deviceToken));

  return c.json({ success: true as const });
});
