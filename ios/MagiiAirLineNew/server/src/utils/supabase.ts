import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY environment variable");
}

/**
 * Supabase client for anonymous/public access
 * Use for client-side operations with RLS
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Supabase admin client with service role key
 * Use for server-side operations that bypass RLS
 */
export const supabaseAdmin = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
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
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
