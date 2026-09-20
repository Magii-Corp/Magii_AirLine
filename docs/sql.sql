-- WARNING: This schema is for context only and is not meant to be run.
-- 実行可能な定義は supabase/migrations/ を参照すること。
-- インデックス・関数・トリガ・RLS はここには含めていない。

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_phone_number_key UNIQUE (phone_number)
);

-- status / next_switch_* は受付状態ステートマシン。
-- next_switch_at が「次の切り替え時刻」と「処理済み境界の水位」を兼ねる。
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  open_time time without time zone NOT NULL DEFAULT '10:00:00'::time without time zone,
  close_time time without time zone NOT NULL DEFAULT '21:00:00'::time without time zone,
  avg_minutes_per_party integer NOT NULL DEFAULT 10,
  counter_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Tokyo')::date,
  last_number integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'closed'::text CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
  next_switch_at timestamp with time zone NOT NULL,
  next_switch_status text NOT NULL CHECK (next_switch_status = ANY (ARRAY['open'::text, 'closed'::text])),
  status_changed_at timestamp with time zone NOT NULL DEFAULT now(),
  status_source text NOT NULL DEFAULT 'initial'::text CHECK (status_source = ANY (ARRAY['initial'::text, 'manual'::text, 'auto'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stores_pkey PRIMARY KEY (id),
  CONSTRAINT stores_email_key UNIQUE (email),
  CONSTRAINT stores_name_len_chk CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT stores_avg_chk CHECK (avg_minutes_per_party BETWEEN 1 AND 120),
  CONSTRAINT stores_last_number_chk CHECK (last_number >= 0),
  -- 切り替え先が曖昧になるため同値を禁止する
  CONSTRAINT stores_hours_distinct_chk CHECK (open_time <> close_time)
);

-- 決着した組も status = done / cancelled として残る。
-- updated_at は旧 arrived_at をリネームしたもので、値は必ず DB 側の
-- トリガが決める（クライアントからは受け取らない）。
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  account_id uuid NOT NULL,
  business_date date NOT NULL,
  waiting_number integer NOT NULL,
  name text NOT NULL,
  party_size integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting'::text CHECK (status = ANY (ARRAY['waiting'::text, 'called'::text, 'done'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  called_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT tickets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT,
  CONSTRAINT tickets_name_len_chk CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT tickets_party_size_chk CHECK (party_size BETWEEN 1 AND 99),
  CONSTRAINT tickets_waiting_num_chk CHECK (waiting_number >= 1),
  CONSTRAINT tickets_called_at_chk CHECK (status <> 'called' OR called_at IS NOT NULL),
  CONSTRAINT tickets_store_date_number_key UNIQUE (store_id, business_date, waiting_number)
);

-- 「同一アカウント・同一店舗・同一営業日で waiting/called は1件まで」。
-- done / cancelled は述語から外れるので同日の再受付が自動的に許可される。
-- CREATE UNIQUE INDEX tickets_one_active_per_account_uidx
--   ON public.tickets (store_id, account_id, business_date)
--   WHERE status IN ('waiting', 'called');

CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  device_token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios'::text CHECK (platform = ANY (ARRAY['ios'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_token_key UNIQUE (device_token),
  CONSTRAINT devices_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE
);

-- 旧設計の決着済みテーブル。新しいAPIからは一切参照しない。
-- final_status (seated / no_show) は新仕様の TicketStatus と対応しないため、
-- 実際に顧客管理機能を作るときは設計を見直すこと。
CREATE TABLE public.ticket_history (
  id uuid NOT NULL,
  store_id uuid NOT NULL,
  account_id uuid NOT NULL,
  business_date date NOT NULL,
  name text NOT NULL,
  party_size integer,
  final_status text NOT NULL CHECK (final_status = ANY (ARRAY['seated'::text, 'no_show'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL,
  finished_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ticket_history_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_history_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT ticket_history_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
