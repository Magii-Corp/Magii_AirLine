/**
 * 環境変数の読み込みと検証
 *
 * 起動時に一度だけ検証し、不足があればその場で落とす。
 * 実行時に process.env を直接触る箇所を作らないこと。
 */

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL は必須です"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  PORT: z.coerce.number().int().positive().default(8787),
  BUSINESS_TIME_ZONE: z.string().default("Asia/Tokyo"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  AUTO_COMPLETE_MINUTES: z.coerce.number().int().positive().default(15),
  JOB_TICK_MS: z.coerce.number().int().positive().default(5000),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(20000),
});

function load() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`環境変数の設定に問題があります:\n${detail}`);
  }

  const data = parsed.data;

  // transaction モードのプーラを指していると LISTEN が無言で機能しなくなる。
  // 起動時に気付けるよう警告を出す。
  if (data.DATABASE_URL.includes(":6543")) {
    console.warn(
      "[env] DATABASE_URL がポート 6543 を指しています。" +
        "transaction モードでは LISTEN が機能せず、SSE が一切届きません。" +
        "セッションモード(5432)の接続文字列に変更してください。"
    );
  }

  return {
    ...data,
    corsOrigins: data.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  };
}

export const env = load();

export type Env = typeof env;
