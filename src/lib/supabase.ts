import { createClient } from '@supabase/supabase-js';

// Reads from environment variables if present (supports SUPABASE_*, VITE_*, NEXT_PUBLIC_*)
const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.SUPABASE_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

