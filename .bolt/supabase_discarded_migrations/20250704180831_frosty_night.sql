/*
  # Create user profiles table and triggers

  1. New Tables
    - `user_profiles` - Stores user profile information
  2. Security
    - Enable RLS on `user_profiles` table
    - Add policies for authenticated users to read/update their own profiles
    - Add policies for admins to read all profiles
  3. Triggers
    - Create trigger to update timestamp on profile updates
    - Create trigger to create user profile when a new user is created
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

-- Create update timestamp function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_profile_timestamp') THEN
    CREATE FUNCTION update_user_profile_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for updating timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_user_profile_updated'
  ) THEN
    CREATE TRIGGER on_user_profile_updated
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_profile_timestamp();
  END IF;
END $$;

-- Create function to create user profile on user creation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_user_profile') THEN
    CREATE FUNCTION create_user_profile()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.user_profiles (user_id, email, is_verified, is_active, role)
      VALUES (NEW.id, NEW.email, false, true, 'user');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger to create user profile on user creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();
  END IF;
END $$;

-- Create policies for user_profiles
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all profiles'
  ) THEN
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
  END IF;
END $$;