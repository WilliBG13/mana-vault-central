import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Create a Supabase client using safe fallbacks.
// Prefer globals injected by the hosting environment (if available), otherwise use Vite env.
// Note: The Supabase anon key is safe to expose on the client.

const getConfig = () => {
  const w = window as any;
  const url = w.__SUPABASE_URL__ || import.meta.env.VITE_SUPABASE_URL;
  const anon = w.__SUPABASE_ANON_KEY__ || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("Supabase configuration is missing. Please ensure the project is connected to Supabase and env/globals are set.");
  }
  return { url, anon } as { url: string; anon: string };
};

let supabase: SupabaseClient;

export function getSupabase() {
  if (!supabase) {
    const { url, anon } = getConfig();
    supabase = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabase;
}
