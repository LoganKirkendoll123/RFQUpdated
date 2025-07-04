/*
  # Simplified Authentication System

  1. New Tables
    - `simple_users`
      - `id` (uuid, primary key)
      - `auth_id` (uuid, unique, references auth.users)
      - `email` (text, unique)
      - `name` (text)
      - `company` (text)
      - `is_verified` (boolean)
      - `is_active` (boolean)
      - `is_admin` (boolean)
      - `created_at` (timestamp)
      - `last_login` (timestamp)
    - `admin_approvals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references simple_users)
      - `status` (text: 'pending', 'approved', 'rejected')
      - `approved_by` (uuid, references simple_users)
      - `approval_date` (timestamp)
      - `notes` (text)
      - `created_at` (timestamp)

  2. Security
    - Disable RLS on all tables for simplicity
*/

-- Create simple_users table
CREATE TABLE IF NOT EXISTS simple_users (
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
CREATE TABLE IF NOT EXISTS admin_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES simple_users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  approved_by uuid,
  approval_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT admin_approvals_status_check CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected']))
);

-- Disable RLS on all tables
ALTER TABLE simple_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerCarriers" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipments" DISABLE ROW LEVEL SECURITY;

-- Create a default admin user (if not exists)
DO $$
BEGIN
  -- Check if admin user exists in auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@example.com'
  ) THEN
    -- Insert admin user into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@example.com',
      crypt('admin123', gen_salt('bf')), -- Default password: admin123
      now(),
      null,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin User"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Get the auth_id for the admin user
  WITH admin_auth AS (
    SELECT id FROM auth.users WHERE email = 'admin@example.com'
  )
  -- Insert admin into simple_users if not exists
  INSERT INTO simple_users (auth_id, email, name, is_verified, is_active, is_admin)
  SELECT 
    id, 
    'admin@example.com', 
    'Admin User', 
    true, 
    true, 
    true
  FROM admin_auth
  WHERE NOT EXISTS (
    SELECT 1 FROM simple_users WHERE email = 'admin@example.com'
  );
END $$;