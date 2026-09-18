/**
 * GET /guest/getStore
 * QR読み取り直後に表示する店舗情報。失敗時（店舗が無い・DBエラー）はゼロ値で返す。
 */

import { todayBusinessDate } from "../../utils/business-date.js";
import { getStoreSchema } from "../../utils/validation.js";
import { toStore } from "../../utils/serialize.js";
import { prepare } from "../_shared.js";
import type { GetStoreResponse } from "../../types/api.js";

const WHERE = "getStore";

const EMPTY: GetStoreResponse = { store: null, waitingCount: 0, estimatedWaitMinutes: 0 };

export async function getStore(query: unknown): Promise<GetStoreResponse> {
  const p = prepare(WHERE, getStoreSchema, query);
  if (!p.ok) return EMPTY;

  const { storeID } = p.data;

  const { data: store, error: storeError } = await p.db
    .from("stores")
    .select("*")
    .eq("id", storeID)
    .maybeSingle();

  if (storeError) {
    console.warn(`[${WHERE}] DB error: ${storeError.message}`);
    return EMPTY;
  }
  if (!store) return EMPTY;

  const { count, error: countError } = await p.db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeID)
    .eq("business_date", todayBusinessDate())
    .eq("status", "waiting");

  if (countError) {
    console.warn(`[${WHERE}] DB error: ${countError.message}`);
    return { store: toStore(store), waitingCount: 0, estimatedWaitMinutes: 0 };
  }

  const waitingCount = count ?? 0;
  return {
    store: toStore(store),
    waitingCount,
    estimatedWaitMinutes: waitingCount * store.avg_minutes_per_party,
  };
}
