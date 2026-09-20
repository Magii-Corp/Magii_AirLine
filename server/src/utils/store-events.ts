/**
 * 店舗単位の変更通知フラグ
 *
 * 管理画面が getEvent をポーリングし、立っていれば一覧を取り直す。
 * 確認したら resetEvent で寝かせる。
 *
 * NOTE: 行が無い店舗は「イベント無し」とみなす。フラグを立てる側は upsert する。
 */

import { supabaseAdmin } from "./supabase.js";

export type EventKind = "add" | "remove" | "update";

/** 立てるフラグだけを true にした差分。計算プロパティだと型が緩むので直書きする */
function patchFor(kind: EventKind): {
  has_add?: boolean;
  has_remove?: boolean;
  has_update?: boolean;
} {
  switch (kind) {
    case "add":
      return { has_add: true };
    case "remove":
      return { has_remove: true };
    case "update":
      return { has_update: true };
  }
}

/**
 * 指定の種類のフラグを立てる。
 *
 * 失敗しても呼び出し元の success には影響させない（通知が1回落ちるだけで、
 * データ自体は正しく更新されているため）。失敗はログにだけ残す。
 */
export async function markEvent(
  storeId: string,
  kind: EventKind
): Promise<void> {
  const db = supabaseAdmin;
  if (!db) return;

  const { error } = await db
    .from("store_events")
    .upsert(
      { store_id: storeId, ...patchFor(kind) },
      { onConflict: "store_id" }
    );

  if (error) {
    console.warn(
      `[store-events] ${kind} フラグの更新に失敗 (store=${storeId}): ${error.message}`
    );
  }
}
