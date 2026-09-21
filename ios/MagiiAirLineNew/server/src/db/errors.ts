/**
 * Postgres のエラーを業務エラーへ翻訳する
 *
 * ハンドラ側の事前チェックだけではレースを防げない。たとえば発券は
 * 「既にアクティブな券があるか」を先に見るが、その判定とINSERTの間に
 * 別リクエストが割り込むことがある。最終的な防波堤はDBの制約なので、
 * 制約違反(23505)を必ず対応する業務エラーへ変換する。
 */

import { AppError } from "../domain/errors.js";

type PgErrorLike = {
  code?: string;
  constraint?: string;
  message?: string;
};

/** 制約名 → 業務エラー */
const UNIQUE_VIOLATIONS: Record<string, () => AppError> = {
  tickets_one_active_per_account_uidx: () => new AppError("ALREADY_WAITING"),
  stores_email_key: () => new AppError("EMAIL_ALREADY_EXISTS"),
  accounts_phone_number_key: () => new AppError("INVALID_PHONE"),
};

export function translatePgError(e: unknown): unknown {
  if (e instanceof AppError) return e;

  const pgErr = e as PgErrorLike;
  const code = pgErr?.code;
  if (!code) return e;

  if (code === "23505" && pgErr.constraint) {
    const make = UNIQUE_VIOLATIONS[pgErr.constraint];
    if (make) return make();
  }

  // 23514 CHECK違反 / 23503 外部キー違反 は入力値の問題として扱う
  if (code === "23514" || code === "23503") {
    return new AppError("INVALID_INPUT");
  }

  // 再試行判定のため元のコードを持ち回る
  (e as { pgCode?: string }).pgCode = code;
  return e;
}

export function isUniqueViolation(e: unknown, constraint: string): boolean {
  const pgErr = e as PgErrorLike;
  return pgErr?.code === "23505" && pgErr?.constraint === constraint;
}
