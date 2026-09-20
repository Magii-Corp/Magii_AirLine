/**
 * トランザクション
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ ロック取得順序の不変条件: 必ず stores → tickets の順      │
 * │                                                          │
 * │   発券          : stores(FOR UPDATE) → tickets(INSERT)   │
 * │   設定保存       : stores のみ                            │
 * │   自動開閉ジョブ : stores のみ                            │
 * │   営業日ジョブ   : stores のみ                            │
 * │   call-next     : tickets のみ                           │
 * │   状態変更/取消  : tickets のみ                           │
 * │   自動完了ジョブ : tickets のみ                           │
 * │                                                          │
 * │ この順序に循環が無いのでデッドロックしない。               │
 * │ チケットを先にロックしてから店舗をロックするハンドラを     │
 * │ 追加すると循環ができる。絶対にやらないこと。               │
 * └─────────────────────────────────────────────────────────┘
 */

import type pg from "pg";
import { pool } from "./pool.js";
import { translatePgError } from "./errors.js";

export type Tx = pg.PoolClient;

const RETRYABLE = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
]);

async function run<T>(
  isolation: string | null,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(isolation ? `BEGIN ${isolation}` : "BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ロールバック自体が失敗しても元のエラーを優先する
    }
    throw translatePgError(e);
  } finally {
    client.release();
  }
}

/**
 * 書き込みトランザクション。READ COMMITTED + 明示的な FOR UPDATE で直列化する。
 * SERIALIZABLE にすると再試行ループが必要になるため使わない。
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await run(null, fn);
  } catch (e) {
    const code = (e as { pgCode?: string }).pgCode;
    if (code && RETRYABLE.has(code)) {
      return await run(null, fn);
    }
    throw e;
  }
}

/**
 * 一貫したスナップショットが要る読み取り用。
 * 複数の文をまたいでも同じ MVCC スナップショットを見る。
 */
export async function withReadSnapshot<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return run("TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY", fn);
}
