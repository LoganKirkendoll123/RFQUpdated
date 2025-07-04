import React from 'react';
import { Loader, Shield } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { AuthScreen } from './AuthScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Loader className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading FreightIQ Pro</h2>
            <p className="text-gray-600">Initializing your session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthScreen />;
  }

  if (!profile.is_verified || !profile.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 max-w-md">
            <div className="bg-yellow-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Shield className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Approval Required</h2>
            <p className="text-gray-600 mb-4">
              Your account is pending admin approval.
            </p>
            <p className="text-sm text-gray-500">
              An administrator will review your account shortly. Please check back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};