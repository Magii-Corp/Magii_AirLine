/**
 * stores へのアクセス
 *
 * 書き込みと、書き込みのための読み取りは pg（Tx を受け取る関数）。
 * 参照専用エンドポイントは supabase-js（read* 関数）。
 */

import type { Tx } from "../db/tx.js";
import { supabaseRead } from "../db/supabase.js";
import type { StoreRow, TicketRow, AccountRow } from "../types/rows.js";

const COLUMNS = `
  id, email, password, name, open_time, close_time, avg_minutes_per_party,
  counter_date, last_number, status, next_switch_at, next_switch_status,
  status_changed_at, status_source, created_at
`;

// ---------------------------------------------------------------- 読み取り

export async function readStoreById(storeId: string): Promise<StoreRow | null> {
  const { data, error } = await supabaseRead
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();

  if (error) throw error;
  return (data as StoreRow | null) ?? null;
}

export type DashboardRow = StoreRow & {
  tickets: (TicketRow & { accounts: AccountRow })[];
};

/**
 * ダッシュボード用。店舗と本日の受付を **1リクエスト = 1SQL文** で取る。
 *
 * 仕様「一貫したDBスナップショットから返す」を満たすため、2回に分けて
 * 問い合わせてはいけない。PostgREST の埋め込みリソースなら1文で済む。
 *
 * business_date は呼び出し側がライブ計算した今日を渡す。store.counter_date で
 * 絞ってはいけない（仕様「counterDateが古くてもGETが過去日を今日として
 * 返してはいけない」）。
 *
 * 埋め込みに !inner を付けないので、受付0件でも店舗行は返る
 * （仕様「受付0件でもstoreを必ず返す」）。
 */
export async function readDashboard(
  storeId: string,
  businessDate: string
): Promise<DashboardRow | null> {
  const { data, error } = await supabaseRead
    .from("stores")
    .select("*, tickets(*, accounts(*))")
    .eq("id", storeId)
    .eq("tickets.business_date", businessDate)
    .order("waiting_number", { referencedTable: "tickets", ascending: true })
    .order("id", { referencedTable: "tickets", ascending: true })
    .maybeSingle();

  if (error) throw error;
  return (data as DashboardRow | null) ?? null;
}

// ---------------------------------------------------------------- 書き込み

/**
 * 店舗行をロックし、到来済みの自動切り替えを適用して返す。
 *
 * 返ってきたロックはトランザクションの残りで引き継がれる。設定保存・発券・
 * 自動開閉ジョブがこれを共有することで直列化される。
 *
 * 店舗が無い場合は全列 NULL の行が返るので id で判定する。
 */
export async function lockAndApplyAutoSwitch(
  tx: Tx,
  storeId: string
): Promise<StoreRow | null> {
  const res = await tx.query<StoreRow>(
    "select * from public.store_apply_auto_switch($1)",
    [storeId]
  );
  const row = res.rows[0];
  return row && row.id ? row : null;
}

export async function findByEmail(tx: Tx, email: string): Promise<StoreRow | null> {
  const res = await tx.query<StoreRow>(
    `select ${COLUMNS} from public.stores where email = $1`,
    [email]
  );
  return res.rows[0] ?? null;
}

export interface CreateStoreInput {
  email: string;
  passwordHash: string;
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  status: string;
  businessDate: string;
}

/**
 * 店舗を作成する。
 *
 * counter_date は今日、last_number は 0 をサーバーが決める
 * （仕様「counterDate/lastNumberは互換用入力。保存値はサーバーで今日/0に決定する」）。
 * next_switch_* は stores_init_next_switch トリガが登録時刻を起点に埋める。
 */
export async function createStore(tx: Tx, input: CreateStoreInput): Promise<StoreRow> {
  const res = await tx.query<StoreRow>(
    `insert into public.stores
       (email, password, name, open_time, close_time, avg_minutes_per_party,
        counter_date, last_number, status)
     values ($1, $2, $3, $4, $5, $6, $7, 0, $8)
     returning ${COLUMNS}`,
    [
      input.email,
      input.passwordHash,
      input.name,
      input.openTime,
      input.closeTime,
      input.avgMinutesPerParty,
      input.businessDate,
      input.status,
    ]
  );
  return res.rows[0]!;
}

export interface SettingsPatch {
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  /** 手動変更と判定された場合のみ渡す */
  status?: string;
  /** 次回切り替えを打ち直す場合のみ渡す */
  nextSwitchAt?: string;
  nextSwitchStatus?: string;
  statusSource?: string;
}

export async function updateSettings(
  tx: Tx,
  storeId: string,
  patch: SettingsPatch
): Promise<StoreRow> {
  const res = await tx.query<StoreRow>(
    `update public.stores set
       name                  = $2,
       open_time             = $3,
       close_time            = $4,
       avg_minutes_per_party = $5,
       status                = coalesce($6, status),
       status_changed_at     = case when $6 is not null and status is distinct from $6
                                    then now() else status_changed_at end,
       status_source         = coalesce($7, status_source),
       next_switch_at        = coalesce($8::timestamptz, next_switch_at),
       next_switch_status    = coalesce($9, next_switch_status)
     where id = $1
     returning ${COLUMNS}`,
    [
      storeId,
      patch.name,
      patch.openTime,
      patch.closeTime,
      patch.avgMinutesPerParty,
      patch.status ?? null,
      patch.statusSource ?? null,
      patch.nextSwitchAt ?? null,
      patch.nextSwitchStatus ?? null,
    ]
  );
  return res.rows[0]!;
}

/** 指定時刻より後に最初に来る境界 */
export async function nextBoundary(
  tx: Tx,
  openTime: string,
  closeTime: string
): Promise<{ switch_at: string; switch_status: string }> {
  const res = await tx.query<{ switch_at: string; switch_status: string }>(
    "select * from public.store_next_boundary($1, $2, now())",
    [openTime, closeTime]
  );
  return res.rows[0]!;
}

/**
 * 発券番号を採番し、カウンタを進める。店舗行のロックを前提とする。
 * 営業日が変わっていれば 1 から振り直す。
 */
export async function issueWaitingNumber(
  tx: Tx,
  store: StoreRow,
  businessDate: string
): Promise<number> {
  const next = store.counter_date === businessDate ? store.last_number + 1 : 1;
  await tx.query(
    "update public.stores set counter_date = $2, last_number = $3 where id = $1",
    [store.id, businessDate, next]
  );
  return next;
}
