/**
 * 営業日 (business_date) の算出
 *
 * tickets.business_date / stores.counter_date は date 型なので、
 * サーバーのタイムゾーンに依存せず一貫した "YYYY-MM-DD" を返す必要がある。
 * ここを唯一の算出箇所にしておき、店舗ごとのタイムゾーン対応が必要になったら
 * この関数だけを差し替えられるようにする。
 *
 * DB 側の関数（store_next_boundary 等）も既定で Asia/Tokyo を使う。
 * 両方を変える場合は BUSINESS_TIME_ZONE と DB 関数の既定値を揃えること。
 */

import { env } from "../config/env.js";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: env.BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 現在の営業日を "YYYY-MM-DD" で返す */
export function todayBusinessDate(now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD 形式を返す
  return formatter.format(now);
}
