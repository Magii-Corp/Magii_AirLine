/**
 * GET /admin/getEvent
 *
 * 管理画面がポーリングして、一覧を取り直す必要があるかを判断するためのフラグ。
 * 確認したら resetEvent で寝かせる。
 *
 * NOTE: add は当面ずっと false になる。チケットが増えるのは発券＝ゲスト API の
 * 担当で、そちらは設計メモ待ちのため未実装。
 */

import { getEventSchema } from "../../utils/validation.js";
import { toEvent } from "../../utils/serialize.js";
import { prepare } from "../_shared.js";
import type { GetEventResponse } from "../../types/api.js";

const WHERE = "getEvent";

const NO_EVENT: GetEventResponse = { add: false, remove: false, update: false };

export async function getEvent(query: unknown): Promise<GetEventResponse> {
  const p = prepare(WHERE, getEventSchema, query);
  if (!p.ok) return NO_EVENT;

  const { storeID } = p.data;

  const { data, error } = await p.db
    .from("store_events")
    .select("*")
    .eq("store_id", storeID)
    .maybeSingle();

  if (error) {
    console.warn(`[${WHERE}] DB error: ${error.message}`);
    return NO_EVENT;
  }

  // 行が無い店舗は「イベント無し」
  return toEvent(data ?? null);
}
