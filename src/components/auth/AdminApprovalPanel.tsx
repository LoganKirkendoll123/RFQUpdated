import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useAuth } from './AuthProvider';
import { CheckCircle, XCircle, Loader, User, Calendar, Shield } from 'lucide-react';

interface PendingUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  company: string;
  created_at: string;
  approval_id: string;
}

export const AdminApprovalPanel: React.FC = () => {
  const { profile } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.is_admin) {
      loadPendingUsers();
    }
  }, [profile]);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('admin_approvals')
        .select(`
          id,
          status,
          simple_users (
            id,
            email,
            name,
            company,
            created_at
          )
        `)
        .eq('status', 'pending');
      
      if (error) {
        throw error;
      }
      
      // Transform data to a more usable format
      const pendingUsersData = data
        .filter(item => item.simple_users)
        .map(item => ({
          id: item.simple_users.id,
          user_id: item.simple_users.id,
          email: item.simple_users.email,
          name: item.simple_users.name || 'Unnamed User',
          company: item.simple_users.company || 'No Company',
          created_at: item.simple_users.created_at,
          approval_id: item.id
        }));
      
      setPendingUsers(pendingUsersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending users');
      console.error('Error loading pending users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, approvalId: string) => {
    try {
      setLoading(true);
      
      // Update approval status
      const { error: approvalError } = await supabase
        .from('admin_approvals')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approval_date: new Date().toISOString()
        })
        .eq('id', approvalId);
      
      if (approvalError) {
        throw approvalError;
      }
      
      // Update user status
      const { error: userError } = await supabase
        .from('simple_users')
        .update({
          is_verified: true,
          is_active: true
        })
        .eq('id', userId);
      
      if (userError) {
        throw userError;
      }
      
      setSuccess(`User approved successfully`);
      loadPendingUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve user');
      console.error('Error approving user:', err);
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (userId: string, approvalId: string) => {
    try {
      setLoading(true);
      
      // Update approval status
      const { error: approvalError } = await supabase
        .from('admin_approvals')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approval_date: new Date().toISOString()
        })
        .eq('id', approvalId);
      
      if (approvalError) {
        throw approvalError;
      }
      
      setSuccess(`User rejected successfully`);
      loadPendingUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject user');
      console.error('Error rejecting user:', err);
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <Shield className="h-5 w-5 text-yellow-600" />
          <div className="text-yellow-800">
            <p className="font-medium">Admin Access Required</p>
            <p className="text-sm">You need admin privileges to access this panel.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pending Account Approvals</h2>
        <button
          onClick={loadPendingUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-700">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">{success}</span>
          </div>
        </div>
      )}

      {loading && pendingUsers.length === 0 ? (
        <div className="flex justify-center items-center p-8">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No pending approval requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    {user.company && (
                      <div className="text-xs text-gray-500 mt-1">{user.company}</div>
                    )}
                    <div className="mt-2 flex items-center space-x-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>Registered: {new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApprove(user.id, user.approval_id)}
                    disabled={loading}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(user.id, user.approval_id)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};