# Magii AirLine iOS App

顧客向け順番待ちアプリ。QRコードで店舗に登録し、リアルタイムで待ち状況を確認できる。

## セットアップ

```bash
# Xcodeでプロジェクトを開く
open MagiiAirLineNew/MagiiAirLineNew.xcodeproj
```

### 環境設定

以下のファイルでAPIのベースURLを設定：

**`Services/APIService.swift`** と **`Services/SSEService.swift`**：
```swift
private let baseURL = "http://localhost:8787/customer"  // 開発環境
// private let baseURL = "https://api.example.com/customer"  // 本番環境
```

両方のファイルで同じURLに設定すること。

## ファイル構成

```
MagiiAirLineNew/
├── MagiiAirLineNew.xcodeproj/
├── MagiiAirLineNew/
│   └── MagiiAirLine/
│       └── MagiiAirLine/
│           ├── App/
│           │   ├── MagiiAirLineApp.swift    # エントリーポイント
│           │   ├── ContentView.swift        # 画面遷移管理
│           │   └── AppState.swift           # アプリ状態管理
│           ├── Views/
│           │   ├── QRScannerView.swift      # QR読み取り（カメラ）
│           │   ├── RegistrationView.swift   # 名前・人数入力
│           │   ├── WaitingView.swift        # 待機画面
│           │   ├── CalledView.swift         # 呼び出し画面
│           │   └── CompletionView.swift     # 完了画面
│           ├── Services/
│           │   ├── APIService.swift         # REST API通信
│           │   ├── APIModels.swift          # APIレスポンス型
│           │   ├── SSEService.swift         # Server-Sent Events
│           │   ├── NotificationManager.swift # ローカル通知
│           │   └── WidgetDataManager.swift  # ウィジェット連携
│           ├── Components/
│           │   ├── PrimaryButton.swift      # ボタン
│           │   └── CardView.swift           # カード
│           ├── Theme/
│           │   ├── Colors.swift             # カラー定義
│           │   └── Typography.swift         # フォント定義
│           └── Models/
│               └── Reservation.swift        # 予約データ
└── server/                                  # サーバーコード（参照用）
```

## 機能

### QRコード読み取り
- AVFoundationでカメラからQRスキャン
- 対応フォーマット: `magii://store/{storeId}` または `{storeId}`

### リアルタイム更新（SSE）
- 待ち組数・予想時間をリアルタイム更新
- 呼び出し時にバイブレーション + ローカル通知

### 画面遷移
```
QRスキャン → 情報入力 → 待機 → 呼び出し → 完了
                              ↓
                         キャンセル → QRスキャン
```

## API連携

| エンドポイント | メソッド | 用途 |
|--------------|---------|------|
| `/customer/stores/{id}` | GET | 店舗情報取得 |
| `/customer/tickets` | POST | 受付登録 |
| `/customer/tickets/{id}` | DELETE | キャンセル |
| `/customer/tickets/events` | GET (SSE) | リアルタイム更新 |

## 要件

- iOS 18.0+
- Xcode 16+
- カメラ権限（QRスキャン用）
