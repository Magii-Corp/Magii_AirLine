/**
 * devices（APNsトークン）へのアクセス
 */

import type { Tx } from "../db/tx.js";
import type { DeviceRow } from "../types/rows.js";

/**
 * トークンで upsert する。
 *
 * APNsトークンは端末+アプリで一意なので、トークンを衝突キーにすると
 * 「同一アカウントで複数デバイス登録可能」と「トークン更新時は古いトークンを
 * 上書きする」が同時に満たせる。端末の持ち主が変わった場合も account_id が
 * 正しく付け替わる。
 */
export async function upsertDevice(
  tx: Tx,
  accountId: string,
  deviceToken: string,
  platform: string
): Promise<DeviceRow> {
  const res = await tx.query<DeviceRow>(
    `insert into public.devices (account_id, device_token, platform)
     values ($1, $2, $3)
     on conflict (device_token) do update
       set account_id = excluded.account_id,
           platform   = excluded.platform,
           updated_at = now()
     returning id, account_id, device_token, platform, created_at, updated_at`,
    [accountId, deviceToken, platform]
  );
  return res.rows[0]!;
}

/** ログアウト・アプリ削除時。存在しなくてもエラーにしない（冪等） */
export async function deleteByToken(tx: Tx, deviceToken: string): Promise<void> {
  await tx.query("delete from public.devices where device_token = $1", [deviceToken]);
}

export async function findByAccount(
  tx: Tx,
  accountId: string
): Promise<DeviceRow[]> {
  const res = await tx.query<DeviceRow>(
    `select id, account_id, device_token, platform, created_at, updated_at
       from public.devices where account_id = $1`,
    [accountId]
  );
  return res.rows;
}
