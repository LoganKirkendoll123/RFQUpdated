import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to check if Supabase is properly configured
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('_supabase_migrations').select('version').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is expected
      throw error;
    }
    return { connected: true, error: null };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};