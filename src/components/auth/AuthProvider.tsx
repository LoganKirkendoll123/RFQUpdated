import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../utils/supabase';

interface SimpleUser {
  id: string;
  auth_id: string;
  email: string;
  name?: string;
  company?: string;
  is_verified: boolean;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  profile: SimpleUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, userData: any) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<SimpleUser>) => Promise<{ error?: any }>;
  requestApproval: () => Promise<{ error?: any }>;
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
  const [profile, setProfile] = useState<SimpleUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserProfile(session.user);
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
          await loadUserProfile(session.user);
          
          // Update last login
          if (event === 'SIGNED_IN') {
            await supabase
              .from('simple_users')
              .update({ last_login: new Date().toISOString() })
              .eq('auth_id', session.user.id);
            console.log('✅ User signed in and last_login updated:', session.user.email);
          }
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: User) => {
    try {
      console.log('Loading user profile for userId:', authUser.id);

      // Try to get the user profile
      const { data, error } = await supabase
        .from('simple_users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();
      
      console.log('User profile query result:', data ? 'Found profile' : 'No profile found', 'Error:', error?.code);
      
      if (error) {
        console.error('Error loading simple user:', error);
        
        // Try to create a profile if it doesn't exist
        if (error.code === 'PGRST116') { // No rows returned
          console.log('No profile found, creating one...');
          await createSimpleUser(authUser);
        } else {
          // Use fallback profile
          const fallbackProfile = {
            id: authUser.id,
            auth_id: authUser.id,
            email: authUser.email || 'unknown@example.com',
            is_verified: false,
            is_active: false,
            is_admin: false,
            created_at: new Date().toISOString()
          };
          setProfile(fallbackProfile);
          setLoading(false);
        }
        return; 
      }
      
      if (!data) {
        console.log('No profile found, creating one...');
        await createSimpleUser(authUser);
        return;
      }
      
      setProfile(data);
      console.log('Simple user loaded successfully:', data);
      setLoading(false);
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      
      // Use fallback profile
      const userId = user?.id || 'unknown';
      const fallbackProfile = {
        id: userId,
        auth_id: userId,
        email: user?.email || 'unknown@example.com',
        is_verified: false,
        is_active: false,
        is_admin: false,
        created_at: new Date().toISOString()
      };
      setProfile(fallbackProfile);
      setLoading(false);
    }
  };

  // Create a simple user profile if it doesn't exist
  const createSimpleUser = async (authUser: User): Promise<boolean> => {
    try {
      console.log('Creating new simple user for userId:', authUser.id);
      const email = authUser.email;

      if (!email) {
        console.error('Cannot create simple user: user email not found, using fallback');
        const fallbackUser = {
          id: authUser.id,
          auth_id: authUser.id,
          email: 'unknown@example.com',
          is_verified: false,
          is_active: false,
          is_admin: false,
          created_at: new Date().toISOString()
        };
        setProfile(fallbackUser);
        setLoading(false);
        return true;
      }
      
      // Create a basic user
      try {
        const { data, error } = await supabase
          .from('simple_users')
          .insert({
            auth_id: authUser.id,
            email: email,
            is_verified: false,
            is_active: false
          })
          .select()
          .single();

        console.log('Simple user creation result:', data ? 'User created' : 'Failed to create user', 'Error:', error?.code);
          
        if (error) {
          console.error('Error creating simple user:', error);
          // If we can't create the user in the database, create a fallback one in memory
          const fallbackUser = {
            id: authUser.id,
            auth_id: authUser.id,
            email: email,
            is_verified: false,
            is_active: false,
            is_admin: false,
            created_at: new Date().toISOString()
          };
          setProfile(fallbackUser);
          setLoading(false);
          return true;
        } else {
          console.log('Simple user created successfully:', data);
          
          // Create admin approval request
          await supabase
            .from('admin_approvals')
            .insert({
              user_id: data.id,
              status: 'pending'
            });
            
          setProfile(data);
          setLoading(false);
          return true;
        }
      } catch (insertError) {
        console.error('Exception creating simple user:', insertError);
        // Create a fallback user in memory
        const fallbackUser = {
          id: authUser.id,
          auth_id: authUser.id,
          email: email,
          is_verified: false,
          is_active: false,
          is_admin: false,
          created_at: new Date().toISOString()
        };
        setProfile(fallbackUser);
        setLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Error in createSimpleUser:', error);
      // Create a fallback user in memory for any error
      const userId = user?.id || 'unknown';
      const fallbackUser = {
        id: userId,
        auth_id: userId,
        email: user?.email || 'unknown@example.com',
        is_verified: false,
        is_active: false,
        is_admin: false,
        created_at: new Date().toISOString()
      };
      setProfile(fallbackUser);
      setLoading(false);
      return true;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: undefined
        }
      });

      if (error) {
        return { error };
      }

      // Check if user is approved and active
      if (data.user) {
        const { data: userData } = await supabase
          .from('simple_users')
          .select('is_verified, is_active, is_admin')
          .eq('auth_id', data.user.id)
          .single();

        if (userData && !userData.is_verified) {
          await supabase.auth.signOut();
          return { error: { message: 'Your account is pending verification.' } };
        }

        if (userData && !userData.is_active) {
          await supabase.auth.signOut();
          return { error: { message: 'Your account is pending admin approval.' } };
        }

        // Update last login
        await supabase
          .from('simple_users')
          .update({ last_login: new Date().toISOString() })
          .eq('auth_id', data.user.id);
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
      console.log('Signing up user:', email);

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
        // Create simple user record
        const { data: simpleUser, error: userError } = await supabase
          .from('simple_users') 
          .insert({
            auth_id: data.user.id,
            email: email,
            name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            company: userData.company,
            is_verified: false,
            is_active: false
          })
          .select()
          .single();
          
        if (userError) {
          console.error('Error creating simple user:', userError);
        } else {
          // Create admin approval request
          await supabase
            .from('admin_approvals')
            .insert({
              user_id: simpleUser.id,
              status: 'pending'
            });
            
          // For demo purposes, show an alert
          alert(`Account created! Please wait for admin approval.`);
        }
      }

      return { error: null };
    } catch (error: any) {
      console.error('Error in signUp:', error);
      return { error };
    }
  };

  const requestApproval = async () => {
    try {
      if (!user || !profile) {
        return { error: { message: 'No user logged in' } };
      }
      
      // Check if there's already a pending approval
      const { data: existingApproval } = await supabase
        .from('admin_approvals')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .single();
        
      if (existingApproval) {
        return { error: { message: 'Approval request already pending' } };
      }
      
      // Create new approval request
      const { error } = await supabase
        .from('admin_approvals') 
        .insert({
          user_id: profile.id,
          status: 'pending'
        });
        
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const updateProfile = async (updates: Partial<SimpleUser>) => {
    try {
      if (!user || !profile) return { error: { message: 'No user logged in' } };

      const { error } = await supabase
        .from('simple_users')
        .update(updates)
        .eq('id', profile.id);

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
      await supabase.auth.signOut();
      console.log('User signed out');
    } catch (error: any) {
      console.error('Error signing out:', error);
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
    updateProfile,
    requestApproval
  }; 

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};