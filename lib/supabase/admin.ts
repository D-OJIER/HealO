import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey } from "@/lib/env";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function createAdminClient() {
  return createClient(supabaseUrl!, getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
