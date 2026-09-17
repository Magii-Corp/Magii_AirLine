import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

// キー名は新形式 (publishable / secret)。レガシーの anon / service_role は使わない。
const supabaseUrl = requireEnv("SUPABASE_URL");
const supabasePublishableKey = requireEnv("SUPABASE_PUBLISHABLE_KEY");
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

/**
 * Supabase client for anonymous/public access
 * Use for client-side operations with RLS
 */
export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey
);

/**
 * Supabase admin client with the secret key
 * Use for server-side operations that bypass RLS
 */
export const supabaseAdmin = supabaseSecretKey
  ? createClient<Database>(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Create a Supabase client with a specific access token
 * Use for authenticated user operations
 */
export function createSupabaseClient(accessToken: string) {
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
