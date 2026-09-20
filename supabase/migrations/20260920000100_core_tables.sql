-- Magii AirLine コアテーブル
--
-- 管理API設計 / お客様API設計 の2つの仕様書に合わせた再定義。
--
-- 旧スキーマからの主な変更:
--   * staff_accounts を廃止し、email / password を stores 本体に持たせた
--     （仕様の Store.email に対応。1ログイン = 1店舗）
--   * tickets.arrived_at を updated_at にリネーム（旧列はコード上で未使用だった）
--   * tickets.status の許可値に done / cancelled を追加し、決着した組も
--     tickets に残す方式へ変更（ticket_history への移動をやめた）
--   * stores に受付状態ステートマシン用の列を追加
--   * store_events（ポーリング用フラグ）を廃止。通知は LISTEN/NOTIFY + SSE へ
--   * devices（APNsトークン）を新設

create extension if not exists pgcrypto;

-- ============================================================
-- accounts: お客様アカウント（電話番号のみ。パスワードは持たない）
-- ============================================================
create table public.accounts (
  id           uuid primary key default gen_random_uuid(),
  phone_number text not null,
  created_at   timestamptz not null default now(),

  -- POST /customer/auth/phone は find-or-create。UNIQUE がないと
  -- 初回同時ログインで同じ電話番号のアカウントが二重にできる。
  constraint accounts_phone_number_key unique (phone_number)
);

-- ============================================================
-- stores: 店舗
--
-- counter_date / last_number : 発券番号のカウンタ
-- status 以下の4列            : 受付状態ステートマシン（下記）
--
-- next_switch_at は「次の切り替え時刻」と「処理済み境界の水位」を兼ねる。
-- 手動変更は必ず自身のコミット時刻を起点に次の境界を計算し直すので、
-- 値は常に未来へ進む。自動切り替えジョブは now() >= next_switch_at の
-- ときだけ動き、行ロックを取った後にこの値を読み直して未来なら何もしない。
-- これにより、ジョブの遅延やサーバー再起動があっても、過去の切り替えが
-- 新しい手動指定を上書きすることがない。
--
-- next_switch_status を別に持つのは、日をまたぐ営業時間（22:00開店 /
-- 翌02:00閉店）では時刻だけからどちらの境界か判別できないため。
-- ============================================================
create table public.stores (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  password              text not null,   -- scrypt ハッシュ（domain/password.ts の形式）
  name                  text not null,

  open_time             time not null default '10:00',
  close_time            time not null default '21:00',
  avg_minutes_per_party integer not null default 10,

  counter_date          date not null default (now() at time zone 'Asia/Tokyo')::date,
  last_number           integer not null default 0,

  status                text not null default 'closed',
  -- next_switch_* は stores_init_next_switch トリガ（_400）が INSERT 時に埋める。
  -- BEFORE トリガは NOT NULL 検査より先に走るので、省略した INSERT でも通る。
  next_switch_at        timestamptz not null,
  next_switch_status    text not null,
  status_changed_at     timestamptz not null default now(),
  status_source         text not null default 'initial',

  created_at            timestamptz not null default now(),

  constraint stores_email_key unique (email),
  constraint stores_name_len_chk       check (char_length(name) between 1 and 100),
  constraint stores_avg_chk            check (avg_minutes_per_party between 1 and 120),
  constraint stores_last_number_chk    check (last_number >= 0),
  constraint stores_status_chk         check (status in ('open', 'closed')),
  constraint stores_next_status_chk    check (next_switch_status in ('open', 'closed')),
  constraint stores_status_source_chk  check (status_source in ('initial', 'manual', 'auto')),

  -- openTime == closeTime は切り替え先が曖昧になるため許可しない。
  -- 仕様が登録・設定保存とも400で拒否すると定めているのと対応する。
  constraint stores_hours_distinct_chk check (open_time <> close_time)
);

-- ============================================================
-- tickets: 受付。waiting / called / done / cancelled の全状態を保持する
--
-- updated_at は旧 arrived_at をリネームしたもの。値は必ず DB 側の
-- トリガ（_400）が決め、クライアントからは受け取らない。
-- ============================================================
create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id)   on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete restrict,
  business_date  date not null,
  waiting_number integer not null,
  name           text not null,
  party_size     integer not null,
  status         text not null default 'waiting',
  created_at     timestamptz not null default now(),
  called_at      timestamptz,
  updated_at     timestamptz not null default now(),

  constraint tickets_status_chk        check (status in ('waiting', 'called', 'done', 'cancelled')),
  constraint tickets_name_len_chk      check (char_length(name) between 1 and 100),
  constraint tickets_party_size_chk    check (party_size between 1 and 99),
  constraint tickets_waiting_num_chk   check (waiting_number >= 1),
  constraint tickets_called_at_chk     check (status <> 'called' or called_at is not null),
  constraint tickets_store_date_number_key unique (store_id, business_date, waiting_number)
);

-- ============================================================
-- devices: APNs トークン
--
-- UNIQUE は device_token 単独に張る。APNsトークンは端末+アプリで一意なので、
-- トークンで upsert すると端末の持ち主が変わったときに正しく付け替わる。
-- account_id は複数行あってよい（同一アカウントで複数デバイス可）。
-- ============================================================
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  device_token text not null,
  platform     text not null default 'ios',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint devices_token_key    unique (device_token),
  constraint devices_platform_chk check (platform in ('ios'))
);

-- ============================================================
-- ticket_history: 旧設計の決着済みテーブル
--
-- 新しいAPIからは一切参照しない。決着した組は tickets に
-- done / cancelled として残る。将来の顧客管理機能のために定義だけ残すが、
-- final_status (seated / no_show) は新仕様の TicketStatus と対応しないため、
-- 実際に使うときは設計を見直すこと。
-- ============================================================
create table public.ticket_history (
  id            uuid primary key,
  store_id      uuid not null references public.stores(id),
  account_id    uuid not null references public.accounts(id),
  business_date date not null,
  name          text not null,
  party_size    integer,
  final_status  text not null,
  created_at    timestamptz not null,
  finished_at   timestamptz not null default now(),

  constraint ticket_history_final_status_chk
    check (final_status in ('seated', 'no_show', 'cancelled'))
);
