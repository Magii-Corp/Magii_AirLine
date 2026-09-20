-- RLS: 有効化するが、ポリシーは1つも作らない
--
-- docs/requirements/overview.md §9 の「RLSは最初のテーブルから有効化する」に従う。
--
-- 新APIは完全にサーバー経由で、クライアント（Next.js管理画面 / iOSアプリ）には
-- DB の資格情報を渡さない。したがってポリシーを書く必要がなく、
-- ポリシー0個 = anon / authenticated からは全拒否、となる。
-- publishable キーが万一漏れても直接読み書きされない、という保険。
--
-- サーバーは DATABASE_URL のオーナーロールで接続するため RLS をバイパスする。
-- FORCE ROW LEVEL SECURITY は付けないこと（オーナーにも適用され、
-- サーバーからの読み書きが全て弾かれる）。

alter table public.accounts       enable row level security;
alter table public.stores         enable row level security;
alter table public.tickets        enable row level security;
alter table public.devices        enable row level security;
alter table public.ticket_history enable row level security;
