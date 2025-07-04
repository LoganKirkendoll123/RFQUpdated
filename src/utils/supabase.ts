import { createClient } from '@supabase/supabase-js';

// Database type definitions for better TypeScript support
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          company: string | null;
          phone: string | null;
          is_verified: boolean;
          is_active: boolean;
          role: 'admin' | 'user' | 'manager';
          created_at: string;
          updated_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          phone?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          role?: 'admin' | 'user' | 'manager';
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          phone?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          role?: 'admin' | 'user' | 'manager';
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
      };
      verification_codes: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          code: string;
          code_type: 'email_verification' | 'password_reset';
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          code: string;
          code_type: 'email_verification' | 'password_reset';
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          code?: string;
          code_type?: 'email_verification' | 'password_reset';
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_token: string;
          ip_address: string | null;
          user_agent: string | null;
          expires_at: string;
          created_at: string;
          last_activity: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_token: string;
          ip_address?: string | null;
          user_agent?: string | null;
          expires_at: string;
          created_at?: string;
          last_activity?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_token?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          expires_at?: string;
          created_at?: string;
          last_activity?: string;
        };
      };
    };
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are missing or contain placeholder values
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url === 'your_supabase_project_url') return false;
  if (url === 'https://placeholder.supabase.co') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidKey = (key: string | undefined): boolean => {
  if (!key) return false;
  if (key === 'your_supabase_anon_key') return false;
  if (key === 'placeholder-key') return false;
  return key.length > 10; // Basic validation for key length
};

const hasValidCredentials = isValidUrl(supabaseUrl) && isValidKey(supabaseAnonKey);

// Only show warning if credentials are not properly configured
if (!hasValidCredentials) {
  console.warn('⚠️ Supabase environment variables not configured. Please set up your Supabase credentials.');
}

// Create client with valid fallback values to prevent app crash
export const supabase = createClient<Database>(
  hasValidCredentials ? supabaseUrl! : 'https://placeholder.supabase.co', 
  hasValidCredentials ? supabaseAnonKey! : 'placeholder-key'
);

// Helper function to check if Supabase is properly configured
export const checkSupabaseConnection = async () => {
  try {
    // Check if we have real credentials
    if (!hasValidCredentials) {
      return { connected: false, error: 'Supabase credentials not configured' };
    }

    const { data, error } = await supabase.from('_supabase_migrations').select('version').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is expected
      throw error;
    }
    return { connected: true, error: null };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};