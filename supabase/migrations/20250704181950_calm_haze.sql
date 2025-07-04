/*
  # User Profile System

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, unique)
      - `first_name` (text, nullable)
      - `last_name` (text, nullable)
      - `company` (text, nullable)
      - `phone` (text, nullable)
      - `is_verified` (boolean, default false)
      - `is_active` (boolean, default true)
      - `role` (text, default 'user')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `last_login` (timestamptz, nullable)
  
  2. Security
    - Enable RLS on `user_profiles` table
    - Add policies for authenticated users to read/update their own profiles
    - Add policy for admins to read all profiles
  
  3. Functions & Triggers
    - Create function to update timestamp on profile updates
    - Create function to create user profile on user creation
    - Create trigger to automatically create profiles for new users
*/

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_user_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamp
DROP TRIGGER IF EXISTS on_user_profile_updated ON public.user_profiles;
CREATE TRIGGER on_user_profile_updated
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION update_user_profile_timestamp();

-- Create function to create user profile on user creation
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, is_verified, is_active, role)
  VALUES (NEW.id, NEW.email, false, true, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create user profile on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Create policies for user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
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

-- Create verification_codes table for email verification
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

-- Enable RLS on verification_codes
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for verification_codes
DROP POLICY IF EXISTS "Service role can manage verification codes" ON public.verification_codes;
CREATE POLICY "Service role can manage verification codes"
ON public.verification_codes
FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Users can read own verification codes" ON public.verification_codes;
CREATE POLICY "Users can read own verification codes"
ON public.verification_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create user_sessions table for session management
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

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create function to update session last activity
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating session last activity
DROP TRIGGER IF EXISTS on_session_last_activity ON public.user_sessions;
CREATE TRIGGER on_session_last_activity
BEFORE UPDATE ON public.user_sessions
FOR EACH ROW EXECUTE FUNCTION update_session_last_activity();

-- Create policies for user_sessions
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.user_sessions;
CREATE POLICY "Service role can manage sessions"
ON public.user_sessions
FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Users can read own sessions" ON public.user_sessions;
CREATE POLICY "Users can read own sessions"
ON public.user_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete own sessions"
ON public.user_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create function to handle new auth sessions
CREATE OR REPLACE FUNCTION handle_new_auth_session()
RETURNS TRIGGER AS $$
BEGIN
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
    NEW.created_at + interval '1 week'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user last login
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_login = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;