/*
  # Fix User Sessions Table and Triggers

  1. New Tables
    - Ensures user_sessions table exists with proper structure
  
  2. Functions
    - Creates or replaces all session-related functions
    - Fixes handle_new_auth_session to properly track sessions
    - Updates user_last_login function
    - Adds session_last_activity function
  
  3. Triggers
    - Sets up all necessary triggers on auth.sessions
    - Ensures proper session tracking
  
  4. Security
    - Enables RLS on user_sessions table
    - Creates policies for users to manage their own sessions
*/

-- Create user_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity TIMESTAMPTZ DEFAULT now()
);

-- Create function to handle new auth sessions
CREATE OR REPLACE FUNCTION public.handle_new_auth_session()
RETURNS TRIGGER AS $$
DECLARE
  user_agent_txt TEXT;
  ip_addr INET;
BEGIN
  -- Extract user agent and IP from metadata if available
  user_agent_txt := NULLIF(current_setting('request.headers', true)::json->>'user-agent', '')::TEXT;
  
  -- Try to get IP from request headers
  BEGIN
    ip_addr := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '')::INET;
  EXCEPTION WHEN OTHERS THEN
    ip_addr := NULL;
  END;
  
  -- Insert into user_sessions table
  INSERT INTO public.user_sessions (
    user_id,
    session_token,
    ip_address,
    user_agent,
    expires_at
  ) VALUES (
    NEW.user_id,
    NEW.refresh_token,
    ip_addr,
    user_agent_txt,
    NEW.created_at + interval '7 days' -- Default session expiry of 7 days
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update last login in user profiles
CREATE OR REPLACE FUNCTION public.update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_login = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update session last activity
CREATE OR REPLACE FUNCTION public.update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
DROP TRIGGER IF EXISTS on_auth_session_created_update_login ON auth.sessions;
DROP TRIGGER IF EXISTS on_session_last_activity ON public.user_sessions;

-- Create trigger on auth.sessions to log new sessions
CREATE TRIGGER on_auth_session_created
AFTER INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_session();

-- Create trigger on auth.sessions to update last login
CREATE TRIGGER on_auth_session_created_update_login
AFTER INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_last_login();

-- Create trigger to update last_activity on session updates
CREATE TRIGGER on_session_last_activity
BEFORE UPDATE ON public.user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_session_last_activity();

-- Ensure RLS is enabled on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;

-- Create policies for user_sessions
CREATE POLICY "Users can read own sessions"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add service role policy to allow system operations
CREATE POLICY "Service role can manage verification codes"
  ON public.user_sessions
  FOR ALL
  TO service_role
  USING (true);