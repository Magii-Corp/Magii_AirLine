/**
 * ジョブのスケジューラ
 *
 * setInterval ではなく自己再スケジュール型の setTimeout を使う。
 * setInterval はティックが遅れたときに実行が重なる。
 *
 * 各ジョブは pg_try_advisory_lock で保護する。サーバーを複数台に
 * 増やしても二重実行されない。ロックが取れないのは別インスタンスが
 * 実行中という意味なので、エラーではなく正常なスキップとして扱う。
 *
 * ジョブはSSEを直接発火しない。コミットすればトリガが pg_notify を出し、
 * LISTEN 経由で配信される。
 */

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

export interface Job {
  name: string;
  /** pg_try_advisory_lock に渡す定数。ジョブごとに一意にすること。 */
  lockKey: number;
  run: () => Promise<void>;
}

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopped = false;

async function withAdvisoryLock(lockKey: number, fn: () => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    const res = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [lockKey]
    );
    if (!res.rows[0]?.locked) return;

    try {
      await fn();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [lockKey]);
    }
  } finally {
    client.release();
  }
}

async function tick(jobs: Job[]): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const job of jobs) {
      try {
        await withAdvisoryLock(job.lockKey, job.run);
      } catch (e) {
        console.error(`[job:${job.name}] 失敗:`, e instanceof Error ? e.message : e);
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler(jobs: Job[]): void {
  stopped = false;

  const loop = async () => {
    if (stopped) return;
    await tick(jobs);
    if (stopped) return;
    timer = setTimeout(() => void loop(), env.JOB_TICK_MS);
  };

  void loop();
}

export function stopScheduler(): void {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
