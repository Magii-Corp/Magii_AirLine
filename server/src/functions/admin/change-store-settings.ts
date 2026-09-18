/**
 * 店舗設定の変更（4種）
 *
 * いずれも stores の 1 カラムを更新して update イベントを立てるだけなので、
 * updateStoreField に寄せている。
 *
 * POST /admin/changeAvgMinutesPerParty
 * POST /admin/changeOpenTime
 * POST /admin/changeCloseTime
 * POST /admin/changeStoreState
 */

import {
  changeAvgMinutesPerPartySchema,
  changeCloseTimeSchema,
  changeOpenTimeSchema,
  changeStoreStateSchema,
} from "../../utils/validation.js";
import { prepare, updateStoreField } from "./_shared.js";
import type { SuccessResponse } from "../../types/api.js";

export async function changeAvgMinutesPerParty(
  body: unknown
): Promise<SuccessResponse> {
  const where = "changeAvgMinutesPerParty";
  const p = prepare(where, changeAvgMinutesPerPartySchema, body);
  if (!p.ok) return p.response;

  return updateStoreField(where, p.data.storeID, {
    avg_minutes_per_party: p.data.newValue,
  });
}

export async function changeOpenTime(body: unknown): Promise<SuccessResponse> {
  const where = "changeOpenTime";
  const p = prepare(where, changeOpenTimeSchema, body);
  if (!p.ok) return p.response;

  return updateStoreField(where, p.data.storeID, {
    open_time: p.data.newValue,
  });
}

export async function changeCloseTime(body: unknown): Promise<SuccessResponse> {
  const where = "changeCloseTime";
  const p = prepare(where, changeCloseTimeSchema, body);
  if (!p.ok) return p.response;

  return updateStoreField(where, p.data.storeID, {
    close_time: p.data.newValue,
  });
}

export async function changeStoreState(
  body: unknown
): Promise<SuccessResponse> {
  const where = "changeStoreState";
  const p = prepare(where, changeStoreStateSchema, body);
  if (!p.ok) return p.response;

  return updateStoreField(where, p.data.storeID, {
    status: p.data.newState,
  });
}
