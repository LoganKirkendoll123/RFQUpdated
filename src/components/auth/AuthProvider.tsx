import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../utils/supabase';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  is_verified: boolean;
  is_active: boolean;
  role: 'admin' | 'user' | 'manager';
  created_at: string;
  updated_at: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, userData: any) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<{ error?: any }>;
  resendVerification: (email: string) => Promise<{ error?: any }>;
  resetPassword: (email: string) => Promise<{ error?: any }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadUserProfile(session.user.id);
          
          // Update last login
          if (event === 'SIGNED_IN') {
            // Last login is now updated via database trigger
            console.log('User signed in:', session.user.email);
          }
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('Loading user profile for userId:', userId);
      const { data, error, status } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log('Profile query status:', status, 'Error:', error?.message);
      
      if (error) {
        console.error('Error loading user profile:', error);
        // Try to create a profile if it doesn't exist
        if (error?.code === 'PGRST116') { // No rows returned
          console.log('No profile found, attempting to create one...');
          const created = await createUserProfile(userId);
          if (!created) {
            setLoading(false);
          }
          return;
        }
        setLoading(false);
        return;
      }
      
      if (!data) {
        console.error('No profile found despite no error');
        const created = await createUserProfile(userId);
        if (!created) {
          setLoading(false);
        }
        return;
      } else {
        setProfile(data);
        console.log('User profile loaded successfully:', data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setLoading(false);
    }
  };

  // Create a user profile if it doesn't exist
  const createUserProfile = async (userId: string) => {
    try {
      console.log('Creating new user profile for userId:', userId);
      // Get user email from auth.users
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData?.user?.email) {
        console.error('Cannot create profile: user email not found');
        return false;
      }
      
      // Create a basic profile
      const { data, error, status } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          email: userData.user.email,
          is_verified: true, // Auto-verify for now
          is_active: true
        })
        .select()
        .single();

      console.log('Profile creation status:', status, 'Error:', error?.message);
        
      if (error) {
        console.error('Error creating user profile:', error);
        return false;
      } else {
        console.log('User profile created successfully:', data);
        setProfile(data);
        setLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
      setLoading(false);
      return false;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error };
      }

      // Check if user is verified and active
      if (data.user) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('is_verified, is_active')
          .eq('user_id', data.user.id)
          .single();

        if (profileData && !profileData.is_verified) {
          await supabase.auth.signOut();
          return { error: { message: 'Please verify your email before signing in.' } };
        }

        if (profileData && !profileData.is_active) {
          await supabase.auth.signOut();
          return { error: { message: 'Your account has been deactivated. Please contact support.' } };
        }
      }

      return { error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      setLoading(true);
      
      // Create the user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store verification code
        await supabase
          .from('verification_codes')
          .insert({
            user_id: data.user.id,
            email: email,
            code: verificationCode,
            code_type: 'email_verification',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          });

        // In a real app, you would send this code via email
        console.log('Verification code for', email, ':', verificationCode);
        
        // For demo purposes, show an alert
        alert(`Verification code sent to ${email}. For demo: ${verificationCode}`);
      }

      return { error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    try {
      setLoading(true);
      
      // Check verification code
      const { data: codeData, error: codeError } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('code_type', 'email_verification')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (codeError || !codeData) {
        return { error: { message: 'Invalid or expired verification code.' } };
      }

      // Mark code as used
      await supabase
        .from('verification_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', codeData.id);

      // Update user profile as verified
      await supabase
        .from('user_profiles')
        .update({ is_verified: true })
        .eq('user_id', codeData.user_id);

      return { error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async (email: string) => {
    try {
      // Get user by email
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      if (!userData) {
        return { error: { message: 'User not found.' } };
      }

      // Generate new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Delete old codes
      await supabase
        .from('verification_codes')
        .delete()
        .eq('user_id', userData.user_id)
        .eq('code_type', 'email_verification');

      // Store new verification code
      await supabase
        .from('verification_codes')
        .insert({
          user_id: userData.user_id,
          email: email,
          code: verificationCode,
          code_type: 'email_verification',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      // In a real app, send email here
      console.log('New verification code for', email, ':', verificationCode);
      alert(`New verification code sent to ${email}. For demo: ${verificationCode}`);

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user) return { error: { message: 'No user logged in' } };

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (!error) {
        setProfile(prev => prev ? { ...prev, ...updates } : null);
      }

      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    verifyEmail,
    resendVerification,
    resetPassword,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};