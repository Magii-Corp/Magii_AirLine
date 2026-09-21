/**
 * LISTEN 専用の接続
 *
 * ⚠️ プールから取った接続で LISTEN してはいけない。プール接続は使い回され、
 * 別のリクエストに渡った時点で LISTEN の登録が失われる。専用の Client を張る。
 *
 * ⚠️ NOTIFY には永続性も再送も無い。接続が落ちている間に出た通知は
 * 完全に失われる。そのため接続が確立するたびに（初回を含む）
 * 管理クライアントへ sync.required を配って再同期させる。
 *
 * ⚠️ 接続文字列は必ずセッションモードであること。Supavisor の
 * transaction モード(6543)では LISTEN が成立せず、通知だけが永久に届かない。
 */

import pg from "pg";
import { env } from "../config/env.js";
import { broadcastResync, dispatch } from "../realtime/dispatcher.js";
import type { Notify } from "../realtime/dispatcher.js";

const CHANNEL = "magii_events";
const BACKOFF_MIN_MS = 200;
const BACKOFF_MAX_MS = 5000;

let client: pg.Client | null = null;
let backoff = BACKOFF_MIN_MS;
let stopped = false;
let connected = false;
let retryTimer: NodeJS.Timeout | null = null;

export function isListening(): boolean {
  return connected;
}

async function connect(): Promise<void> {
  if (stopped) return;

  const c = new pg.Client({ connectionString: env.DATABASE_URL });

  c.on("error", (err) => {
    console.error("[listen] 接続エラー:", err.message);
    connected = false;
    scheduleReconnect();
  });

  c.on("end", () => {
    connected = false;
    scheduleReconnect();
  });

  c.on("notification", (msg) => {
    if (msg.channel !== CHANNEL || !msg.payload) return;
    let parsed: Notify;
    try {
      parsed = JSON.parse(msg.payload) as Notify;
    } catch {
      console.error("[listen] ペイロードを解釈できません:", msg.payload);
      return;
    }
    void dispatch(parsed).catch((e) => {
      console.error("[listen] 配信に失敗しました:", e);
    });
  });

  await c.connect();
  await c.query(`LISTEN ${CHANNEL}`);

  client = c;
  connected = true;
  backoff = BACKOFF_MIN_MS;
  console.info(`[listen] ${CHANNEL} を購読しました`);

  // 落ちていた間の通知は失われているので再同期を促す
  broadcastResync();
}

function scheduleReconnect(): void {
  if (stopped || retryTimer) return;

  const delay = backoff;
  backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect().catch((e) => {
      console.error("[listen] 再接続に失敗しました:", e instanceof Error ? e.message : e);
      scheduleReconnect();
    });
  }, delay);
}

export async function startListening(): Promise<void> {
  stopped = false;
  try {
    await connect();
  } catch (e) {
    console.error("[listen] 初回接続に失敗しました:", e instanceof Error ? e.message : e);
    scheduleReconnect();
  }
}

export async function stopListening(): Promise<void> {
  stopped = true;
  connected = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (client) {
    const c = client;
    client = null;
    c.removeAllListeners();
    await c.end().catch(() => undefined);
  }
}
