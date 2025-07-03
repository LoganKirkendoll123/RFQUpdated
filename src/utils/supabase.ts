import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only throw error if both variables are completely missing
// Allow the app to start even if they're placeholder values
if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_project_url' || 
    supabaseAnonKey === 'your_supabase_anon_key') {
  console.warn('⚠️ Supabase environment variables not configured. Please set up your Supabase credentials.');
}

// Create client with fallback values to prevent app crash
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

// Helper function to check if Supabase is properly configured
export const checkSupabaseConnection = async () => {
  try {
    // Check if we have real credentials
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl === 'your_supabase_project_url' || 
        supabaseAnonKey === 'your_supabase_anon_key' ||
        supabaseUrl === 'https://placeholder.supabase.co' ||
        supabaseAnonKey === 'placeholder-key') {
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