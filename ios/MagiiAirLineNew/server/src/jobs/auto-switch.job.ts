/**
 * 店舗の受付状態の自動切り替え
 *
 * 仕様「自動切り替えはサーバーのジョブで実行し、ブラウザを閉じていても
 * 動作させる」。
 *
 * 直列化は store_apply_auto_switch が取る行ロックに任せる。
 * 設定保存や発券がその店舗行を保持していれば、この関数はロック待ちに入り、
 * 相手がコミットしてから next_switch_at を読み直す。そのとき値は未来へ
 * 進んでいるので何もせずに返る。つまり待たされた結果として、古い境界が
 * 新しい手動指定を上書きすることがない。
 *
 * 候補の抽出はロック無しの単純な SELECT にしている。ここで
 * FOR UPDATE SKIP LOCKED を使うには抽出と適用を同じトランザクションに
 * 入れる必要があり、そうするとバッチ全体のあいだ全店舗の行を
 * 掴み続けることになってしまう。
 */

import { pool } from "../db/pool.js";
import type { Job } from "./scheduler.js";

const BATCH = 100;

async function run(): Promise<void> {
  const due = await pool.query<{ id: string }>(
    `select id from public.stores
      where next_switch_at <= now()
      order by next_switch_at
      limit $1`,
    [BATCH]
  );

  for (const row of due.rows) {
    // 店舗ごとに短いトランザクションで閉じる。
    // 長く持つと API 側のロック待ちが伸びる。
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("select public.store_apply_auto_switch($1)", [row.id]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(`[job:auto-switch] 店舗 ${row.id} の切り替えに失敗:`, e);
    } finally {
      client.release();
    }
  }
}

export const autoSwitchJob: Job = {
  name: "auto-switch",
  lockKey: 811001,
  run,
};
