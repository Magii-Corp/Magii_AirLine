/**
 * 営業日の切り替え
 *
 * 仕様「サーバー側で今日の営業日を判定し、日付変更時にcounterDateと
 * 番号カウンターを更新する」「営業日の変更はジョブ/更新処理で行い、
 * GET自体は書き込まない」。
 *
 * 発券処理も店舗ロックの中で同じ繰り上げをするので、動きのある店舗は
 * そちらで更新される。このジョブの主な役割は、
 *   ・1件も発券がない静かな店舗を繰り上げること
 *   ・トラフィックゼロでも business-date.changed が飛ぶのを保証すること
 * の2つ。
 *
 * counter_date = 今日 になれば対象から外れるので冪等。
 */

import { todayBusinessDate } from "../domain/business-date.js";
import { pool } from "../db/pool.js";
import type { Job } from "./scheduler.js";

const BATCH = 200;

async function run(): Promise<void> {
  const today = todayBusinessDate();

  await pool.query(
    `update public.stores
        set counter_date = $1, last_number = 0
      where id in (
        select id from public.stores
         where counter_date is distinct from $1
         limit $2
      )`,
    [today, BATCH]
  );
}

export const businessDateJob: Job = {
  name: "business-date",
  lockKey: 811003,
  run,
};
