# Supabase Skills

**name:** supabase-Skills
**description:** SupabaseのSkill機能

**Source:** `npx skills add supabase/agent-skills`

---

## 使用ルール

### 必須使用
1. **supabase** - Supabase関連の作業時は常に使用
2. **supabase-postgres-best-practices** - SQLクエリ・DB設計時は常に使用

---

## 1. supabase

包括的なSupabase開発スキル。すべてのSupabaseプロダクトをカバー。

### カバー範囲

- **Database** - PostgreSQL、テーブル設計、マイグレーション
- **Auth** - 認証、RLS（Row Level Security）
- **Edge Functions** - TypeScript関数、Denoランタイム
- **Realtime** - リアルタイム購読、Broadcast、Presence
- **Storage** - ファイルアップロード、バケット管理
- **Vector** - pgvector、AI/ML統合

### クライアントライブラリ統合

- supabase-js
- @supabase/ssr（Next.js、Astro、SvelteKit）
- Swift（iOS）
- Kotlin（Android）

### 使用場面

- Supabaseの任意のプロダクト操作
- クライアントライブラリ統合
- 認証の問題やRLSのトラブルシューティング
- ログの読み取りとデバッグ

---

## 2. supabase-postgres-best-practices

Postgresの最適化ガイドライン。8つのカテゴリーをカバー。

### カテゴリー

1. **クエリパフォーマンス** - EXPLAIN ANALYZE、インデックス戦略
2. **接続管理** - コネクションプーリング、Supavisor
3. **スキーマ設計** - 正規化、データ型選択
4. **インデックス** - B-tree、GIN、GiST、部分インデックス
5. **RLS** - Row Level Security ポリシー設計
6. **マイグレーション** - 安全なスキーマ変更
7. **バックアップ** - Point-in-time recovery
8. **モニタリング** - pg_stat_statements、スロークエリ

### 使用場面

- SQLクエリ作成・最適化
- インデックス実装
- パフォーマンス問題の解決
- 遅いクエリの診断
- 接続枯渇の対処

---

## プロジェクト情報

### Supabase Project

- **Project ID:** `zamceqmfwulajpoownvt`
- **Dashboard:** https://supabase.com/dashboard/project/zamceqmfwulajpoownvt

### 接続情報

```
# .env に設定
SUPABASE_URL=https://zamceqmfwulajpoownvt.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## インストール

```bash
# すべてのスキルをインストール
npx skills add supabase/agent-skills

# 特定のスキルのみ
npx skills add supabase/agent-skills --skill supabase
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices

# 更新
npx skills update
```
