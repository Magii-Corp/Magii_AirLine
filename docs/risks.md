# リスクと未決事項

サーバーAPI再構築で判明した、放置すると問題になる項目。各項目は「何が起きるか / なぜそうなるか / どうするか」で整理している。

---

## 1. 公開前に必ず塞ぐもの

### 1-1. 管理APIが無認証で、QRコードから到達できる 🔴 最優先

**何が起きるか**

店頭のQRコードを読んだ客が、そのまま `POST /admin/tickets/call-next` を連打して待ち列を空にできる。設定変更・受付停止も同様に可能。

**なぜそうなるか**

`email` + `password` のログイン自体は正しく保護されている。**問題はログインが突破されることではなく、そもそも要求されないこと。**

1. QRコードの中身は `store.id` そのもの（仕様: 「設定画面のQRはstore.id自体をフロントで画像化する」）
2. その値は `GET /customer/stores/:storeID` が受け取るIDと同一
3. 管理系の更新エンドポイントは `storeID` しか要求しない（`{storeID}` / `{storeID, newState}`）
4. ログイン状態は検証されない（仕様: 「sessionStorageはブラウザ内保存であり、セッション認証ではない」）

つまりログインを経由せず、QRから得たUUIDだけで管理操作が通る。

**どうするか（公開前に必須）**

`server/src/app.ts` の `adminAuth` ミドルウェアに実装を入れる。現在は素通しのフックだけ置いてある。

最小構成の案:
1. `POST /admin/auth/login` 成功時にセッショントークンを発行する
2. `/admin/*`（login と stores登録を除く）で `Authorization` ヘッダを検証する
3. トークンと storeID の紐付けをサーバー側で保持する

フロント側もトークン保持が必要になるため、管理画面の実装と合わせて行うこと。

### 1-2. 受付詳細に所有者チェックが無い 🟡

**何が起きるか**

`GET /customer/tickets/:ticketID` は `accountID` を要求しないため、ticketIDを知る者は他人の氏名・電話番号を読める。

**なぜそうなるか**

仕様がそう定めている（アプリ再起動時の状態復元に使うため）。ticketID は UUIDv4 で推測困難なので実害は小さいが、意図的なトレードオフであることは認識しておくこと。

**どうするか**

このままにするなら、ticketID をログやURLに残さない運用にする。厳密にするなら `accountID` を必須にし、`mine` と同じ所有者チェックを入れる（iOSアプリは accountID をローカル保存しているので追加は容易）。

---

## 2. 運用・デプロイ上の制約

### 2-1. `DATABASE_URL` はセッションモード必須 🔴 デプロイ時の事故に直結

**何が起きるか**

Supavisor の **transaction モード（ポート6543）** を指定すると、`LISTEN` が成功したように見えて**通知だけが永久に届かない**。SSEが全く動かないのに、エラーもログも出ない。

**なぜそうなるか**

transaction モードは文ごとに別の接続へ割り振るため、セッションに紐づく `LISTEN` の登録が保持されない。同じ理由で `SELECT ... FOR UPDATE` を文をまたいで保持することもできない。

**どうするか**

以下のいずれかを使う。

```
OK  直結              db.<ref>.supabase.co:5432
OK  プーラ(session)    aws-0-<region>.pooler.supabase.com:5432
NG  プーラ(transaction) ...:6543
```

起動時に `:6543` を検出したら警告を出すようにしてある（`config/env.ts`）が、警告であって停止ではない。デプロイ設定時に必ず確認すること。`GET /health` の `listen` が `up` であることも確認する。

### 2-2. Supabase Edge Functions では動かない 🟡

**何が起きるか**

`docs/requirements/overview.md` §9 は「バックエンド: TypeScript（Supabase Edge Functions）」と書いているが、現在の実装はEdge Functionsでは動作しない。

**なぜそうなるか**

Edge Functions は短命なステートレス実行環境なので、

- `LISTEN` 接続を張り続けられない
- SSEの長時間接続を保持できない
- 5秒間隔のバックグラウンドジョブを回せない

**どうするか**

常駐Nodeプロセスとしてデプロイする（Fly.io / Railway / Render / VPS など）。`overview.md` の技術構成の記述も更新すること。

### 2-3. 接続数の見積もり 🟢

プールは `max: 10`、これに加えて **LISTEN専用の接続が1本**。セッションモードでは各接続がサーバー側のスロットを占有し続けるため、インスタンスを増やす際は `インスタンス数 × 11` がSupabaseの接続上限に収まるか確認すること。

---

## 3. 設計上の割り切り

### 3-1. 通知の取りこぼしは起こりうる 🟡

**何が起きるか**

サーバーのLISTEN接続が落ちている間に発生した通知は**完全に失われる**。再送も永続化もされない。

**なぜそうなるか**

`pg_notify` の仕様。メッセージキューではないので配送保証がない。

**どうするか（対処済み）**

再接続のたびに、接続中の管理クライアント全員へ `sync.required` を配信する。クライアントはこれを受けてスナップショットを取り直す。仕様が「updated_atの大小だけでイベントをマージせず、整合したスナップショットを再取得する」と定めているのは、まさにこの前提に立っている。

復旧までの数百ミリ秒〜5秒はイベントの欠落が見えうるが、`sync.required` で収束する。`GET /health` の `listen` で状態を監視できる。

### 3-2. 1ログイン = 1店舗 🟡

`staff_accounts` を廃止し `stores.email` / `stores.password` に統合したため、1アカウントで複数店舗を管理できない。多店舗展開を扱うなら、店舗とアカウントを分けるテーブル設計に戻す必要がある。

### 3-3. `ticket_history` は定義のみで未使用 🟢

決着した組も `tickets` に `done` / `cancelled` として残るため、`ticket_history` はどこからも参照されない。テーブル定義だけ残してある。

`overview.md` §4.2 A-5 の顧客管理（来店履歴・no_show履歴）を実装する際は注意が必要で、旧 `final_status`（`seated` / `no_show`）と新 `status`（`done` / `cancelled`）が**対応しない**。`no_show`（呼び出しに応答しなかった）と `done`（完了）を新モデルは区別していないため、履歴機能を作るときは状態モデルから設計し直しになる。

### 3-4. 型生成の恩恵が書き込み側で効かない 🟢

書き込みを `pg` で行うため `supabase gen types typescript` の出力をそのまま使えず、`server/src/types/rows.ts` は手書きになっている。スキーマ変更時に更新漏れが起きうる。

---

## 4. 壊してはいけない不変条件

コードを変更する人が知らずに壊しやすい箇所。

### 4-1. ロック取得順序は必ず `stores` → `tickets`

| 経路 | ロック |
|---|---|
| 発券 | stores(FOR UPDATE) → tickets(INSERT) |
| 設定保存 / 自動開閉 / 営業日ジョブ | stores のみ |
| call-next / 状態変更 / 取消 / 自動完了 | tickets のみ |

両方を取るのは発券だけで、循環がないためデッドロックしない。**チケットを先にロックしてから店舗をロックするハンドラを追加すると循環ができる。** `db/tx.ts` にも明記してある。

### 4-2. `pg_notify` のペイロードを太らせない

現在は識別子と変更種別だけの薄い形。本体はサーバー側で読み直している。理由は3つ。

1. `pg_notify` のペイロードは **8000バイト上限**。`Ticket` は `Store` を丸ごと内包するため、DTOを載せると実データで超える
2. 読み直せば REST と SSE が同じシリアライザを通るので表現がずれない
3. 通知時点の値ではなく最新値を配れる

トリガにDTOをインライン展開すると、開発中は動いて本番データで突然落ちる。

### 4-3. `updated_at` トリガで `clock_timestamp()` を使わない

`now()` は**トランザクション開始時刻**なので、`called_at = now()` と `updated_at` が同じ文で書かれれば完全に同値になる。仕様の「status/called_at等の変更と同一トランザクションで更新する」はこれで満たしている。`clock_timestamp()` に変えると両者がずれる。

### 4-4. SSEのルートは `:ticketID` より前に登録する

Hono は登録順に照合するため、`GET /customer/tickets/events` を `GET /customer/tickets/:ticketID` より後ろに置くと `"events"` がticketIDとして解釈され、400になる。実装中に一度踏んだ。

### 4-5. 設定保存は「追いつき → 比較」の順を崩さない

`docs/api_design.md` §5 の「設定保存の処理順」を参照。順序を入れ替えると、境界到来直後の保存で管理者の指定が自動切り替えに上書きされる。

---

## 5. 未決事項

仕様に明記がなく、実装側で判断した項目。方針を変える場合はここを見直すこと。

| # | 項目 | 現在の実装 | 背景 |
|---|---|---|---|
| 5-1 | `party_size` の要否 | `NOT NULL CHECK(1..99)` | 両仕様が `partySize: number` と定義。ただし `overview.md` §10-3 は業態次第で要否が変わるとしている |
| 5-2 | 15分という猶予 | 環境変数 `AUTO_COMPLETE_MINUTES`（既定15） | `overview.md` §10-5 が未決事項としている。店舗ごとに変えたくなったら `stores` の列にする |
| 5-3 | `accountID` と `phone_number` の不一致 | 形式だけ検証し、アカウントは書き換えない | 発券APIが両方受け取るが、食い違った場合の挙動が仕様で未定義。破壊的でないほうを選んだ |
| 5-4 | 終端後のSSE | 開いたままにし、アプリ側で閉じる | `done` / `cancelled` 後の扱いが未定義。接続を回収したいならサーバー側で猶予後に閉じる |
| 5-5 | 管理API用エラーコード | 4つ追加（`api_design.md` §8 の † 印） | 仕様のコード一覧はお客様API側にしかない |
| 5-6 | ログイン失敗のステータス | 400 | 仕様のエラー封筒に401が無いため。401にするなら封筒の定義から見直す |

---

## 6. スコープ外として残っている作業

### 6-1. 管理画面（Next.js）の接続実装

現状は**モックUIのみ**でサーバーを一切呼んでいない。

- `admin/app/dashboard/page.tsx` — `mockQueue` / `mockStats` のハードコード、`// TODO: Implement API call`
- `admin/app/auth/login/page.tsx` — `console.log` のみ、`// TODO: Implement Supabase auth`
- `admin/.env.example` に**サーバーのベースURLが無い**ので追加が必要
- `admin/types/database.ts` は旧スキーマのまま（`staff_accounts`、`TicketStatus` に `done`/`cancelled` が無い、`StoreStatus` に廃止した `paused` が残る）

SSE購読（`EventSource`）と `sync.required` でのスナップショット再取得も新規実装になる。

### 6-2. iOSアプリの接続実装

こちらも**ネットワーク層が存在しない**。`URLSession` も APIクライアントも無い。

`ios/.../Models/Reservation.swift` の `ReservationStatus` は `seated` / `noShow` を持っており、新仕様の `waiting|called|done|cancelled` と対応しない。`seatedAt` も新モデルには無い。APIレスポンスの形に合わせて作り直す必要がある。

### 6-3. iOSプロジェクトのファイル木が重複している 🟡

`ios/MagiiAirLine/MagiiAirLine/` と `ios/MagiiAirLine/MagiiAirLine/MagiiAirLine/MagiiAirLine/` に**同一内容のファイル木が2つ**存在する（`Reservation.swift` はバイト単位で一致）。実際のXcodeターゲットは後者（`.xcodeproj` がある側）。

**先に重複を解消すること。** 解消しないまま作業すると、ビルドに含まれない側を編集して「直したのに反映されない」という事故が起きる。

### 6-4. lint 設定が無い

`server/package.json` に `lint` / `format` スクリプトがあるが、`eslint.config.*` も `.prettierrc` も存在しない。CIに組み込むなら設定ファイルの追加が必要。
