import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/auth';
import { Shield, AlertCircle, Clock } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requireApproval?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requiredRole,
  requireApproval = true 
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will be handled by main auth flow
  }

  if (requireApproval && !user.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="bg-yellow-100 p-3 rounded-full inline-block mb-4">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Pending Approval</h2>
          <p className="text-gray-600 mb-6">
            Your account is currently pending approval by an administrator. You will receive an email notification once your account is approved.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 text-sm font-medium">
                Account: {user.email}
              </span>
            </div>
            <div className="text-blue-700 text-sm mt-1">
              Requested Role: {user.role.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="bg-red-100 p-3 rounded-full inline-block mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this area. This section requires {requiredRole.replace('_', ' ')} privileges.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-gray-700 text-sm">
              Your Role: {user.role.replace('_', ' ').toUpperCase()}
            </div>
            <div className="text-gray-700 text-sm">
              Required: {requiredRole.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};