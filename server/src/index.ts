/**
 * エントリポイント
 *
 * 起動順: env 検証 → DB疎通 → LISTEN → ジョブ → HTTP待受
 * LISTEN を HTTP より先に張るのは、最初のリクエストが来る前に
 * 通知経路を用意しておくため。
 */

import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { closePool, pool } from "./db/pool.js";
import { startListening, stopListening } from "./db/listen.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";
import { autoSwitchJob } from "./jobs/auto-switch.job.js";
import { autoCompleteJob } from "./jobs/auto-complete.job.js";
import { businessDateJob } from "./jobs/business-date.job.js";

async function main(): Promise<void> {
  await pool.query("select 1");
  console.info("[boot] DB に接続しました");

  await startListening();

  startScheduler([autoSwitchJob, autoCompleteJob, businessDateJob]);
  console.info(`[boot] ジョブを開始しました (間隔 ${env.JOB_TICK_MS}ms)`);

  const server = serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
    console.info(`[boot] http://127.0.0.1:${info.port} で待受中`);
  });

  const shutdown = async (signal: string) => {
    console.info(`[shutdown] ${signal} を受信しました`);
    stopScheduler();
    server.close();
    await stopListening();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("[boot] 起動に失敗しました:", e);
  process.exit(1);
});
