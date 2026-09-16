# Swift Skills

**name:** swift-Skills
**description:** SwiftのSkill機能

---

## 使用ルール

### 必須使用 (Swiftコード作成時は常に適用)
1. **SwiftUI Pro** - SwiftUIコードを書く際は必ず使用
2. **Swift Concurrency Pro** - 非同期処理を書く際は必ず使用

### 必要に応じて使用
3. **iOS Simulator Skill** - シミュレータ操作・テスト時
4. **SwiftData Pro** - データ永続化実装時
5. **Swift Testing Pro** - テストコード作成時

---

## 1. SwiftUI Pro

**Source:** `npx skills add https://github.com/twostraws/swiftui-agent-skill --skill swiftui-pro`

SwiftUIコードのレビューと作成を支援するスキル。Paul Hudson作成。

### 目的
SwiftUIコードの正確性、モダンAPI使用、保守性、パフォーマンスを包括的にレビュー。

### レビュープロセス（9ステップ）
1. 非推奨APIのチェック
2. View最適化
3. データフロー
4. ナビゲーション
5. デザイン準拠
6. アクセシビリティ
7. パフォーマンス
8. Swiftコード品質
9. コード衛生

### コア原則
- **iOS 26** を新規プロジェクトのデフォルトデプロイターゲット
- **Swift 6.2+** とモダン並行処理パターン
- UIKitよりSwiftUIを優先
- アプリ機能ごとにコードを整理、タイプごとに別ファイル
- 真の問題のみ報告、細かい指摘は避ける

### 出力形式
ファイルごとに発見事項を整理し、before/afterコード例を示す。影響度でランク付けした優先サマリーで締めくくる。

---

## 2. Swift Concurrency Pro

**Source:** `npx skills add https://github.com/twostraws/swift-concurrency-agent-skill --skill swift-concurrency-pro`

Swift並行処理コードのレビューと作成を支援するスキル。

### 目的
async/await、actors、Sendable、task groups、@concurrent、構造化並行処理パターンをカバー。iOS 26+とSwift 6.2+をターゲット。

### レビュープロセス（11ステップ）
1. ホットスポット参照による危険なパターンのチェック
2. Swift 6.2の動作変更
3. Actorの分離と再入可能性
4. 構造化 vs 非構造化並行処理の優先
5. タスクキャンセル処理
6. AsyncストリームとContinuation
7. 同期から非同期へのブリッジング
8. レガシーコードの移行
9. 既知の失敗モード
10. strict-concurrency診断
11. 非同期テストパターン（該当する場合）

### コア原則
- **Swift 6.2+** でstrict concurrencyを有効化
- GCDよりSwift concurrencyを優先（新規コード）
- `Task {}` より構造化並行処理（task groups）を優先
- クロージャ型より `async`/`await` を使用
- `@unchecked Sendable` を応急処置として使わない
- 真の問題のみ報告

---

## 3. iOS Simulator Skill

**Source:** `https://github.com/conorluddy/ios-simulator-skill`

iOSアプリのテスト、ビルド、自動化のための**29本の本番対応スクリプト**を提供。

### 主な特徴
- **セマンティックUI操作**: ピクセル座標ではなくアクセシビリティAPIを使用
- **トークン最適化**: スクリーンショット（1,600-6,300トークン）ではなくアクセシビリティツリー（10-50トークン）を使用

### スクリプトカテゴリ
- ビルド＆開発（2本）
- デバイス状態管理（2本）
- ナビゲーション＆インタラクション（5本）
- テスト＆分析（9本）
- 高度なテスト＆権限（4本）
- シミュレータ検出（2本）
- デバイスライフサイクル管理（5本）

### 技術要件
- macOS 15+
- Xcode 26+
- Python 3.12+
- idb 1.5.1+（`brew tap facebook/fb && brew install facebook/fb/idb-companion facebook/fb/idb-cli`）
- Pillow（ビジュアル差分用、オプション）

---

## 4. SwiftData Pro

**Source:** `npx skills add https://github.com/twostraws/swiftdata-agent-skill --skill swiftdata-pro`

SwiftDataコードのレビューと作成を支援するスキル。

### 目的
`@Model`、`@Query`、述語、インデックス、マイグレーション、リレーションシップ、iCloud同期をカバー。

### 検証対象（5つの参照ガイド）
1. **コアルール**: autosaving、relationships、delete rules、fetch最適化
2. **述語**: サポートされる操作、ランタイムクラッシュパターン
3. **CloudKit制約**: 一意性、結果整合性
4. **インデックス（iOS 18+）**: 単一・複合プロパティインデックス
5. **クラス継承（iOS 26+）**: モデルサブクラスパターン

### コア原則
- Swift 6.2+ とモダン並行処理をターゲット
- 機能が必要な場合を除きCore DataよりSwiftDataを優先
- 明示的な承認なしにサードパーティフレームワークを使わない
- 真の問題のみ報告

---

## 5. Swift Testing Pro

**Source:** `npx skills add https://github.com/twostraws/swift-testing-agent-skill --skill swift-testing-pro`

Swift Testingを使ったテストコードの作成、レビュー、改善を支援するスキル。

### 重要な注意
- Swift TestingはUIテストをサポート**しない** - XCTestを使用
- Swiftリリースごとに進化（年3-4回のリリース）

### レビュープロセス（5ステップ）
1. コアSwift Testingルールの確認（`references/core-rules.md`）
2. テスト構造、アサーション、DI等のベストプラクティス検証（`references/writing-better-tests.md`）
3. 非同期テスト、確認、タイムリミット、actor分離、ネットワークモック（`references/async-tests.md`）
4. 新機能の正しい使用（`references/new-features.md`）
5. XCTestからの移行時はガイダンスに従う（`references/migrating-from-xctest.md`）

### コア原則
- Swift 6.2以降、モダンSwift並行処理をターゲット
- 新規ユニット/統合テストはSwift Testingで作成
- 機能ごとのフォルダレイアウトで一貫したプロジェクト構造

### 出力形式例
```swift
// Before
class UserTests: XCTestCase {

// After
struct UserTests {
```

```swift
// Before
XCTAssertEqual(user.name, "Taylor")

// After
#expect(user.name == "Taylor")
```

```swift
// Before
#expect(users.isEmpty == false)
let first = users.first!

// After
let first = try #require(users.first)
```
