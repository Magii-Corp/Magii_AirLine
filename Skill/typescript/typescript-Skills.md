# TypeScript Skills

**name:** typescript-Skills
**description:** typescriptのSkill機能

---

## 使用ルール

### 必要に応じて使用
1. **TypeScript Advanced Types** - 高度な型システムが必要な時
2. **OpenAPI to TypeScript** - OpenAPI仕様からTypeScript型を生成する時

---

## 1. TypeScript Advanced Types

**Source:** `npx skills add https://github.com/wshobson/agents --skill typescript-advanced-types`

TypeScriptの高度な型システムを活用した堅牢で型安全なアプリケーション構築を支援するスキル。

### 主要トピック（5つの概念）

#### 1. Generics
再利用可能で型柔軟なコンポーネントを作成しながら型安全性を維持。

```typescript
function identity<T>(arg: T): T {
  return arg;
}
```

#### 2. Conditional Types
型条件に基づいて分岐する高度なロジックを実現。

```typescript
type IsString<T> = T extends string ? true : false;
```

#### 3. Mapped Types
プロパティを反復処理して既存の型を変換。

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};
```

#### 4. Template Literal Types
パターンマッチングを使った文字列ベースの型を構築。

```typescript
type EventName = `on${Capitalize<string>}`;
```

#### 5. Utility Types
`Partial`、`Pick`、`Omit`、`Record`などの組み込みヘルパーを活用。

```typescript
type PartialUser = Partial<User>;
type UserName = Pick<User, 'name'>;
```

### 主なユースケース
- 型安全なライブラリやフレームワークの構築
- 再利用可能なジェネリックコンポーネントの作成
- 型安全なAPIクライアントの設計
- フォームバリデーションシステムの実装
- 強く型付けされた設定オブジェクトの作成

### ベストプラクティス
- `any` より `unknown` を優先
- 型推論を活用
- ヘルパー型を作成
- const assertionを使用
- 型アサーションよりtype guardsを使用
- 型を体系的にテスト
- strictコンパイラオプションを有効化

### 避けるべきパターン
- `any` の過剰使用
- null チェックの無視
- コンパイルを遅くする過度に複雑な型
- 型の絞り込みのための判別共用体の見落とし
- 深くネストされた条件型
- 再帰型定義での過度な再帰深度

---

## 2. OpenAPI to TypeScript

**Source:** `npx skills add https://github.com/softaworks/agent-toolkit --skill openapi-to-typescript`

OpenAPI 3.0仕様をTypeScriptインターフェースとtype guardsに変換するスキル。

### 目的
OpenAPI JSON/YAMLをTypeScriptインターフェースとtype guardsに変換。

### ワークフロー
1. OpenAPIファイルを検証（バージョン3.0.xである必要）
2. `components/schemas` からスキーマを抽出
3. `paths` からエンドポイントを抽出
4. インターフェースとtype guardsを含むTypeScriptを生成
5. 指定場所に保存（デフォルト: `types/api.ts`）

### 型マッピング

#### プリミティブ
| OpenAPI | TypeScript |
|---------|------------|
| string | string |
| number | number |
| boolean | boolean |
| null | null |

#### フォーマット修飾子
| Format | TypeScript |
|--------|------------|
| uuid | string |
| date | string |
| email | string |
| uri | string |

#### 複合構造
| OpenAPI | TypeScript |
|---------|------------|
| object | interface |
| array | T[] |
| enum | union types |
| oneOf | union types |
| allOf | intersection types |

### 出力内容
- JSDocコメント付きインターフェース（required/optionalフィールド）
- `{Method}{Path}Request/Response` 命名規則に従うリクエスト/レスポンス型エイリアス
- ランタイム検証用のtype guard関数
- 標準的なApiErrorインターフェースとguard

### 使用例

#### 入力（OpenAPI）
```yaml
components:
  schemas:
    User:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
          format: email
```

#### 出力（TypeScript）
```typescript
/**
 * User
 */
export interface User {
  /** @format uuid */
  id: string;
  name: string;
  /** @format email */
  email?: string;
}

export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).name === 'string'
  );
}
```

### 検証要件
- ファイルに "openapi" フィールドが存在し "3.0" で始まること
- "paths" フィールドが存在すること
- "components.schemas" フィールドが存在すること

### `$ref` の処理
スキーマをインライン化するのではなく、スキーマ型を参照する形で解決。
