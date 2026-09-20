-- 店舗の受付状態ステートマシン
--
-- 仕様「店舗の受付状態と営業時間（手動変更と自動切り替えの優先順位）」の実装。
--
-- 基本ルール:
--   * openTime になったら open、closeTime になったら closed にする
--   * 手動変更したら、その時点から「次の openTime または closeTime」まで
--     手動指定した値を維持する
--   * 次の時刻とは、変更が確定したサーバー時刻より後に最初に来る時刻
--
-- ここで使う now() はトランザクション開始時刻。clock_timestamp() を使うと
-- 同一トランザクション内で値がぶれるため使わないこと。

-- ------------------------------------------------------------
-- p_after より後に最初に来る境界を1件返す
--
-- 昨日・今日・明日の open_time / close_time を候補に並べる。
-- 3日分あれば、日をまたぐ営業時間（22:00開店/翌02:00閉店）も、
-- タイムゾーン変換で日付がずれる場合も取りこぼさない。
--
-- 比較が厳密な「>」なのは仕様の「変更が確定したサーバー時刻より後に
-- 最初に来る時刻」に対応する。境界ちょうどに手動変更した場合は
-- その境界をスキップし、次の境界まで手動指定が維持される。
-- ------------------------------------------------------------
create or replace function public.store_next_boundary(
  p_open  time,
  p_close time,
  p_after timestamptz,
  p_tz    text default 'Asia/Tokyo'
) returns table (switch_at timestamptz, switch_status text)
language sql
stable
as $$
  with base as (
    select (p_after at time zone p_tz)::date as d
  ),
  candidates as (
    select (base.d + offs) + p_open  as local_ts, 'open'::text   as st
      from base, generate_series(-1, 1) as offs
    union all
    select (base.d + offs) + p_close as local_ts, 'closed'::text as st
      from base, generate_series(-1, 1) as offs
  )
  select (local_ts at time zone p_tz), st
    from candidates
   where (local_ts at time zone p_tz) > p_after
   order by 1 asc
   limit 1;
$$;

-- ------------------------------------------------------------
-- p_at の時点で「最後に到来した境界」を1件返す
--
-- 仕様「停止中に複数の切り替え時刻を過ぎた場合は、最後に到来した時刻の
-- 状態へ追いつく」のための関数。N個の境界を順に適用する必要はなく、
-- 「N個適用した後の状態」は「最後の境界の状態」に等しいので O(1) で済む。
-- ------------------------------------------------------------
create or replace function public.store_prev_boundary(
  p_open  time,
  p_close time,
  p_at    timestamptz,
  p_tz    text default 'Asia/Tokyo'
) returns table (switch_at timestamptz, switch_status text)
language sql
stable
as $$
  with base as (
    select (p_at at time zone p_tz)::date as d
  ),
  candidates as (
    select (base.d + offs) + p_open  as local_ts, 'open'::text   as st
      from base, generate_series(-1, 1) as offs
    union all
    select (base.d + offs) + p_close as local_ts, 'closed'::text as st
      from base, generate_series(-1, 1) as offs
  )
  select (local_ts at time zone p_tz), st
    from candidates
   where (local_ts at time zone p_tz) <= p_at
   order by 1 desc
   limit 1;
$$;

-- ------------------------------------------------------------
-- 店舗行をロックし、到来済みの自動切り替えを適用して返す
--
-- 呼び出し側はこの関数が取った行ロックをトランザクションの残りで
-- そのまま引き継ぐ。したがって
--   * PATCH /admin/store/settings
--   * POST /customer/tickets
--   * 自動開閉ジョブ
-- はすべて同じ店舗行のロックで直列化される（仕様「手動変更・設定保存・
-- 自動切り替えは同じ店舗行のロック等で直列化する」）。
--
-- next_switch_at が未到来なら何もしない。これが「手動指定が生きている」
-- 状態であり、ロック取得後に読み直しているため、ジョブが古い値を読んでから
-- ロック待ちに入っていた場合でも、待っている間にコミットされた新しい手動指定を
-- 上書きすることがない。
--
-- 店舗が存在しない場合は全列 NULL の行が返る。呼び出し側は id の NULL を見て
-- STORE_NOT_FOUND と判定すること。
-- ------------------------------------------------------------
create or replace function public.store_apply_auto_switch(p_store_id uuid)
returns public.stores
language plpgsql
as $$
declare
  s         public.stores;
  nb        record;
  pb        record;
  v_changed boolean;
begin
  select * into s from public.stores where id = p_store_id for update;
  if not found then
    return null;
  end if;

  -- 未到来 = 手動指定が有効期間中。触らない。
  if s.next_switch_at > now() then
    return s;
  end if;

  -- 到来済み。何個の境界を跨いでいても最後の境界の状態へ一発で追いつく。
  select * into pb from public.store_prev_boundary(s.open_time, s.close_time, now());
  select * into nb from public.store_next_boundary(s.open_time, s.close_time, now());

  v_changed := (s.status is distinct from pb.switch_status);

  update public.stores set
    status             = pb.switch_status,
    status_changed_at  = case when v_changed then now() else s.status_changed_at end,
    status_source      = 'auto',
    next_switch_at     = nb.switch_at,
    next_switch_status = nb.switch_status
  where id = p_store_id
  returning * into s;

  return s;
end
$$;
