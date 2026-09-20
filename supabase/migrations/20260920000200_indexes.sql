-- インデックス
--
-- 実際に発行するクエリに対応させる。並び順のタイブレークに id を含めるのは、
-- 仕様が「waitingNumber昇順、同番号ならid順」と定めているため。

-- GET /admin/dashboard: 本日の全状態を waiting_number 昇順・同番号なら id 順
create index tickets_store_date_number_idx
  on public.tickets (store_id, business_date, waiting_number, id);

-- call-next の waiting 先頭取得 / groupsAhead の件数カウント
create index tickets_store_date_status_number_idx
  on public.tickets (store_id, business_date, status, waiting_number, id);

-- GET /customer/tickets/mine
create index tickets_account_store_date_idx
  on public.tickets (account_id, store_id, business_date);

-- 15分自動完了ジョブ。全店舗・全営業日を数秒おきに走査するので、
-- called だけの部分インデックスにして走査対象を絞る。
create index tickets_autocomplete_idx
  on public.tickets (called_at)
  where status = 'called';

-- 「同一アカウント・同一店舗・同一営業日で waiting/called は1件まで」の DB 側担保。
-- done / cancelled は述語から外れるので「done/cancelledになれば同日でも再受付可能」が
-- 自動的に成立する。
--
-- ハンドラ側の事前チェックだけではレースを防げないため、
-- この制約名の 23505 を捕捉して 409 ALREADY_WAITING に変換すること。
create unique index tickets_one_active_per_account_uidx
  on public.tickets (store_id, account_id, business_date)
  where status in ('waiting', 'called');

-- 自動開閉ジョブの走査対象抽出
create index stores_next_switch_at_idx on public.stores (next_switch_at);

-- 営業日切り替えジョブの走査対象抽出
create index stores_counter_date_idx on public.stores (counter_date);

create index devices_account_id_idx on public.devices (account_id);
