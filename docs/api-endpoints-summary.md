# API エンドポイント一覧

## 管理API（Admin）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | /admin/auth/login | 管理者ログイン |
| POST | /admin/stores | 店舗登録 |
| GET | /admin/dashboard?storeID=... | ダッシュボード取得 |
| POST | /admin/tickets/call-next | 次を呼ぶ |
| PATCH | /admin/tickets/:ticketID/status | 受付状態変更 |
| PATCH | /admin/store/settings | 店舗設定保存 |
| GET | /admin/tickets/events?storeID=... | SSE購読 |

---

## お客様API（Customer/iOS）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | /customer/stores/:storeID | 店舗情報取得（QR読取後） |
| POST | /customer/auth/phone | 電話番号でアカウント登録/ログイン |
| POST | /customer/tickets | 受付作成（順番を取る） |
| GET | /customer/tickets/mine?accountID=...&storeID=... | 自分の受付状況取得 |
| GET | /customer/tickets/:ticketID | 受付詳細取得 |
| POST | /customer/tickets/:ticketID/arrive | 到着報告 |
| POST | /customer/tickets/:ticketID/cancel | 受付キャンセル |
| GET | /customer/tickets/events?ticketID=... | SSE購読 |
| POST | /customer/devices | プッシュ通知トークン登録 |
| DELETE | /customer/devices/:deviceToken | プッシュ通知トークン削除 |

---

## 共通データモデル

```typescript
// 状態
type TicketStatus = 'waiting' | 'called' | 'done' | 'cancelled';
type StoreStatus = 'open' | 'closed';

// アカウント
interface Account {
  id: string;
  phone_number: string;
}

// 店舗
interface Store {
  id: string;
  email?: string;           // 管理APIのみ
  name: string;
  openTime: string;         // HH:mm
  closeTime: string;        // HH:mm
  avgMinutesPerParty: number;
  counterDate?: string;     // 管理APIのみ
  lastNumber?: number;      // 管理APIのみ
  status: StoreStatus;
}

// 受付
interface Ticket {
  id: string;
  account: Account;
  store: Store;
  business_date: string;    // YYYY-MM-DD
  waitingNumber: number;
  name: string;
  partySize: number;
  status: TicketStatus;
  called_at: string | null; // ISO 8601 UTC
  updated_at: string;       // ISO 8601 UTC
}

// エラー
interface ErrorResponse {
  success: false;
  code: string;
  message: string;
}
```

---

## iOSアプリの画面とAPI対応

| 画面 | 使用API |
|------|---------|
| QRスキャン | - |
| 店舗確認 | GET /customer/stores/:storeID |
| 情報入力 | POST /customer/auth/phone |
| 確認・発券 | POST /customer/tickets |
| 待機中 | GET /customer/tickets/mine, SSE購読 |
| 呼び出し中 | SSE ticket.called, POST /customer/tickets/:id/arrive |
| 完了 | - |

---

## SSEイベント対応

### 管理API
```
ticket.created   → 新規受付（お客様側からの受付含む）
ticket.updated   → 状態変更（呼び出し、到着、キャンセル、自動完了）
ticket.deleted   → 受付削除
store.updated    → 店舗設定/状態変更
business-date.changed → 営業日切り替え
sync.required    → 全体再同期
```

### お客様API
```
ticket.called    → 呼び出し通知（プッシュ通知トリガー）
ticket.updated   → 状態変更
ticket.done      → 完了
ticket.cancelled → キャンセル
queue.updated    → 待ち組数更新
store.updated    → 店舗状態変更
```

---

## 認証フロー

### 管理API
```
1. POST /admin/auth/login { email, password }
2. レスポンスのstoreIDをsessionStorageに保存
3. 以後のリクエストでstoreIDをクエリ/ボディに含める
```

### お客様API
```
1. POST /customer/auth/phone { phone_number }
2. レスポンスのaccount.idをローカルストレージに保存
3. 以後のリクエストでaccountIDをクエリ/ボディに含める
4. オプション: SMS認証を追加
```

---

## iOSアプリ ローカル保存データ

```swift
// UserDefaults または Keychain に保存
struct LocalUserData: Codable {
    var accountID: String?
    var phoneNumber: String?
    var userName: String?
    var currentTicketID: String?
    var currentStoreID: String?
}
```

---

## プッシュ通知ペイロード

```json
{
  "aps": {
    "alert": {
      "title": "お呼び出し",
      "body": "受付番号 42 番のお客様、席のご用意ができました"
    },
    "sound": "default",
    "badge": 1
  },
  "ticketID": "ticket-uuid",
  "storeID": "store-uuid",
  "waitingNumber": 42,
  "type": "called"
}
```
