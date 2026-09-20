# Magii AirLine API 設計

実装済みのサーバーAPIの解説。`docs/api.yaml`（OpenAPI）が機械可読な正確な定義であるのに対し、こちらは**人間が全体像を掴むための解説**。細かいフィールド定義はそちらを見ること。

---

## 1. 全体像

APIは2系統に分かれる。

| 系統 | 利用者 | クライアント | 認証 |
|---|---|---|---|
| `/admin/*` | 店舗スタッフ | Next.js 管理画面 | **なし**（後述） |
| `/customer/*` | 来店客 | iOS アプリ | なし（accountIDで識別） |

```
  [お客様: iOSアプリ]                      [店舗: Next.js管理画面]
         │                                          │
         │ QR(store.id)を読む                        │
         ├─ GET  /customer/stores/:storeID           ├─ POST  /admin/auth/login
         ├─ POST /customer/auth/phone                ├─ GET   /admin/dashboard
         ├─ POST /customer/tickets  ←発券            ├─ POST  /admin/tickets/call-next
         ├─ POST /customer/tickets/:id/cancel        ├─ PATCH /admin/tickets/:id/status
         │                                          ├─ PATCH /admin/store/settings
         └─ GET  /customer/tickets/events (SSE)      └─ GET   /admin/tickets/events (SSE)
                        ▲                                          ▲
                        └──────────┬───────────────────────────────┘
                                   │
                        [サーバー: Node + Hono]
                                   │ LISTEN magii_events
                                   ▼
                        [Postgres] ── pg_notify トリガ
```

**通信の原則**

- 書き込みはすべてサーバー経由。クライアントにDBの資格情報は渡さない。
- リアルタイム更新はSSE。ポーリングは廃止した。
- 通知はすべてDBトリガが発生源。APIハンドラもジョブもSSEを直接叩かない。

---

## 2. データモデル

### Ticket

```jsonc
{
  "id": "uuid",
  "account": { "id": "uuid", "phone_number": "09012345678" },
  "store":   { /* Store オブジェクト丸ごと（下記） */ },
  "business_date": "2026-09-20",
  "waitingNumber": 3,
  "name": "ヤマダ",
  "partySize": 2,
  "status": "waiting",          // waiting | called | done | cancelled
  "called_at": null,            // UTC ISO-8601 または null
  "updated_at": "2026-09-20T09:34:45.274Z"
}
```

`store` は**オブジェクト丸ごとの入れ子**。仕様書の型定義をそのまま実装している。ダッシュボードで50件返すと店舗情報が50回繰り返されるが、仕様との一致を優先した。

### Store は2種類の射影がある

| フィールド | 管理側 | お客様側 |
|---|:-:|:-:|
| id / name / openTime / closeTime / avgMinutesPerParty / status | ✅ | ✅ |
| **email** | ✅ | ❌ |
| **counterDate** | ✅ | ❌ |
| **lastNumber** | ✅ | ❌ |

お客様側に店舗のメールアドレスや発券カウンタを渡さない。`serialize/index.ts` の `toAdminStore` / `toCustomerStore` で射影を分けている。

### 命名の例外

DBは snake_case、APIは camelCase が原則だが、**仕様書が snake_case を指定しているフィールドはそのまま**にしてある。

- `Account.phone_number`
- `Ticket.business_date` / `called_at` / `updated_at`

これは仕様書の型定義を忠実に写したもの。勝手に camelCase へ直さないこと。

---

## 3. エンドポイント一覧

成功は実ステータス（200/201）＋ `success: true`。エラーは `{ success: false, code, message }` ＋実ステータス。

### 管理API

| メソッド | パス | 用途 | 主なエラー |
|---|---|---|---|
| POST | `/admin/auth/login` | ログイン。storeIDを返す | 400 `INVALID_CREDENTIALS` |
| POST | `/admin/stores` | 店舗登録 | 400 `INVALID_INPUT` / 409 `EMAIL_ALREADY_EXISTS` |
| GET | `/admin/dashboard?storeID=` | 店舗＋本日の全受付 | 404 `STORE_NOT_FOUND` |
| POST | `/admin/tickets/call-next` | 次を呼ぶ | 409 `NO_WAITING_TICKET` |
| PATCH | `/admin/tickets/:ticketID/status` | 状態変更 | 404 `TICKET_NOT_FOUND` / 409 `INVALID_TRANSITION` |
| PATCH | `/admin/store/settings` | 設定保存 | 400 / 404 |
| GET | `/admin/tickets/events?storeID=` | SSE購読 | 404 |
| GET | `/health` | 死活監視（db / listen / 接続数） | — |

### お客様API

| メソッド | パス | 用途 | 主なエラー |
|---|---|---|---|
| GET | `/customer/stores/:storeID` | QR読取後の店舗情報 | 404 `STORE_NOT_FOUND` |
| POST | `/customer/auth/phone` | 電話番号認証（find-or-create） | 400 `INVALID_PHONE` |
| POST | `/customer/tickets` | 発券 | 409 `STORE_CLOSED` / 409 `ALREADY_WAITING` |
| GET | `/customer/tickets/mine?accountID=&storeID=` | 自分の受付 | 400 |
| GET | `/customer/tickets/:ticketID` | 受付詳細（再起動時の復元用） | 404 `TICKET_NOT_FOUND` |
| POST | `/customer/tickets/:ticketID/cancel` | キャンセル | 404 / 409 `CANNOT_CANCEL` |
| GET | `/customer/tickets/events?ticketID=` | SSE購読 | 404 |
| POST | `/customer/devices` | APNsトークン登録 | 400 |
| DELETE | `/customer/devices/:deviceToken` | トークン削除（冪等） | — |

---

## 4. チケットの状態遷移

```
                    ┌──────────► cancelled  (お客様 or 店舗)
                    │
   waiting ──────► called ──────► done      (店舗 or 15分自動完了)
      │
      └──────────► cancelled
```

| 遷移 | 起こす主体 | 備考 |
|---|---|---|
| （発券） → `waiting` | お客様 | `POST /customer/tickets` |
| `waiting` → `called` | 店舗 | call-next または状態変更。`called_at` を設定 |
| `called` → `done` | 店舗 / **ジョブ** | 15分経過で自動完了 |
| `waiting` / `called` → `cancelled` | お客様 / 店舗 | |

**終端状態からは動かせない。** `done` / `cancelled` への変更要求は 409 `INVALID_TRANSITION`。

**同じ状態の再指定は変更として扱わない。** UPDATE文自体を発行しないので `updated_at` も動かず、SSE通知も飛ばない。

---

## 5. 店舗の受付状態ステートマシン（最重要）

実装で最も誤解を招きやすい箇所。

### 基本の考え方

`store.status` は「**今、新規受付を受け付けるか**」の確定値。営業時間から都度計算するのではなく、DBに保存された値がそのまま答えになる。

- `openTime` / `closeTime` は**自動切り替えの時刻**であって、状態そのものではない。
- フロントエンドが営業時間から独自に受付状態を計算してはいけない。
- お客様側APIも、サーバーが確定した `store.status` だけで受付可否を判定する。

### 状態を支える3つの列

| 列 | 役割 |
|---|---|
| `status` | 確定値（`open` / `closed`） |
| `next_switch_at` | **次の境界** かつ **処理済み境界の水位** |
| `next_switch_status` | その境界で切り替わる先 |

`next_switch_at` が1列で2つの役割を兼ねるのが設計の要。

1. 手動変更は必ず**自分のコミット時刻を起点に**次の境界を計算し直す → 値は常に未来へ進む
2. 自動切り替えジョブは `now() >= next_switch_at` のときだけ動く
3. ジョブは**行ロックを取った後に読み直して**、未来なら何もしない

この3点により「再起動やジョブの遅延後も、過去の切り替えが新しい手動指定を上書きしない」が構造的に保証される。

### 仕様の例（openTime=10:00 / closeTime=18:00）

```
08:00 に open へ手動変更
  ├─ next = 当日10:00 / open
  ├─ 10:00 到来 → 同値なので「見た目の変更なし」、通知も飛ばない
  │            next = 当日18:00 / closed
  └─ 18:00 到来 → closed へ。store.updated 配信

12:00 に closed へ手動変更
  ├─ next = 当日18:00 / closed
  ├─ 18:00 到来 → 同値、変更なし。next = 翌10:00 / open
  └─ 翌10:00 → open へ

19:00 に open へ手動変更    ← 18:00は既に処理済み
  ├─ next = 翌10:00 / open   （当日に残りが無いので翌日の時刻）
  ├─ 翌10:00 → 同値、変更なし。next = 翌18:00 / closed
  └─ 翌18:00 → closed へ
```

**境界ちょうどに手動変更した場合**は、比較が厳密な `>` なのでその境界をスキップし、次の境界まで手動指定が維持される。

**日をまたぐ営業時間**（22:00開店 / 翌02:00閉店）も、境界を時刻順に並べて処理するだけなので特別扱いは不要。

**停止中に複数の境界を通過した場合**は、「N個適用した後の状態」＝「最後に到来した境界の状態」なので、1回の計算で追いつく。

### 設定保存の処理順（ここを間違えると壊れる）

`PATCH /admin/store/settings` は1トランザクション内で次の順に処理する。

1. **先に到来済みの自動切り替えを反映する**（`store_apply_auto_switch`）
2. `statusBefore` ＝ **①の後**の status
3. 名前・営業時間・目安時間を適用
4. `isManualChange = (送信された status !== statusBefore)`
5. 手動変更なら status を採用し、次の境界を `now()` から計算し直す

> **①を②より先にやる理由**
>
> DBが古い `closed` のまま10:00の開店境界が1秒前に到来し、ジョブが未実行の状態で、管理者が 10:00:01 に `status: "closed"` で保存したとする。
>
> - 追いつき処理が**ない**と → `statusBefore = closed`、送信値も `closed` なので「変更なし」と判定され、`next_switch_at` が過去のまま残る。直後のジョブが店舗を **open に反転させてしまう**（管理者の意図に反する）。
> - 追いつき処理が**ある**と → ①で一旦 `open` になり、`statusBefore = open`。送信値 `closed` と異なるので**手動変更**と正しく判定され、閉店時刻まで `closed` が維持される。

また「設定APIは全項目を送る」ため、**statusを含んでいるだけでは手動変更と扱わない**。同値の再保存で手動指定の期限を延長しないこと。

---

## 6. 営業日と時刻

| 項目 | 形式 | 例 |
|---|---|---|
| `called_at` / `updated_at` / `serverTime` | UTC の ISO-8601 | `2026-09-20T09:34:45.274Z` |
| `openTime` / `closeTime` | 店舗現地時刻の `HH:mm` | `10:00` |
| `business_date` / `businessDate` / `counterDate` | `YYYY-MM-DD` | `2026-09-20` |

タイムゾーンは **Asia/Tokyo 固定**（`BUSINESS_TIME_ZONE`）。DB側の関数も同じ既定値を持つので、変える場合は両方を揃えること。

**営業日の決まり方**

- サーバーが現在の営業日を判定する。GETは書き込まない。
- `counter_date` が古くても、GETが過去日を今日として返してはいけない。古い場合はシリアライザが `counterDate = 今日 / lastNumber = 0` として提示する（DBは書き換えない）。
- 実際の繰り上げは営業日切り替えジョブか、次の発券時に店舗ロックの中で行われる。

**発券番号**は店舗・営業日ごとの通し番号。店舗行をロックした上で `lastNumber + 1` を採番するので、歯抜けも重複も起きない。

---

## 7. リアルタイム通知（SSE）

### 仕組み

```
  APIハンドラ / ジョブ / psqlでの直接UPDATE
              │ どの経路でも
              ▼
         [ Postgres ]
              │ AFTER トリガ → pg_notify('magii_events', …)
              │ ※コミット時にのみ配送される
              ▼
      [ LISTEN 専用接続 ]
              │
              ▼
        [ dispatcher ]  ── 本体を読み直してDTO化
              │
              ▼
          [ SSE 配信 ]
```

通知の発生源を**DBトリガ1本に統一**しているため、

- 管理APIだけが通知源にならない（psqlで直接書き換えても通知が飛ぶ）
- 「コミット後に配信する」を実装側で間違えようがない

という2点が構造的に保証される。

### イベント名

**管理側** (`/admin/tickets/events?storeID=`)

| イベント | いつ |
|---|---|
| `ticket.created` | 新規受付（お客様側からの発券を含む） |
| `ticket.updated` | 呼び出し・完了・キャンセル・自動完了・氏名/人数の変更 |
| `store.updated` | 店舗設定/受付状態の変更（自動切り替えを含む） |
| `business-date.changed` | 営業日の切り替え |
| `sync.required` | 接続時・再接続時・関連アカウント変更時 |

**お客様側** (`/customer/tickets/events?ticketID=`)

| イベント | いつ |
|---|---|
| `ticket.called` | 呼び出し（プッシュ通知のトリガー） |
| `ticket.done` | 完了（店舗操作 または 15分自動完了） |
| `ticket.cancelled` | キャンセル |
| `ticket.updated` | 接続直後の現在値、および状態以外の変更 |
| `queue.updated` | 前の組が進んで自分の待ち順が変わった |
| `store.updated` | 店舗状態の変更 |

> **状態変化では固有イベントのみを送る。** `ticket.called` と `ticket.updated` を両方送ると、アプリの画面遷移が二重に走る。`ticket.updated` は状態以外が変わったとき専用。

### クライアント実装者への注意

**1. 接続時・再接続時は必ずスナップショットを取り直すこと**

管理側は接続直後に `sync.required` が届く。これを受けたら `GET /admin/dashboard` を叩き直す。

**2. `updated_at` の大小だけでイベントをマージしないこと**

同一時刻の更新・削除・関連データの変更があるため、`updated_at` だけでは配信順序も網羅性も保証できない。差分マージではなく、整合したスナップショットの再取得で状態を合わせる。

**3. 取りこぼしは起こりうる**

`pg_notify` には再送がなく、サーバーのLISTEN接続が落ちている間の通知は失われる。サーバーは再接続のたびに `sync.required` を配るので、それを受けて取り直せば回復する。

**4. 再接続はクライアント側で行う**

サーバーは `retry: 3000` を送るだけ。`EventSource` は自動で再接続するが、iOS側は自前で再接続処理を持つこと。ハートビート（`: hb`）が20秒ごとに届くので、途絶を検知できる。

**5. 編集中のフォームを通知で上書きしないこと**

`store.updated` が届いても、編集中の設定フォームには反映しない。保存成功後に最新値へ同期する。

---

## 8. エラーコード

| コード | HTTP | 意味 | 主な発生条件 |
|---|---|---|---|
| `STORE_NOT_FOUND` | 404 | 店舗が見つからない | storeID が存在しない |
| `STORE_CLOSED` | 409 | 受付停止中 | `store.status = closed` で発券 |
| `INVALID_PHONE` | 400 | 電話番号の形式エラー | 0始まり10〜11桁でない |
| `INVALID_INPUT` | 400 | 入力値エラー | バリデーション失敗全般 |
| `ALREADY_WAITING` | 409 | 既に受付中 | 同一アカウント・店舗・営業日で2枚目 |
| `TICKET_NOT_FOUND` | 404 | 受付が見つからない | ticketID不正、**storeID/accountID不一致** |
| `CANNOT_CANCEL` | 409 | キャンセル不可 | done / cancelled からの操作 |
| `SERVER_ERROR` | 500 | サーバー内部エラー | 想定外の例外 |
| `EMAIL_ALREADY_EXISTS` † | 409 | メール重複 | 店舗登録時 |
| `INVALID_CREDENTIALS` † | 400 | 認証失敗 | ログイン失敗（メール不存在も同じ） |
| `NO_WAITING_TICKET` † | 409 | 待機中なし | call-next で待機列が空 |
| `INVALID_TRANSITION` † | 409 | 状態変更不可 | 許可されない遷移 |

† 印は**仕様書のコード一覧に無い追加分**。お客様API側にしかコード一覧が無く、管理API用が未定義だったため補った。

**存在を漏らさない方針**：storeID や accountID が一致しない場合は、専用コードを返さず一律 `TICKET_NOT_FOUND` にする。ログイン失敗もメールアドレスの存在有無を区別しない。

---

## 9. サーバー構成

```
server/src/
  config/       環境変数（起動時に検証してfail-fast）
  db/           pg プール / トランザクション / LISTEN / supabase読み取り
  domain/       純粋ロジック（営業日・パスワード・電話番号・遷移・待ち時間）
  repositories/ SQLとPostgRESTクエリ
  schemas/      zod バリデーション
  http/         エラー変換・SSEストリーム
  routes/       admin / customer
  realtime/     SSE接続レジストリ・通知の振り分け
  jobs/         自動開閉・15分自動完了・営業日切り替え
  serialize/    DB行 → DTO（命名の橋渡しはここだけ）
```

**読み書きの境界**

- **書き込み** は `pg`。トランザクションと `FOR UPDATE` が必要なため（PostgRESTでは実現できない）。
- **参照専用エンドポイント** は supabase-js。
- **書き込み後にレスポンス用に読む行は、同じpgトランザクション内で読む。** supabase-jsを混ぜるとスナップショットがずれる。

**バックグラウンドジョブ**（既定5秒間隔、`pg_try_advisory_lock` で多重実行を防止）

| ジョブ | 役割 |
|---|---|
| `auto-switch` | 境界が到来した店舗の状態を切り替える |
| `auto-complete` | `called` から15分経過した受付を `done` にする（全店舗・全営業日） |
| `business-date` | 営業日をまたいだ店舗のカウンタを繰り上げる |

ジョブはSSEを直接発火しない。コミットすればトリガが通知を出す。

---

## 10. 関連ドキュメント

- `docs/api.yaml` — OpenAPI 定義（機械可読・正確な型）
- `docs/risks.md` — **公開前に塞ぐべき項目を含むリスク一覧。必読**
- `docs/sql.sql` — スキーマの参照用（実行可能な定義は `supabase/migrations/`）
- `docs/requirements/overview.md` — サービス全体の要件
