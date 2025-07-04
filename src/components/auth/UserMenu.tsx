import React, { useState, useEffect } from 'react';
import { User, LogOut, Settings, Shield, ChevronDown, Clock, Users } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '../../utils/supabase';

export const UserMenu: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  
  useEffect(() => {
    if (user) {
      loadUserSessions();
    }
  }, [user]);
  
  const loadUserSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('simple_users')
        .select('id')
        .eq('auth_id', user?.id);
        
      if (!error && data) {
        setSessionCount(1); // Simplified - just show 1 session
      }
    } catch (error) {
      console.error('Error checking user session:', error);
    }
  };

  if (!user || !profile) return null;

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 bg-white rounded-lg px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <div className="bg-blue-100 rounded-full p-2">
          <User className="h-4 w-4 text-blue-600" />
        </div>
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">
            {profile.first_name} {profile.last_name}
          </div>
          <div className="text-xs text-gray-500">{profile.email}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 rounded-full p-3">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {profile.name || 'User'}
                </div>
                <div className="text-sm text-gray-500">{profile.email}</div>
                {profile.company && (
                  <div className="text-xs text-gray-400">{profile.company}</div>
                )}
              </div>
            </div>
            
            <div className="mt-3 flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                profile.is_admin ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {profile.is_admin && <Shield className="h-3 w-3 mr-1" />}
                {profile.is_admin ? 'Admin' : 'User'}
              </span>
              
              {profile.is_verified && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Verified
                </span>
              )}
            </div>
          </div>
          
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>
                Active session
              </span>
            </div>
          </div>

          <div className="p-2">
            {profile.is_admin && (
              <button
                onClick={() => {
                  window.location.href = '/admin';
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Users className="h-4 w-4" />
                <span>Admin Dashboard</span>
              </button>
            )}
            
            <button
              onClick={() => {
                window.location.href = '/account';
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Account Settings</span>
            </button>
            
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};