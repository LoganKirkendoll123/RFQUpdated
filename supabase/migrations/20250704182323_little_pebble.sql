/*
  # Disable Row Level Security

  1. Changes
    - Disable RLS on all authentication-related tables
    - Add fallback for missing tables
    - Ensure authentication works without RLS restrictions
*/

-- Disable RLS on user_profiles if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Disable RLS on verification_codes if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'verification_codes'
  ) THEN
    ALTER TABLE public.verification_codes DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Disable RLS on user_sessions if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'user_sessions'
  ) THEN
    ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create minimal user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text NOT NULL,
  first_name text,
  last_name text,
  company text,
  phone text,
  is_verified boolean DEFAULT true,
  is_active boolean DEFAULT true,
  role text DEFAULT 'user'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Create minimal verification_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  code text NOT NULL,
  code_type text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create minimal user_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_token text NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now()
);