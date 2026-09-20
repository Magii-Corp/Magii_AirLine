/**
 * 15分自動完了
 *
 * 仕様「全店舗・全営業日の status=called かつ called_at <= DB現在時刻-15分が対象」。
 *
 * 店舗でも営業日でも絞らないのが要点。前日の called も掃除対象になるが、
 * 管理側SSEが営業日で弾くので今日の一覧には出ない。
 *
 * tickets しか触らないので店舗ステートマシンと干渉しない。これにより
 * 「closedでも既存受付の呼び出し・到着操作と15分自動完了は継続する」が
 * 条件分岐を書かずに成立する。
 *
 * SKIP LOCKED とバッチ分割で、同じチケットを更新中の PATCH を待たせない。
 */

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import type { Job } from "./scheduler.js";

const BATCH = 500;

async function run(): Promise<void> {
  // 期限切れが大量にたまっている場合に備えて、返る件数がバッチ未満に
  // なるまで繰り返す。
  for (;;) {
    const client = await pool.connect();
    let processed = 0;
    try {
      await client.query("BEGIN");
      const res = await client.query<{ id: string }>(
        `with due as (
           select id from public.tickets
            where status = 'called'
              and called_at <= now() - make_interval(mins => $1)
            order by called_at
            limit $2
            for update skip locked
         )
         update public.tickets t
            set status = 'done'
           from due
          where t.id = due.id
         returning t.id`,
        [env.AUTO_COMPLETE_MINUTES, BATCH]
      );
      await client.query("COMMIT");
      processed = res.rowCount ?? 0;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }

    if (processed < BATCH) return;
  }
}

export const autoCompleteJob: Job = {
  name: "auto-complete",
  lockKey: 811002,
  run,
};
