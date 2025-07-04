/*
  # Fix User Sessions and Profiles

  1. New Tables
    - Ensures `user_sessions` table exists with proper structure
    - Adds missing indexes for performance
  
  2. Security
    - Enables RLS on tables
    - Creates proper policies for authenticated users
    - Adds service role policies
  
  3. Functions
    - Creates trigger functions for session management
    - Adds profile creation function
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

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

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
  -- Update last_login in user_profiles
  UPDATE public.user_profiles
  SET last_login = now()
  WHERE user_id = NEW.user_id;
  
  -- If no rows were updated, try to create a profile
  IF NOT FOUND THEN
    -- Get user email from auth.users
    DECLARE
      user_email TEXT;
    BEGIN
      SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
      
      IF user_email IS NOT NULL THEN
        INSERT INTO public.user_profiles (
          user_id,
          email,
          is_verified,
          is_active,
          role,
          created_at,
          updated_at,
          last_login
        ) VALUES (
          NEW.user_id,
          user_email,
          TRUE, -- Auto-verify for simplicity
          TRUE, -- Active by default
          'user', -- Default role
          now(),
          now(),
          now()
        );
      END IF;
    END;
  END IF;
  
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

-- Create function to create user profile on signup
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    email,
    is_verified,
    is_active,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    FALSE, -- Not verified by default
    TRUE,  -- Active by default
    'user', -- Default role
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
DROP TRIGGER IF EXISTS on_auth_session_created_update_login ON auth.sessions;
DROP TRIGGER IF EXISTS on_session_last_activity ON public.user_sessions;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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

-- Create trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_user_profile();

-- Ensure RLS is enabled on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.user_sessions;

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

CREATE POLICY "Service role can manage sessions"
  ON public.user_sessions
  FOR ALL
  TO service_role
  USING (true);

-- Clean up expired sessions (older than 7 days)
DELETE FROM public.user_sessions WHERE expires_at < now();