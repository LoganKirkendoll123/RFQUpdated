/*
  # Authentication System Setup

  1. New Tables
    - `user_profiles` - Stores user profile information
    - `verification_codes` - Stores email verification codes
    - `user_sessions` - Tracks user login sessions

  2. Security
    - Enable RLS on all tables
    - Create policies for secure access control
    - Set up triggers for automatic profile creation

  3. Admin Account
    - Create admin user for lkirkendoll@fitzmark.com
*/

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  company text,
  phone text,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz,
  UNIQUE(user_id)
);

-- Create verification codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  code_type text NOT NULL CHECK (code_type IN ('email_verification', 'password_reset')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Service role can manage verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Users can read own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON user_sessions;

-- User profiles policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Verification codes policies
CREATE POLICY "Users can read own verification codes"
  ON verification_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage verification codes"
  ON verification_codes
  FOR ALL
  TO service_role
  USING (true);

-- User sessions policies
CREATE POLICY "Users can read own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON user_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user profile timestamp
CREATE OR REPLACE FUNCTION update_user_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate verification code
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS text AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired verification codes
CREATE OR REPLACE FUNCTION clean_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes 
  WHERE expires_at < now() OR used_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_profile_updated ON user_profiles;

-- Triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_profile_timestamp();

-- Create admin account safely
DO $$
DECLARE
  admin_user_id uuid;
  admin_exists boolean;
  profile_exists boolean;
BEGIN
  -- Check if admin user already exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'lkirkendoll@fitzmark.com'
  ) INTO admin_exists;
  
  -- Check if profile already exists
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE email = 'lkirkendoll@fitzmark.com'
  ) INTO profile_exists;
  
  -- Create admin user if it doesn't exist
  IF NOT admin_exists THEN
    -- Generate a UUID for the new user
    admin_user_id := gen_random_uuid();
    
    -- Insert the admin user
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      admin_user_id,
      'lkirkendoll@fitzmark.com',
      crypt('$Browns2021', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"first_name": "Luke", "last_name": "Kirkendoll"}',
      'authenticated',
      'authenticated',
      now(),
      now()
    );
    
    RAISE NOTICE 'Created new admin user with ID: %', admin_user_id;
  ELSE
    -- Get the existing user ID
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'lkirkendoll@fitzmark.com';
    
    -- Update password for existing user
    UPDATE auth.users SET
      encrypted_password = crypt('$Browns2021', gen_salt('bf')),
      email_confirmed_at = now(),
      raw_user_meta_data = '{"first_name": "Luke", "last_name": "Kirkendoll"}',
      updated_at = now()
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Updated existing admin user with ID: %', admin_user_id;
  END IF;
  
  -- Create or update profile
  IF NOT profile_exists THEN
    -- Create new profile
    INSERT INTO user_profiles (
      user_id,
      email,
      first_name,
      last_name,
      company,
      is_verified,
      is_active,
      role
    ) VALUES (
      admin_user_id,
      'lkirkendoll@fitzmark.com',
      'Luke',
      'Kirkendoll',
      'Fitzmark',
      true,
      true,
      'admin'
    );
    
    RAISE NOTICE 'Created new admin profile';
  ELSE
    -- Update existing profile
    UPDATE user_profiles SET
      user_id = admin_user_id,
      is_verified = true,
      is_active = true,
      role = 'admin',
      first_name = 'Luke',
      last_name = 'Kirkendoll',
      company = 'Fitzmark',
      updated_at = now()
    WHERE email = 'lkirkendoll@fitzmark.com';
    
    RAISE NOTICE 'Updated existing admin profile';
  END IF;
  
  RAISE NOTICE 'Admin account setup completed successfully';
END $$;