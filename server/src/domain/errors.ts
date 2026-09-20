/**
 * 業務エラーの定義
 *
 * 旧APIは業務的な失敗も常に HTTP 200 + { success: false } で返し、理由を
 * ボディに載せなかったが、新仕様はコードとメッセージを返し、HTTP ステータスも
 * 400 / 404 / 409 を使い分ける。
 *
 * ERROR_CODES のうち下4つ（EMAIL_ALREADY_EXISTS 以降）は仕様のコード一覧には
 * 無い。お客様API側にしかコード一覧が無く、管理API用のコードが未定義なため
 * こちらで補っている。
 */

export const ERROR_CODES = {
  STORE_NOT_FOUND: { status: 404, message: "店舗が見つかりません" },
  STORE_CLOSED: { status: 409, message: "現在受付を停止しています" },
  INVALID_PHONE: { status: 400, message: "電話番号の形式が正しくありません" },
  INVALID_INPUT: { status: 400, message: "入力内容を確認してください" },
  ALREADY_WAITING: { status: 409, message: "すでに受付中の順番があります" },
  TICKET_NOT_FOUND: { status: 404, message: "受付が見つかりません" },
  CANNOT_CANCEL: { status: 409, message: "この受付はキャンセルできません" },
  SERVER_ERROR: { status: 500, message: "サーバーエラーが発生しました" },

  // 仕様外（管理API用に追加）
  EMAIL_ALREADY_EXISTS: {
    status: 409,
    message: "このメールアドレスは既に登録されています",
  },
  INVALID_CREDENTIALS: {
    status: 400,
    message: "メールアドレスまたはパスワードが正しくありません",
  },
  NO_WAITING_TICKET: { status: 409, message: "待機中の受付がありません" },
  INVALID_TRANSITION: { status: 409, message: "この状態変更はできません" },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** クライアントに返すメッセージ。既定はコードごとの定型文 */
  readonly publicMessage: string;

  constructor(code: ErrorCode, publicMessage?: string) {
    const def = ERROR_CODES[code];
    super(`${code}: ${publicMessage ?? def.message}`);
    this.name = "AppError";
    this.code = code;
    this.status = def.status;
    this.publicMessage = publicMessage ?? def.message;
  }

  toBody(): { success: false; code: ErrorCode; message: string } {
    return { success: false, code: this.code, message: this.publicMessage };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
