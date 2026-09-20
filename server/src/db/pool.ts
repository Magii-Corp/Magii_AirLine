/**
 * Postgres 接続プール（書き込み経路用）
 *
 * 読み取り専用エンドポイントは supabase-js を使う（db/supabase.ts）。
 * 書き込み経路は必ずこちらを使うこと。仕様が要求する
 *   ・選択と更新を同一トランザクションで行う
 *   ・lastNumber+1 を原子的に採番する
 *   ・同じ店舗行のロックで直列化する
 * は PostgREST では実現できない。
 *
 * LISTEN は専用のクライアントを別に張る（db/listen.ts）。
 * プールの接続は使い回されて LISTEN の登録が失われるため、
 * ここから取った接続で LISTEN してはいけない。
 */

import pg from "pg";
import { env } from "../config/env.js";

// timestamptz を文字列のまま受け取る。Date に変換されるとタイムゾーンの
// 解釈がプロセスのTZに引きずられるため、ISO文字列で持ち回って
// シリアライザ側で一度だけ UTC ISO-8601 に整える。
pg.types.setTypeParser(1184, (v: string) => v); // timestamptz
pg.types.setTypeParser(1114, (v: string) => v); // timestamp
pg.types.setTypeParser(1082, (v: string) => v); // date
pg.types.setTypeParser(1083, (v: string) => v); // time

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  // アイドル接続が切れたときに来る。プールが自動で捨てるので落とさない。
  console.error("[pool] idle client error:", err.message);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const res = await pool.query<T>(text, values as never);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
