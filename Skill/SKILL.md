# Magii AirLine 開発スキル

## 役割

Swift + TypeScriptで**店舗の前で待つ体験をなくす**サービスを開発する。

来店客は店頭のQRを読むだけで列に並び、順番が近づいたら通知を受け取る。

---

## 仕事

iOSアプリ（Swift）とAPIサーバー（TypeScript）の機能追加・修正を行う。

### 手順

- [ ] 1. 関係するコードとAPI仕様を読む
- [ ] 2. 変更方針を短く説明する
- [ ] 3. 実装する（API側 → アプリ側の順）
- [ ] 4. テストを実行し、失敗したら直して再実行する
- [ ] 5. 変更の要約を出す

---

## やらないこと

- `git push` をしない（コミットまではOK）
- 課金が発生する操作をしない（有料API、クラウドリソースの作成、App Store Connectでの購入設定など）
- `.env` や秘密鍵を読んだり書き換えたりしない
- 本番環境のデータベースに接続しない

---

## 入力

- ユーザーからの依頼内容
- `ios/`（Swift）
- `server/src/`（TypeScript）
- `docs/api.yaml`（API仕様。コードと食い違う場合はこちらが正）

---

## 出力先

- Swift: `ios/` 以下
- TypeScript: `server/src/` 以下
- API仕様を変えた場合は `docs/api.yaml` も更新する

---

## 終わりの条件

次の**すべて**を満たしたら終了:

- [ ] `npm run typecheck` と `npm test` が通る
- [ ] `xcodebuild test` が通る
- [ ] 変更したファイルと内容を箇条書きで報告した

---

## 止まる条件

次の場合は作業を止めて、ユーザーに聞く:

| 状況 | 対応 |
|------|------|
| **わからない時** | 仕様が曖昧、または選択肢が複数ある → 推測で進めず、質問と選択肢を示す |
| **矛盾がある時** | 依頼・API仕様・既存コードが食い違う → どこが食い違うかを示し、どれに合わせるか聞く |
| **承認がいる時** | ファイルの削除、DBのスキーマ変更、新しいライブラリの追加 → 実行前に内容を説明して待つ |

---

## 関連スキル

### Swift（必須）
- [SwiftUI Pro](./swift/swift-Skills.md#1-swiftui-pro) - 常に使用
- [Swift Concurrency Pro](./swift/swift-Skills.md#2-swift-concurrency-pro) - 常に使用

### Swift（必要時）
- [iOS Simulator Skill](./swift/swift-Skills.md#3-ios-simulator-skill)
- [SwiftData Pro](./swift/swift-Skills.md#4-swiftdata-pro)
- [Swift Testing Pro](./swift/swift-Skills.md#5-swift-testing-pro)

### TypeScript（必要時）
- [TypeScript Advanced Types](./typescript/typescript-Skills.md#1-typescript-advanced-types)
- [OpenAPI to TypeScript](./typescript/typescript-Skills.md#2-openapi-to-typescript)
