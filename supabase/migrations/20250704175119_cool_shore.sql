/*
  # Create Session Logging Function and Trigger

  1. New Functions
    - `handle_new_auth_session`: Function to log new sessions in user_sessions table
    - `update_user_last_login`: Function to update last_login in user_profiles

  2. New Triggers
    - `on_auth_session_created`: Trigger on auth.sessions to log new sessions
    - `on_session_last_activity`: Trigger to update last_activity timestamp

  3. Security
    - Enable RLS on user_sessions table
    - Add policies for users to manage their own sessions
*/

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
  UPDATE public.user_profiles
  SET last_login = now()
  WHERE user_id = NEW.user_id;
  
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

-- Create trigger on auth.sessions to log new sessions
DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
CREATE TRIGGER on_auth_session_created
AFTER INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_session();

-- Create trigger on auth.sessions to update last login
DROP TRIGGER IF EXISTS on_auth_session_created_update_login ON auth.sessions;
CREATE TRIGGER on_auth_session_created_update_login
AFTER INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_last_login();

-- Create trigger to update last_activity on session updates
DROP TRIGGER IF EXISTS on_session_last_activity ON public.user_sessions;
CREATE TRIGGER on_session_last_activity
BEFORE UPDATE ON public.user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_session_last_activity();

-- Ensure RLS is enabled on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_sessions
CREATE POLICY "Users can read own sessions"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions
  FOR DELETE
  TO authenticated
  USING (uid() = user_id);