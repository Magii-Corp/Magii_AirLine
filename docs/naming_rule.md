# Git 命名規則・運用ルール

## 1. ブランチ

### 基本構成

| ブランチ | 用途 | 派生元 | マージ先 |
|---|---|---|---|
| `main` | 本番リリース版。常に動く状態を保つ | - | - |
| `develop` | 開発の統合ブランチ。開発段階のものは基本ここ | `main` | `main` |
| `feature/*` | 機能追加 | `develop` | `develop` |
| `fix/*` | バグ修正 | `develop` | `develop` |
| `hotfix/*` | 本番の緊急修正 | `main` | `main` + `develop` |
| `chore/*` | 設定・依存更新など機能に関係ない作業 | `develop` | `develop` |
| `docs/*` | ドキュメントのみの変更 | `develop` | `develop` |

### 命名フォーマット

```
<type>/<内容を英語で>
```

例:
```
feature/user-auth
fix/push-notification-timing
```

ルール:
- **すべて小文字**、単語区切りは `-`（ケバブケース）。`_` や大文字は使わない
- 英語で書く。日本語・ローマ字は避ける
- 短く具体的に（目安 2〜4 単語）。`feature/fix` のような無意味な名前は禁止
- 1 ブランチ = 1 目的。複数の関心事を混ぜない

### 禁止

- `main` / `develop` への直接 push（必ず PR 経由）
- マージ済みブランチの放置（マージしたら削除）

---

## 2. コミットメッセージ


```
<type>(<scope>): <要約>
```

### type 一覧

| type | 意味 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみ |
| `refactor` | リファクタ（機能追加でもバグ修正でもない） |
| `chore` | その他雑務 |

### 例

```
feat(auth): Google ログインを追加
fix(queue): 呼び出し通知が二重送信される問題を修正
```

ルール:
- **type と scope は英語、要約は日本語で OK**（チームで統一されていればどちらでも可）
- 破壊的変更は `feat!:` または フッターに `BREAKING CHANGE:` を書く

---

## 3. Pull Request

- タイトルはコミットメッセージと同じ形式（`feat(auth): Google ログインを追加`）
- 本文に「目的 / 変更内容 / 動作確認方法 / スクショ」を書く
- `.github/PULL_REQUEST_TEMPLATE.md` を用意しておくと楽
- レビュー 1 名以上の approve を必須にする
- マージ後はブランチを自動削除する設定にしておく

---

## 4. .gitignore

### ベース

```gitignore
.env
.env.local
.DS_Store
node_modules/
dist/
.next/
*.tsbuildinfo
supabase/.temp/
supabase/.branches/
```

### 方針

- **秘密情報は絶対にコミットしない**（API キー、トークン、証明書、`.env`）
- 代わりに `.env.example` を作ってキー名だけコミットする


- 生成できるもの（ビルド成果物・依存）はコミットしない
- 逆に、**設定ファイル・ロックファイル（`package-lock.json` 等）・マイグレーションはコミットする**

---


## 5.やるべき

- こまめにコミットする（1 コミット = 1 論理的変更）
- push 前に `develop` を取り込んで conflict を解消しておく（`git pull --rebase origin develop`）
