/**
 * DB 行の型
 *
 * supabase gen types typescript は書き込み経路（pg）には効かないので手書きする。
 * スキーマとのずれは test/schema-drift.test.ts が検出する。
 *
 * 日時・日付・時刻は pg の型パーサを無効化しているため、すべて文字列で来る
 * （db/pool.ts を参照）。timestamptz は "2026-09-20 09:00:00+00" 形式。
 */

export interface AccountRow {
  id: string;
  phone_number: string;
  created_at: string;
}

export interface StoreRow {
  id: string;
  email: string;
  password: string;
  name: string;
  open_time: string;
  close_time: string;
  avg_minutes_per_party: number;
  counter_date: string;
  last_number: number;
  status: string;
  next_switch_at: string;
  next_switch_status: string;
  status_changed_at: string;
  status_source: string;
  created_at: string;
}

export interface TicketRow {
  id: string;
  store_id: string;
  account_id: string;
  business_date: string;
  waiting_number: number;
  name: string;
  party_size: number;
  status: string;
  created_at: string;
  called_at: string | null;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  account_id: string;
  device_token: string;
  platform: string;
  created_at: string;
  updated_at: string;
}
