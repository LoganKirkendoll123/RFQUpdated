import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '../../utils/supabase';
import { Laptop, Smartphone, Clock, Trash2, Loader, AlertCircle, Globe, CheckCircle } from 'lucide-react';

interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
  last_activity: string;
}

export const SessionManager: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_activity', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setSessions(data || []);
    } catch (err) {
      setError('Failed to load sessions. Please try again.');
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) {
        throw error;
      }
      
      setSessions(sessions.filter(s => s.id !== sessionId));
      setSuccess('Session terminated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to terminate session. Please try again.');
      console.error('Error terminating session:', err);
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  const terminateAllOtherSessions = async () => {
    if (!user) return;
    
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      const currentToken = session?.refresh_token;
      
      if (!currentToken) {
        throw new Error('Current session not found');
      }
      
      // Delete all sessions except current one
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .neq('session_token', currentToken);
      
      if (error) {
        throw error;
      }
      
      // Reload sessions
      loadSessions();
      setSuccess('All other sessions terminated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to terminate sessions. Please try again.');
      console.error('Error terminating sessions:', err);
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="h-5 w-5 text-gray-400" />;
    
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent.toLowerCase());
    
    if (isMobile) {
      return <Smartphone className="h-5 w-5 text-blue-500" />;
    } else {
      return <Laptop className="h-5 w-5 text-green-500" />;
    }
  };

  const getDeviceType = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown Device';
    
    if (/iphone/i.test(userAgent)) return 'iPhone';
    if (/ipad/i.test(userAgent)) return 'iPad';
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/macintosh|mac os/i.test(userAgent)) return 'Mac';
    if (/windows/i.test(userAgent)) return 'Windows PC';
    if (/linux/i.test(userAgent)) return 'Linux';
    
    return 'Desktop Browser';
  };

  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown Browser';
    
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/opera/i.test(userAgent)) return 'Opera';
    
    return 'Other Browser';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const isCurrentSession = async (sessionToken: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.refresh_token === sessionToken;
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Active Sessions</h2>
        {sessions.length > 1 && (
          <button
            onClick={terminateAllOtherSessions}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Terminate All Other Sessions
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
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

      <div className="space-y-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {getDeviceIcon(session.user_agent)}
                <div>
                  <div className="font-medium text-gray-900">
                    {getDeviceType(session.user_agent)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {getBrowserInfo(session.user_agent)}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Last activity: {formatDate(session.last_activity)}</span>
                    </div>
                    {session.ip_address && (
                      <div className="flex items-center space-x-1">
                        <Globe className="h-3 w-3" />
                        <span>IP: {session.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => terminateSession(session.id)}
                className="text-red-600 hover:text-red-700 transition-colors"
                title="Terminate Session"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {sessions.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No active sessions found</p>
          </div>
        )}
      </div>
    </div>
  );
};