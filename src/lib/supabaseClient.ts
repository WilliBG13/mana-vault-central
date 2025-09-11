import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Create a Supabase client using safe fallbacks.
// Prefer globals injected by the hosting environment (if available), otherwise use Vite env.
// Note: The Supabase anon key is safe to expose on the client.

const getConfig = () => {
  const w = window as any;
  // Prefer runtime globals if injected; otherwise use project defaults
  const url = w.__SUPABASE_URL__ || "https://brmayccvnjfshsnaqtim.supabase.co";
  const anon = w.__SUPABASE_ANON_KEY__ || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybWF5Y2N2bmpmc2hzbmFxdGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MDg4MjksImV4cCI6MjA3MzA4NDgyOX0.g6R4V2bHRHcH1IkkMPbyg8HO5tSkTBABFNTBrND8mmo";
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
