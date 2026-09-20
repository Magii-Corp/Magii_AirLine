/**
 * プッシュ通知（APNs）
 *
 * 今回はトークンの保存までを実装範囲とし、実送信はスタブ。
 * 実装する際は sendCallNotification の中身を差し替えるだけで済むように、
 * 呼び出し側（realtime/dispatcher.ts）はこのインターフェースしか知らない。
 *
 * 実送信に必要なもの: 認証キー(.p8)、KeyID、TeamID、BundleID。
 */

import { pool } from "../db/pool.js";

export interface CallNotification {
  accountID: string;
  ticketID: string;
  storeID: string;
  waitingNumber: number;
}

export interface PushSender {
  send(notification: CallNotification, deviceTokens: string[]): Promise<void>;
}

/** ログに出すだけのスタブ */
class ConsoleLogPushSender implements PushSender {
  async send(n: CallNotification, deviceTokens: string[]): Promise<void> {
    if (deviceTokens.length === 0) return;

    // 実送信時に APNs へ投げるペイロード（仕様書の形）
    const payload = {
      aps: {
        alert: {
          title: "お呼び出し",
          body: `受付番号 ${n.waitingNumber} 番のお客様、席のご用意ができました`,
        },
        sound: "default",
        badge: 1,
      },
      ticketID: n.ticketID,
      storeID: n.storeID,
      waitingNumber: n.waitingNumber,
      type: "called",
    };

    console.info(
      `[push:stub] ${deviceTokens.length}件の端末へ送信予定`,
      JSON.stringify(payload)
    );
  }
}

const sender: PushSender = new ConsoleLogPushSender();

export async function sendCallNotification(n: CallNotification): Promise<void> {
  try {
    const res = await pool.query<{ device_token: string }>(
      "select device_token from public.devices where account_id = $1",
      [n.accountID]
    );
    await sender.send(
      n,
      res.rows.map((r) => r.device_token)
    );
  } catch (e) {
    // 通知の失敗で呼び出し操作を巻き戻さない
    console.error("[push] 送信に失敗しました:", e);
  }
}
