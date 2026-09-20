-- トリガ: updated_at の維持と、SSE のもとになる pg_notify
--
-- 通知をすべて DB トリガから出すのは、仕様の
--   「通知は全DB更新経路から生成する。管理APIだけを通知源にしない」
--   「コミット後に配信する」
-- を構造的に満たすため。pg_notify はコミット時にしか配送されないので、
-- 「コミット後」を実装側で間違えようがない。psql から手で UPDATE しても、
-- バックグラウンドジョブが更新しても、同じ経路で通知が出る。

-- ============================================================
-- tickets.updated_at
--
-- 仕様の updated_at 節をこのトリガ1つで満たす:
--   * INSERT時、受付の実データ変更時に DB 時刻で設定する
--   * クライアントから受け取らない
--   * 同値更新では変更しない
--   * status/called_at 等の変更と同一トランザクションで更新する
--
-- now() はトランザクション開始時刻なので、called_at = now() と
-- updated_at が同じ文で書かれれば完全に同値になる。
-- clock_timestamp() を使うとここがずれるので使わないこと。
--
-- トリガを tickets にしか置かないので「店舗変更だけでは
-- tickets.updated_at を変更しない」も自動的に満たされる。
-- ============================================================
create or replace function public.tickets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := now();
    return new;
  end if;

  -- クライアントが updated_at を送ってきても必ず握り潰す
  new.updated_at := old.updated_at;

  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    new.updated_at := now();
  end if;

  return new;
end
$$;

create trigger tickets_touch_updated_at
  before insert or update on public.tickets
  for each row execute function public.tickets_touch_updated_at();

-- ============================================================
-- stores.next_switch_* の初期化
--
-- 仕様「登録時のstatusを初期状態とし、登録時刻より後の最初の
-- openTime/closeTimeで自動切り替えを開始する」。
--
-- BEFORE トリガなので NOT NULL 検査より先に走る。したがって
-- アプリからの INSERT でも psql からの手動 INSERT でも列を省略できる。
-- ============================================================
create or replace function public.stores_init_next_switch()
returns trigger
language plpgsql
as $$
declare
  nb record;
begin
  if new.next_switch_at is null then
    select * into nb
      from public.store_next_boundary(new.open_time, new.close_time, now());
    new.next_switch_at     := nb.switch_at;
    new.next_switch_status := nb.switch_status;
  end if;
  return new;
end
$$;

create trigger stores_init_next_switch
  before insert on public.stores
  for each row execute function public.stores_init_next_switch();

-- ============================================================
-- 通知: tickets
--
-- ペイロードは識別子と変更種別だけの薄い形にする。理由は3つ:
--   * pg_notify のペイロードは 8000 バイトまで。Ticket は Store を
--     丸ごと内包するので DTO をそのまま載せると危険
--   * どのみちサーバー側で読み直して DTO 化する
--   * 読み直せば REST と SSE が同じシリアライザを通るので、
--     2つの経路で表現がずれない
--
-- prevStatus を載せているのは、お客様側 SSE が ticket.called /
-- ticket.done / ticket.cancelled を再導出せずに振り分けられるようにするため。
-- ============================================================
create or replace function public.notify_ticket()
returns trigger
language plpgsql
as $$
declare
  r public.tickets;
begin
  if tg_op = 'DELETE' then
    r := old;
  else
    r := new;
  end if;

  -- 同値更新では通知しない（updated_at も動いていない）
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at')
  then
    return null;
  end if;

  perform pg_notify('magii_events', jsonb_build_object(
    'kind',          'ticket',
    'op',            lower(tg_op),
    'ticketID',      r.id,
    'storeID',       r.store_id,
    'accountID',     r.account_id,
    'businessDate',  r.business_date,
    'waitingNumber', r.waiting_number,
    'status',        r.status,
    'prevStatus',    case when tg_op = 'UPDATE' then old.status else null end
  )::text);

  return null;
end
$$;

create trigger tickets_notify
  after insert or update or delete on public.tickets
  for each row execute function public.notify_ticket();

-- ============================================================
-- 通知: stores
--
-- クライアントに見える列だけを比較する。next_switch_at /
-- next_switch_status / status_source / status_changed_at は帳簿用なので除外。
-- これにより仕様の
--   「自動切り替え先と現在値が同じ場合は、見た目の状態変更は発生しない」
--   「現在値と同じなら状態変更通知は不要」
-- が満たされる（同値の自動切り替えは帳簿列しか書かないので通知が出ない）。
--
-- last_number も除外する。発券のたびに store.updated が飛ぶのを防ぐため。
-- 発券自体は ticket.created で通知済み。
-- ============================================================
create or replace function public.notify_store()
returns trigger
language plpgsql
as $$
declare
  vo jsonb;
  vn jsonb;
begin
  vo := jsonb_build_object(
    'name', old.name, 'email', old.email,
    'open', old.open_time, 'close', old.close_time,
    'avg', old.avg_minutes_per_party, 'status', old.status,
    'cdate', old.counter_date
  );
  vn := jsonb_build_object(
    'name', new.name, 'email', new.email,
    'open', new.open_time, 'close', new.close_time,
    'avg', new.avg_minutes_per_party, 'status', new.status,
    'cdate', new.counter_date
  );

  if vo is not distinct from vn then
    return null;
  end if;

  perform pg_notify('magii_events', jsonb_build_object(
    'kind',                'store',
    'op',                  'update',
    'storeID',             new.id,
    'statusChanged',       old.status       is distinct from new.status,
    'businessDateChanged', old.counter_date is distinct from new.counter_date,
    'businessDate',        new.counter_date
  )::text);

  return null;
end
$$;

create trigger stores_notify
  after update on public.stores
  for each row execute function public.notify_store();

-- ============================================================
-- 通知: accounts
--
-- 新APIには電話番号を変更するエンドポイントが無いが、仕様が
-- 「関連アカウントの電話番号変更も表示に影響するため、対象店舗への
-- 同期通知が必要」「管理APIだけを通知源にしない」と定めているため、
-- psql から直接書き換えた場合でも sync.required が出るようにしておく。
--
-- 電話番号が変わっていないときに黙るのは重要。POST /customer/auth/phone の
-- find-or-create は既存アカウントでも DO UPDATE で行を書き直すので、
-- このガードが無いとログインのたびに無意味な sync.required が飛ぶ。
-- ============================================================
create or replace function public.notify_account()
returns trigger
language plpgsql
as $$
begin
  if old.phone_number is not distinct from new.phone_number then
    return null;
  end if;

  perform pg_notify('magii_events', jsonb_build_object(
    'kind',      'account',
    'op',        'update',
    'accountID', new.id
  )::text);

  return null;
end
$$;

create trigger accounts_notify
  after update on public.accounts
  for each row execute function public.notify_account();
