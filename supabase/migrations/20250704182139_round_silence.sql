/*
  # Fix authentication tables

  1. New Tables
    - `user_profiles` - Stores user profile information
    - `verification_codes` - Stores email verification and password reset codes
    - `user_sessions` - Tracks user login sessions

  2. Functions
    - `update_user_profile_timestamp()` - Updates timestamp when profile is modified
    - `create_user_profile()` - Creates profile when user is created
    - `update_session_last_activity()` - Updates session activity timestamp
    - `handle_new_auth_session()` - Creates session record when user logs in
    - `update_user_last_login()` - Updates last login timestamp

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  company text,
  phone text,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  role text DEFAULT 'user'::text CHECK (role IN ('admin', 'user', 'manager')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Create verification_codes table
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  code_type text NOT NULL CHECK (code_type IN ('email_verification', 'password_reset')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Create update_user_profile_timestamp function
CREATE OR REPLACE FUNCTION update_user_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update_session_last_activity function
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create create_user_profile function
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, is_verified, is_active, role)
  VALUES (NEW.id, NEW.email, false, true, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create handle_new_auth_session function
CREATE OR REPLACE FUNCTION handle_new_auth_session()
RETURNS TRIGGER AS $$
DECLARE
  session_expiry timestamptz;
BEGIN
  -- Set session expiry to 30 days from now
  session_expiry := now() + interval '30 days';
  
  -- Insert new session record
  INSERT INTO public.user_sessions (
    user_id,
    session_token,
    ip_address,
    user_agent,
    expires_at
  )
  VALUES (
    NEW.user_id,
    NEW.refresh_token,
    NEW.ip::inet,
    NEW.user_agent,
    session_expiry
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update_user_last_login function
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_login = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_user_profile_updated ON public.user_profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_session_last_activity ON public.user_sessions;
DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
DROP TRIGGER IF EXISTS on_auth_session_created_update_login ON auth.sessions;

-- Create triggers
CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_profile_timestamp();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

CREATE TRIGGER on_session_last_activity
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_last_activity();

CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_session();

CREATE TRIGGER on_auth_session_created_update_login
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION update_user_last_login();

-- Enable row level security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Service role can manage verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can read own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.user_sessions;

-- Create policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles user_profiles_1
      WHERE ((user_profiles_1.user_id = auth.uid()) AND (user_profiles_1.role = 'admin'::text))
    )
  );

-- Create policies for verification_codes
CREATE POLICY "Users can read own verification codes"
  ON public.verification_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage verification codes"
  ON public.verification_codes
  FOR ALL
  TO service_role
  USING (true);

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