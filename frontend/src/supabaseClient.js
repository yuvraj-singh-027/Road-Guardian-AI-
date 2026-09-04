import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase config from Vite environment variables with robust fallback
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnotwpnmkfskcscsovep.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fe07dio5v0Vpm006J71SUw_tv1iQuUQ';

// Create and export Supabase client instance if configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export default supabase;
