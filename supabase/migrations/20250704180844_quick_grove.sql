/*
  # Create user sessions table and triggers

  1. New Tables
    - `user_sessions` - Stores user session information
  2. Security
    - Enable RLS on `user_sessions` table
    - Add policies for users to manage their own sessions
    - Add policies for service role to manage all sessions
  3. Triggers
    - Create trigger to update last_activity timestamp
*/

-- Create user_sessions table if it doesn't exist
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

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Create update last_activity function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_session_last_activity') THEN
    CREATE FUNCTION update_session_last_activity()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.last_activity = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for updating last_activity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_session_last_activity'
  ) THEN
    CREATE TRIGGER on_session_last_activity
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_session_last_activity();
  END IF;
END $$;

-- Create policies for user_sessions
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own sessions'
  ) THEN
    CREATE POLICY "Users can read own sessions"
    ON public.user_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own sessions'
  ) THEN
    CREATE POLICY "Users can delete own sessions"
    ON public.user_sessions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage sessions'
  ) THEN
    CREATE POLICY "Service role can manage sessions"
    ON public.user_sessions
    FOR ALL
    TO service_role
    USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage verification codes'
  ) THEN
    CREATE POLICY "Service role can manage verification codes"
    ON public.user_sessions
    FOR ALL
    TO service_role
    USING (true);
  END IF;
END $$;

-- Create function to handle new auth sessions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_auth_session') THEN
    CREATE FUNCTION handle_new_auth_session()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.user_sessions (
        user_id,
        session_token,
        expires_at
      ) VALUES (
        NEW.user_id,
        NEW.refresh_token,
        NEW.expires_at
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create function to update user last_login
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_last_login') THEN
    CREATE FUNCTION update_user_last_login()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE public.user_profiles
      SET last_login = now()
      WHERE user_id = NEW.user_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;