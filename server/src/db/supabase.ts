/**
 * Supabase クライアント（参照専用エンドポイント用）
 *
 * 書き込みは db/pool.ts の pg を使う。こちらは GET 系専用。
 *
 * secret キーを使うのは、RLS をポリシー0個で有効化しており
 * publishable キーでは何も読めないため。
 *
 * ⚠️ 書き込みトランザクションの途中でこのクライアントを使わないこと。
 * PostgREST は別セッションなので、pg 側の未コミットの変更が見えず、
 * 違うスナップショットを読んでしまう。書き込み後にレスポンス用の行を
 * 読む場合は、必ず同じ pg トランザクション内で読むこと。
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export const supabaseRead = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  }
);
