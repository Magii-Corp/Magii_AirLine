お客様側API設計

実装範囲
  iOSアプリは以下のHTTP/SSE契約を使用する。
  接続先: CUSTOMER_API_BASE_URL（例 https://api.example.com）

共通データ（管理APIと同一）
  TicketStatus = waiting | called | done | cancelled
  StoreStatus = open | closed
  Account = { id: string, phone_number: string }
  Store = {
    id: string, name: string,
    openTime: string, closeTime: string, avgMinutesPerParty: number,
    status: StoreStatus
  }
  Ticket = {
    id: string, account: Account, store: Store, business_date: string,
    waitingNumber: number, name: string, partySize: number,
    status: TicketStatus, called_at: string | null, updated_at: string
  }
  エラー = { success: false, code: string, message: string }
  お客様側ではstore.email, store.counterDate, store.lastNumberは返さない。

日時と営業日（管理APIと同一）
  called_at、updated_at、serverTime: UTCのISO 8601。
  openTime、closeTime: 店舗現地時刻のHH:mm。
  business_date、businessDate: YYYY-MM-DD。
  店舗タイムゾーンはAsia/Tokyoに固定する。

受付の制約
  同一アカウント・同一店舗・同一営業日でwaiting/calledは1件まで。
  done/cancelledになれば同日でも再受付可能。
  受付可否はサーバーのstore.statusで判定し、クライアントで計算しない。

1. 店舗情報取得（QRコード読み取り後）
  GET /customer/stores/:storeID
  200: { success: true, store: Store, businessDate: string, serverTime: string }
  404: { success: false, code: "STORE_NOT_FOUND", message: "店舗が見つかりません" }
  QRコードに含まれるstoreIDで店舗情報を取得する。
  store.statusがclosedの場合、アプリ側で受付停止を表示する。

2. 電話番号認証
  POST /customer/auth/phone
  body: { phone_number: string }
  200: { success: true, account: Account, isNewAccount: boolean }
  400: { success: false, code: "INVALID_PHONE", message: "電話番号の形式が正しくありません" }
  電話番号で既存アカウントを検索し、なければ新規作成する。
  ハイフンあり/なし両方を受け付け、内部で正規化して保存する。
  アプリはaccount.idをローカルに保存して以後のリクエストで使用する。
  本番環境ではSMS認証を追加することを推奨する。

3. 受付作成（順番を取る）
  POST /customer/tickets
  body: {
    storeID: string, accountID: string,
    name: string, phone_number: string, partySize: number
  }
  201: {
    success: true, ticket: Ticket,
    groupsAhead: number, estimatedMinutes: number, serverTime: string
  }
  400: { success: false, code: "INVALID_INPUT", message: "入力内容を確認してください" }
  409: { success: false, code: "STORE_CLOSED", message: "現在受付を停止しています" }
  409: { success: false, code: "ALREADY_WAITING", message: "すでに受付中の順番があります" }
  store.statusがclosedの場合は409で拒否する。
  同一アカウント・同一店舗・同一営業日で既にwaiting/calledがある場合は409。
  waitingNumberは店舗の本日のlastNumber+1を原子的に採番する。
  groupsAhead: 自分より前のwaiting件数。
  estimatedMinutes: groupsAhead × store.avgMinutesPerParty。
  成功時、管理画面へticket.createdを配信する。

4. 自分の受付状況取得
  GET /customer/tickets/mine?accountID=...&storeID=...
  200: {
    success: true, ticket: Ticket | null,
    groupsAhead: number, estimatedMinutes: number, serverTime: string
  }
  指定アカウント・店舗・本日のwaiting/called状態の受付を返す。
  該当なしの場合はticket: null、groupsAhead: 0、estimatedMinutes: 0。
  done/cancelledは返さない。
  groupsAheadは自分より前のwaiting件数（自分がcalledなら0）。

5. 受付詳細取得
  GET /customer/tickets/:ticketID
  200: {
    success: true, ticket: Ticket,
    groupsAhead: number, estimatedMinutes: number, serverTime: string
  }
  404: { success: false, code: "TICKET_NOT_FOUND", message: "受付が見つかりません" }
  ticketIDで受付詳細を取得する。
  アプリ再起動時の状態復元に使用する。

6. 到着報告
  POST /customer/tickets/:ticketID/arrive
  body: { accountID: string }
  200: { success: true, ticket: Ticket, serverTime: string }
  400: { success: false, code: "NOT_CALLED", message: "まだ呼び出されていません" }
  404: { success: false, code: "TICKET_NOT_FOUND", message: "受付が見つかりません" }
  409: { success: false, code: "ALREADY_DONE", message: "すでに完了しています" }
  status=calledの受付のみ到着可能。
  到着後はstatus=doneに変更する。
  15分自動完了より前に到着した場合の明示的な完了。
  コミット後にticket.updatedを配信する。

7. 受付キャンセル
  POST /customer/tickets/:ticketID/cancel
  body: { accountID: string }
  200: { success: true, ticket: Ticket, serverTime: string }
  404: { success: false, code: "TICKET_NOT_FOUND", message: "受付が見つかりません" }
  409: { success: false, code: "CANNOT_CANCEL", message: "この受付はキャンセルできません" }
  status=waiting または status=called の受付のみキャンセル可能。
  done/cancelledからの遷移は不可。
  コミット後にticket.updatedを配信する。

8. リアルタイム購読
  GET /customer/tickets/events?ticketID=...
  Content-Type: text/event-stream
  Cache-Control: no-cache
  指定したticketIDに関連するイベントのみ配信する。
  event名:
    ticket.called: 呼び出し（プッシュ通知トリガー）
    ticket.updated: 状態変更
    ticket.done: 完了（到着または15分自動完了）
    ticket.cancelled: キャンセル
    queue.updated: 待ち組数更新（前の組が進んだ時）
    store.updated: 店舗状態変更
  data例:
    { "type": "ticket.called", "ticket": Ticket, "serverTime": "..." }
    { "type": "ticket.updated", "ticket": Ticket, "groupsAhead": number, "estimatedMinutes": number, "serverTime": "..." }
    { "type": "queue.updated", "ticketID": "...", "groupsAhead": number, "estimatedMinutes": number, "serverTime": "..." }
    { "type": "store.updated", "store": Store, "serverTime": "..." }
  heartbeatコメントを15～30秒ごとに送る。
  接続切断時はアプリ側で再接続する。

9. プッシュ通知トークン登録
  POST /customer/devices
  body: { accountID: string, deviceToken: string, platform: "ios" }
  200: { success: true }
  APNsトークンをサーバーに登録する。
  呼び出し時にプッシュ通知を送信するために使用する。
  同一アカウントで複数デバイス登録可能。
  トークン更新時は古いトークンを上書きする。

10. プッシュ通知トークン削除
  DELETE /customer/devices/:deviceToken
  200: { success: true }
  ログアウト時やアプリ削除時にトークンを削除する。

プッシュ通知ペイロード（サーバーからAPNsへ）
  {
    "aps": {
      "alert": { "title": "お呼び出し", "body": "受付番号 42 番のお客様、席のご用意ができました" },
      "sound": "default",
      "badge": 1
    },
    "ticketID": "...",
    "storeID": "...",
    "waitingNumber": 42,
    "type": "called"
  }

エラーコード一覧
  STORE_NOT_FOUND: 店舗が見つからない
  STORE_CLOSED: 店舗が受付停止中
  INVALID_PHONE: 電話番号形式エラー
  INVALID_INPUT: 入力値エラー
  ALREADY_WAITING: 既に受付中
  TICKET_NOT_FOUND: 受付が見つからない
  NOT_CALLED: まだ呼び出されていない
  ALREADY_DONE: 既に完了済み
  CANNOT_CANCEL: キャンセル不可
  SERVER_ERROR: サーバー内部エラー

iOSアプリの画面遷移
  [QRスキャン]
      ↓ GET /customer/stores/:storeID
  [店舗情報確認]
      ↓ store.status == open?
      ├─ No → [受付停止画面]
      └─ Yes ↓
  [情報入力画面]
      ↓ POST /customer/auth/phone（初回のみ）
      ↓ POST /customer/tickets
  [待機画面]
      ↓ SSE: ticket.called または 15分自動完了
      ├─ called → [呼び出し画面]
      │              ↓ POST /customer/tickets/:id/arrive または 15分経過
      │              [完了画面]
      └─ cancelled → [QRスキャン]に戻る

アプリのローカル保存データ
  accountID: アカウントID
  phoneNumber: 電話番号
  userName: 名前（リピーター用）
  currentTicketID: 現在の受付ID
  currentStoreID: 現在の店舗ID
  deviceToken: APNsトークン

管理APIとの整合性
  データモデル: Ticket, Store, Account は同一構造
  ステータス: waiting, called, done, cancelled は同一
  日時形式: ISO 8601 UTC で統一
  SSEイベント: 管理側ticket.updated とお客様側ticket.called/updated は同一受付の変更
  15分自動完了: サーバージョブで実行、両APIに通知配信
  採番: 管理側call-nextとお客様側tickets作成は同一カウンターを使用
