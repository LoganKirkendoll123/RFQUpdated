import { createClient } from '@supabase/supabase-js';

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
export const supabase = createClient(
  hasValidCredentials ? supabaseUrl! : 'https://placeholder.supabase.co', 
  hasValidCredentials ? supabaseAnonKey! : 'placeholder-key'
);

// Helper function to check if Supabase is properly configured
export const checkSupabaseConnection = async () => {
  try {
    console.log('Checking Supabase connection with URL:', supabaseUrl);
    // Check if we have real credentials
    if (!hasValidCredentials) {
      console.log('Supabase credentials not properly configured');
      return { connected: false, error: 'Supabase credentials not configured' };
    }

    // Test connection by querying a user-accessible table
    console.log('Testing connection to Supabase...');
    const { data, error } = await supabase.from('CustomerCarriers').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      throw error;
    }
    console.log('Supabase connection successful, data:', data);
    return { connected: true, error: null };
  } catch (error) {
    console.error('Supabase connection check error:', error);
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};