/*
  # Create verification codes table

  1. New Tables
    - `verification_codes` - Stores email verification and password reset codes
  2. Security
    - Enable RLS on `verification_codes` table
    - Add policies for users to read their own verification codes
    - Add policies for service role to manage all verification codes
*/

-- Create verification_codes table if it doesn't exist
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

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for verification_codes
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own verification codes'
  ) THEN
    CREATE POLICY "Users can read own verification codes"
    ON public.verification_codes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage verification codes'
  ) THEN
    CREATE POLICY "Service role can manage verification codes"
    ON public.verification_codes
    FOR ALL
    TO service_role
    USING (true);
  END IF;
END $$;