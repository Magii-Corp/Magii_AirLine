/**
 * 管理API
 *
 * ⚠️ 認証は実装していない。仕様どおりだが、storeID は顧客向けQRコードの
 * 中身そのものなので、QRを読んだ客が call-next を直接叩いて待ち列を
 * 空にできる。公開前に必ず塞ぐこと（app.ts の adminAuth フック）。
 */

import { Hono } from "hono";
import { AppError } from "../../domain/errors.js";
import { todayBusinessDate } from "../../domain/business-date.js";
import { canTransition, shouldSetCalledAt } from "../../domain/transitions.js";
import type { TicketStatus } from "../../domain/transitions.js";
import { hashPassword, verifyPassword } from "../../domain/password.js";
import { withTransaction } from "../../db/tx.js";
import * as storesRepo from "../../repositories/stores.repo.js";
import * as ticketsRepo from "../../repositories/tickets.repo.js";
import {
  adminLoginSchema,
  callNextSchema,
  changeTicketStatusSchema,
  createStoreSchema,
  storeIdQuerySchema,
  storeSettingsSchema,
} from "../../schemas/index.js";
import { toAdminStore, toAdminTicket } from "../../serialize/index.js";
import { openSseStream } from "../../http/sse.js";
import { isStoreFull } from "../../realtime/registry.js";

export const adminRoutes = new Hono();

const serverTime = () => new Date().toISOString();

// ---------------------------------------------------------------- ログイン

adminRoutes.post("/auth/login", async (c) => {
  const body = adminLoginSchema.parse(await c.req.json());

  const storeID = await withTransaction(async (tx) => {
    const store = await storesRepo.findByEmail(tx, body.email);
    // 存在しない場合も同じエラーにする。メールアドレスの存在を漏らさない。
    if (!store) return null;
    const ok = await verifyPassword(body.password, store.password);
    return ok ? store.id : null;
  });

  if (!storeID) throw new AppError("INVALID_CREDENTIALS");

  return c.json({ success: true as const, storeID });
});

// ---------------------------------------------------------------- 店舗登録

adminRoutes.post("/stores", async (c) => {
  const body = createStoreSchema.parse(await c.req.json());
  const businessDate = todayBusinessDate();
  const passwordHash = await hashPassword(body.password);

  const store = await withTransaction((tx) =>
    storesRepo.createStore(tx, {
      email: body.email,
      passwordHash,
      name: body.name,
      openTime: body.openTime,
      closeTime: body.closeTime,
      avgMinutesPerParty: body.avgMinutesPerParty,
      status: body.status,
      businessDate,
    })
  );

  return c.json({ success: true as const, store: toAdminStore(store) }, 201);
});

// ------------------------------------------------------------ ダッシュボード

adminRoutes.get("/dashboard", async (c) => {
  const { storeID } = storeIdQuerySchema.parse(c.req.query());
  const businessDate = todayBusinessDate();

  const row = await storesRepo.readDashboard(storeID, businessDate);
  if (!row) throw new AppError("STORE_NOT_FOUND");

  const { tickets, ...store } = row;

  // 古いレプリカや中間キャッシュに更新前の結果を返させない
  c.header("Cache-Control", "no-store");

  return c.json({
    store: toAdminStore(store),
    tickets: tickets.map((t) => toAdminTicket(t, t.accounts, store)),
    businessDate,
    serverTime: serverTime(),
  });
});

// ---------------------------------------------------------------- 次を呼ぶ

adminRoutes.post("/tickets/call-next", async (c) => {
  const body = callNextSchema.parse(await c.req.json());
  const businessDate = todayBusinessDate();

  const result = await withTransaction(async (tx) => {
    const store = await storesRepo.lockAndApplyAutoSwitch(tx, body.storeID);
    if (!store) throw new AppError("STORE_NOT_FOUND");

    // closed でも既存受付の呼び出しは継続できる（仕様）
    const called = await ticketsRepo.callNext(tx, body.storeID, businessDate);
    if (!called) throw new AppError("NO_WAITING_TICKET");

    return ticketsRepo.hydrateInTx(tx, called.id);
  });

  if (!result) throw new AppError("TICKET_NOT_FOUND");

  return c.json({
    success: true as const,
    ticket: toAdminTicket(result.ticket, result.account, result.store),
    serverTime: serverTime(),
  });
});

// ------------------------------------------------------------ 受付状態変更

adminRoutes.patch("/tickets/:ticketID/status", async (c) => {
  const ticketID = c.req.param("ticketID");
  const body = changeTicketStatusSchema.parse(await c.req.json());

  const result = await withTransaction(async (tx) => {
    const current = await ticketsRepo.getTicketInTx(tx, ticketID);
    // storeID と ticketID の両方で対象行を特定する。
    // 店舗違いは存在自体を伏せて TICKET_NOT_FOUND にする。
    if (!current || current.store_id !== body.storeID) {
      throw new AppError("TICKET_NOT_FOUND");
    }

    const from = current.status as TicketStatus;
    const to = body.newState;

    // 同じ状態の再指定は UPDATE を発行しない。
    // 空振りの UPDATE を投げると updated_at も通知も動いてしまう。
    if (from === to) return ticketsRepo.hydrateInTx(tx, ticketID);

    if (!canTransition(from, to)) throw new AppError("INVALID_TRANSITION");

    await ticketsRepo.updateStatus(tx, ticketID, to, shouldSetCalledAt(to));
    return ticketsRepo.hydrateInTx(tx, ticketID);
  });

  if (!result) throw new AppError("TICKET_NOT_FOUND");

  return c.json({
    success: true as const,
    ticket: toAdminTicket(result.ticket, result.account, result.store),
    serverTime: serverTime(),
  });
});

// ---------------------------------------------------------------- 設定保存

adminRoutes.patch("/store/settings", async (c) => {
  const body = storeSettingsSchema.parse(await c.req.json());

  const store = await withTransaction(async (tx) => {
    // ① 先に到来済みの自動切り替えを反映する。
    //
    //    この順番が本質的に重要。仕様の「手動変更時は、その時刻までに到来した
    //    未処理の自動切り替えを先に反映してから指定値を保存する」がこれ。
    //
    //    例: DBが古い closed のまま10:00の開店境界が1秒前に到来し、
    //    ジョブ未実行の状態で 10:00:01 に status:"closed" で保存した場合。
    //    追いつき処理が無いと「変更なし」と判定され next_switch_at が過去の
    //    ままになり、直後のジョブが店舗を open に反転させてしまう。
    const current = await storesRepo.lockAndApplyAutoSwitch(tx, body.storeID);
    if (!current) throw new AppError("STORE_NOT_FOUND");

    // ② 「保存直前のDBのstatus」は①の後の値
    const statusBefore = current.status;

    // ③ 設定APIは全項目を送るため、statusを含むだけでは手動変更と扱わない。
    //    送られた値が直前の値と異なる場合だけ手動変更とする。
    const isManualChange = body.status !== statusBefore;

    const hoursChanged =
      body.openTime !== current.open_time.slice(0, 5) ||
      body.closeTime !== current.close_time.slice(0, 5);

    const patch: storesRepo.SettingsPatch = {
      name: body.name,
      openTime: body.openTime,
      closeTime: body.closeTime,
      avgMinutesPerParty: body.avgMinutesPerParty,
    };

    if (isManualChange) {
      // 指定statusを、新しい時刻で計算し直した次回切り替えまで維持する
      const boundary = await storesRepo.nextBoundary(tx, body.openTime, body.closeTime);
      patch.status = body.status;
      patch.statusSource = "manual";
      patch.nextSwitchAt = boundary.switch_at;
      patch.nextSwitchStatus = boundary.switch_status;
    } else if (hoursChanged) {
      // 時刻だけの変更では現在のstatusを即座に変更しない。
      // カーソルだけを保存時刻より後の新しい時刻で打ち直す。
      const boundary = await storesRepo.nextBoundary(tx, body.openTime, body.closeTime);
      patch.nextSwitchAt = boundary.switch_at;
      patch.nextSwitchStatus = boundary.switch_status;
    }
    // どちらも変わっていなければ next_switch_at に触れない。
    // 同値の再保存で手動指定の期限を延長しないため。

    return storesRepo.updateSettings(tx, body.storeID, patch);
  });

  return c.json({
    success: true as const,
    store: toAdminStore(store),
    serverTime: serverTime(),
  });
});

// ------------------------------------------------------------ リアルタイム

adminRoutes.get("/tickets/events", async (c) => {
  const { storeID } = storeIdQuerySchema.parse(c.req.query());

  // ストリームに切り替える前に検証する。切り替えた後では
  // ステータスコードでエラーを返せない。
  const store = await storesRepo.readStoreById(storeID);
  if (!store) throw new AppError("STORE_NOT_FOUND");
  if (isStoreFull(storeID)) throw new AppError("SERVER_ERROR", "接続数の上限に達しました");

  return openSseStream(c, {
    kind: "admin",
    storeID,
    onOpen: (conn) => {
      // 接続時・再接続時は必ず整合したスナップショットを取り直させる。
      // 取りこぼしの有無を判定する手段が無いので、常に促すのが正しい。
      conn.send("sync.required", {
        type: "sync.required",
        storeID,
        serverTime: serverTime(),
      });
    },
  });
});
