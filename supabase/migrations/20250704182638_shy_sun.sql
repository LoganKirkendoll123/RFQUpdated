/*
  # Simplified Authentication System

  1. New Tables
    - `simple_users` - Basic user accounts with minimal fields
    - `admin_approvals` - Tracks admin approval status for new accounts
  
  2. Security
    - Disabled RLS for simplicity
    - No complex policies or triggers
  
  3. Changes
    - Removed complex verification system
    - Added simple admin approval workflow
    - Minimized required fields
*/

-- Drop existing complex tables if they exist
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.verification_codes CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_user_profile_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_session_last_activity() CASCADE;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS handle_new_auth_session() CASCADE;
DROP FUNCTION IF EXISTS update_user_last_login() CASCADE;

-- Create simple_users table
CREATE TABLE IF NOT EXISTS public.simple_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  name text,
  company text,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Create admin_approvals table
CREATE TABLE IF NOT EXISTS public.admin_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.simple_users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid,
  approval_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS on all tables for simplicity
ALTER TABLE public.simple_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approvals DISABLE ROW LEVEL SECURITY;

-- Create admin user if it doesn't exist
INSERT INTO public.simple_users (email, name, is_verified, is_active, is_admin)
VALUES ('admin@example.com', 'System Admin', true, true, true)
ON CONFLICT (email) DO NOTHING;