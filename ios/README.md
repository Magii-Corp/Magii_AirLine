# Magii AirLine iOS App

## セットアップ手順

### 1. Xcodeで新規プロジェクトを作成

1. Xcodeを開く
2. `File` → `New` → `Project...`
3. `iOS` → `App` を選択
4. 以下の設定で作成:
   - **Product Name**: `MagiiAirLine`
   - **Team**: 任意
   - **Organization Identifier**: `com.magii`
   - **Interface**: `SwiftUI`
   - **Language**: `Swift`
5. 保存先を `ios/` ディレクトリに指定

### 2. ファイルをインポート

作成されたプロジェクトで:

1. 自動生成された `ContentView.swift` を削除
2. `MagiiAirLine/` フォルダ内のすべてのファイルをプロジェクトにドラッグ&ドロップ:
   - `App/` - アプリのエントリーポイント
   - `Views/` - 各画面
   - `Components/` - 再利用可能なコンポーネント
   - `Theme/` - デザインシステム
   - `Models/` - データモデル
   - `Assets.xcassets/` - アセット

### 3. Info.plist の設定

カメラ権限の説明が必要です。プロジェクト設定で:

1. `Info` タブを開く
2. `Privacy - Camera Usage Description` を追加
3. 値: `QRコードをスキャンするためにカメラを使用します`

## ファイル構成

```
MagiiAirLine/
├── App/
│   ├── MagiiAirLineApp.swift   # アプリのエントリーポイント
│   └── ContentView.swift       # 画面遷移管理
├── Views/
│   ├── QRScannerView.swift     # QR読み取り画面
│   ├── RegistrationView.swift  # 名前・電話番号入力画面
│   ├── WaitingView.swift       # 待機画面（メイン）
│   ├── CalledView.swift        # 呼び出し画面
│   └── CompletionView.swift    # 完了画面
├── Components/
│   ├── PrimaryButton.swift     # ボタンコンポーネント
│   └── CardView.swift          # カードコンポーネント
├── Theme/
│   ├── Colors.swift            # カラーパレット
│   └── Typography.swift        # フォントスタイル
├── Models/
│   └── Reservation.swift       # データモデル
└── Assets.xcassets/
    ├── AppIcon.appiconset/
    └── LaunchBackground.colorset/
```

## デザイン仕様

### カラー
| 用途 | 値 |
|------|-----|
| 背景 | `#000000` |
| カード面 | `#1A1A1C` / `#242426` |
| 主テキスト | `#FFFFFF` |
| 副テキスト | `#8E8E93` |
| 呼び出し背景 | `#FFB020` |
| 「あと1組」強調 | `#FFB020` |

### 画面遷移
```
QR読み取り → [初回] 情報入力 → 待機画面 → 呼び出し画面 → 完了画面
     ↑                                                    |
     └─────────────── 5秒後に自動遷移 ──────────────────────┘
```

## 開発用機能

`#if DEBUG` で囲まれたデモボタンがあります:
- QRスキャン画面: 「デモ: スキャン完了」ボタン
- 待機画面: 「前の組が進む」「呼び出しデモ」ボタン

## 次のステップ（バックエンド連携時）

1. Supabase SDKをSPMで追加
2. `Services/` フォルダを作成
3. API通信ロジックを実装
4. Realtime購読を実装
5. APNs通知を実装
