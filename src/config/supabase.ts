import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types for Supabase
export interface SupabaseHealthLog {
  id: string;
  user_id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
  device_id: string;
}

export interface Database {
  public: {
    Tables: {
      health_logs: {
        Row: SupabaseHealthLog;
        Insert: Omit<SupabaseHealthLog, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SupabaseHealthLog, 'id' | 'created_at'>>;
      };
    };
  };
}