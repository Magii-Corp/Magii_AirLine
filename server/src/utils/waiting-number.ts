/**
 * 発券番号の採番
 *
 * stores.counter_date / last_number を compare-and-swap で更新して採番する。
 *
 * 現時点でこれを呼ぶのはゲスト向けの発券 API だけで、その API は設計メモ待ちのため
 * 実装が無い。25 並列で重複・欠番ゼロを実測済みのロジックなので、
 * 発券 API が復活したときにそのまま使えるようここへ退避してある。
 */

import { supabaseAdmin } from "./supabase.js";

/**
 * CAS が競合したときの再試行回数。
 * 同時発券数が多いほど衝突するので、実測（12 並列で 5 回では不足）を踏まえ多めに取る。
 */
const ISSUE_MAX_ATTEMPTS = 25;

/** 再試行が同時に殺到しないよう、少しだけランダムに待つ */
function backoff(attempt: number): Promise<void> {
  const ms = Math.random() * Math.min(4 * (attempt + 1), 40);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type IssueResult = { number: number } | { error: string };

/**
 * 「読んだ値と同じであること」を WHERE 条件に含めた UPDATE (compare-and-swap) を行い、
 * 0 行更新なら他リクエストに先を越されたとみなして再試行する。
 * これにより MAX(waiting_number)+1 方式にあった採番の競合が起きない。
 */
export async function issueWaitingNumber(
  storeId: string,
  businessDate: string
): Promise<IssueResult> {
  const db = supabaseAdmin;
  if (!db) return { error: "Database not configured" };

  for (let attempt = 0; attempt < ISSUE_MAX_ATTEMPTS; attempt++) {
    const { data: counter, error: readError } = await db
      .from("stores")
      .select("counter_date, last_number")
      .eq("id", storeId)
      .single();

    if (readError || !counter) {
      return { error: readError?.message ?? "Store not found" };
    }

    const isSameDay = counter.counter_date === businessDate;
    const next = isSameDay ? counter.last_number + 1 : 1;

    let guard = db
      .from("stores")
      .update({ counter_date: businessDate, last_number: next })
      .eq("id", storeId);

    // 読み取った値そのものを条件にすることで CAS が成立する
    guard = isSameDay
      ? guard
          .eq("counter_date", businessDate)
          .eq("last_number", counter.last_number)
      : counter.counter_date === null
        ? guard.is("counter_date", null)
        : guard.eq("counter_date", counter.counter_date);

    const { data: updated, error: updateError } = await guard.select("id");

    if (updateError) {
      return { error: updateError.message };
    }

    if (updated && updated.length === 1) {
      return { number: next };
    }

    // 0 行 = 競合。少し待ってから読み直して再試行する
    await backoff(attempt);
  }

  return { error: "Failed to issue a waiting number due to contention" };
}
