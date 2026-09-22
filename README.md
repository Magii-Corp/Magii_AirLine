# Magii AirLine

店舗の順番待ちをスマートにするサービス。来店客は店頭のQRを読むだけで列に並び、順番が近づいたらプッシュ通知を受け取る。店舗側はブラウザの管理画面から1タップで呼び出し。

## 特徴

- **アカウント不要** - QR読み取りから発券まで最短2タップ
- **リピーター対応** - 一度登録した名前・電話番号は次回以降入力不要
- **リアルタイム更新** - PostgreSQL NOTIFY + SSEで待ち状況が即時反映
- **プッシュ通知** - 順番が来たらAPNsで即座に通知
- **双方向同期** - 顧客の情報編集が管理画面にリアルタイム反映

## 構成

```
Magii_AirLine/
├── ios/           # iOSアプリ (Swift/SwiftUI)
├── admin/         # 管理画面 (Next.js/TypeScript)
├── server/        # APIサーバー (Node.js/Hono)
├── supabase/      # DBマイグレーション
└── docs/          # ドキュメント
```

## 技術スタック

| コンポーネント | 技術 |
|---------------|------|
| iOSアプリ | Swift 5.9 / SwiftUI / iOS 17+ |
| 管理画面 | Next.js 14 / TypeScript / CSS |
| サーバー | Node.js 20 / Hono / TypeScript |
| データベース | PostgreSQL (Supabase) |
| リアルタイム | PostgreSQL NOTIFY/LISTEN + SSE |
| 通知 | APNs (Apple Push Notification service) |

## クイックスタート

### 1. サーバー起動

```bash
cd server
npm install
cp .env.example .env  # 環境変数を設定
npm run dev
```

サーバーは http://localhost:8787 で起動

### 2. 管理画面起動

```bash
cd admin
npm install
npm run dev
```

管理画面は http://localhost:3001 で起動

### 3. 店舗登録

ブラウザで http://localhost:3001 にアクセスし、「店舗登録」から新規店舗を作成

### 4. iOSアプリ（実機テスト）

```bash
# MacのローカルIPを確認
ifconfig | grep "inet " | grep -v 127.0.0.1

# ios/MagiiAirLineNew/.../Services/APIService.swift の baseURL を更新
# private let baseURL = "http://<MacのIP>:8787/customer"

# Xcodeでプロジェクトを開いて実機にビルド
open ios/MagiiAirLineNew/MagiiAirLineNew/MagiiAirLine/MagiiAirLine.xcodeproj
```

## 環境変数

### server/.env

```bash
# PostgreSQL (セッションモード必須 - port 5432)
DATABASE_URL=postgresql://...@...supabase.com:5432/postgres

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx

# サーバー設定
PORT=8787
BUSINESS_TIME_ZONE=Asia/Tokyo
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# ジョブ設定
AUTO_COMPLETE_MINUTES=15
JOB_TICK_MS=5000
SSE_HEARTBEAT_MS=20000
```

### admin/.env.local

```bash
# SSE用に直接バックエンドに接続
NEXT_PUBLIC_ADMIN_API_BASE_URL=http://localhost:8787
ADMIN_API_BASE_URL=http://127.0.0.1:8787
```

## API

2系統のAPIを提供

| 系統 | 利用者 | 主なエンドポイント |
|------|--------|-------------------|
| `/admin/*` | 店舗スタッフ | ログイン、ダッシュボード、呼び出し、設定 |
| `/customer/*` | 来店客 | 発券、キャンセル、情報編集、SSE接続 |

### 主要エンドポイント

**顧客API**
- `POST /customer/auth/phone` - 電話番号認証
- `POST /customer/tickets` - 発券
- `GET /customer/tickets/mine` - 自分の受付取得
- `PATCH /customer/tickets/:id` - 情報編集（名前・人数）
- `POST /customer/tickets/:id/cancel` - キャンセル
- `GET /customer/tickets/events` - SSE接続

**管理API**
- `POST /admin/auth/login` - ログイン
- `GET /admin/dashboard` - ダッシュボード取得
- `POST /admin/tickets/call-next` - 次の顧客を呼び出し
- `PATCH /admin/tickets/:id/status` - ステータス変更
- `GET /admin/tickets/events` - SSE接続

## リアルタイム通信

```
┌─────────────┐     PATCH      ┌─────────────┐
│  iOS アプリ  │ ──────────────▶│   サーバー   │
└─────────────┘                └──────┬──────┘
                                      │ UPDATE
                                      ▼
                               ┌─────────────┐
                               │ PostgreSQL  │
                               │  (トリガ)    │
                               └──────┬──────┘
                                      │ pg_notify
                                      ▼
┌─────────────┐     SSE        ┌─────────────┐
│  管理画面   │ ◀──────────────│   サーバー   │
└─────────────┘  ticket.updated └─────────────┘
```

## チケットの状態遷移

```
                  ┌──────────────┐
                  ▼              │
waiting ──▶ called ──▶ done     │
   │           │                │
   │           └──▶ cancelled ──┘
   ▼
cancelled
```

| 状態 | 説明 | 遷移条件 |
|------|------|---------|
| `waiting` | 待機中 | 発券時 |
| `called` | 呼び出し済み | 管理者が呼び出し |
| `done` | 完了 | 管理者が完了、または15分自動完了 |
| `cancelled` | キャンセル | 顧客または管理者がキャンセル |

## ユーザーフロー

### 顧客側
```
店頭QRを読む
    ↓
[初回のみ] 名前・電話番号を入力
    ↓
待機画面（予想待ち時間 / 待機番号 / 前組数）
    ↓ 順番が来る（プッシュ通知 + バイブレーション）
呼び出し画面
    ↓ 管理者が完了処理
完了画面
```

### 管理者側
```
ログイン
    ↓
ダッシュボード（待機数 / 呼び出し中 / 完了数）
    ↓
「次を呼び出す」ボタンで呼び出し
    ↓
顧客来店後「完了」に変更
```

## 開発コマンド

**サーバー**
```bash
npm run dev       # 開発サーバー起動
npm run build     # ビルド
npm run test      # テスト実行
npm run typecheck # 型チェック
```

**管理画面**
```bash
npm run dev       # 開発サーバー起動
npm run build     # ビルド
npm run lint      # Lint実行
```

## ディレクトリ構成

**server/src/**
```
├── config/       # 環境変数 (env.ts)
├── db/           # DBプール / トランザクション / LISTEN
├── domain/       # ビジネスロジック (状態遷移, 営業日, 電話番号)
├── http/         # SSEストリーム, エラーハンドラ
├── jobs/         # バックグラウンドジョブ (自動完了, 自動開閉店)
├── realtime/     # SSE接続管理, ディスパッチャ
├── repositories/ # データアクセス層
├── routes/       # admin/ , customer/
├── schemas/      # Zodバリデーション
└── serialize/    # DB行 → DTO変換
```

**admin/**
```
├── app/          # Next.js App Router (dashboard, tickets, settings)
├── lib/          # API通信, useDashboard hook
└── styles/       # CSS
```

**ios/.../MagiiAirLine/**
```
├── App/          # AppState, エントリポイント
├── Views/        # SwiftUI画面
├── Services/     # API, SSE, 通知, Widget
└── Components/   # 共通UIコンポーネント
```

## トラブルシューティング

### SSEが動作しない
- サーバーの `DATABASE_URL` がポート5432（セッションモード）を指しているか確認
- `curl http://localhost:8787/health` で `"listen": "up"` を確認

### iOS実機でサーバーに接続できない
- MacとiPhoneが同じWi-Fiに接続されているか確認
- `APIService.swift` と `SSEService.swift` のbaseURLがMacのIPを指しているか確認
- サーバーが `0.0.0.0` でリッスンしているか確認

### 管理画面がリアルタイム更新されない
- `admin/.env.local` の `NEXT_PUBLIC_ADMIN_API_BASE_URL` が直接バックエンドを指しているか確認
- ブラウザの開発者ツールでSSE接続を確認

## ドキュメント

- [サービス概要](docs/requirements/overview.md)
- [API設計](docs/api_design.md)
- [リスク一覧](docs/risks.md)

## ライセンス

Private
