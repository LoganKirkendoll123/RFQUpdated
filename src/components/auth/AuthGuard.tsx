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

  if (!profile.is_verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 max-w-md">
            <div className="bg-yellow-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Shield className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Verification Required</h2>
            <p className="text-gray-600 mb-4">
              Please verify your email address to access FreightIQ Pro.
            </p>
            <p className="text-sm text-gray-500">
              Check your email for a verification code, or contact support if you need assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 max-w-md">
            <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Deactivated</h2>
            <p className="text-gray-600 mb-4">
              Your account has been deactivated. Please contact support for assistance.
            </p>
            <p className="text-sm text-gray-500">
              If you believe this is an error, please reach out to our support team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};