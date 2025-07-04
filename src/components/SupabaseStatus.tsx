import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';
import { checkSupabaseConnection } from '../utils/supabase';

export const SupabaseStatus: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'not-configured'>('checking');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('Checking Supabase connection...');
        // Check if environment variables are set
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.log('Supabase environment variables not configured');
          setStatus('not-configured');
          setError('Supabase environment variables not configured');
          return;
        }

        const { connected, error } = await checkSupabaseConnection();
        console.log('Supabase connection check result:', { connected, error });
        
        if (connected) {
          setStatus('connected');
          setError('');
        } else {
          setStatus('error');
          setError(error || 'Failed to connect to Supabase');
        }
      } catch (err) {
        console.error('Error checking Supabase connection:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    checkConnection();
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'not-configured':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'not-configured':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return 'Checking Supabase connection...';
      case 'connected':
        return 'Supabase connected successfully';
      case 'error':
        return `Supabase connection failed: ${error}`;
      case 'not-configured':
        return 'Supabase not configured. Please set up your environment variables.';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className={`flex items-center space-x-3 p-4 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center space-x-2">
        <Database className="h-5 w-5 text-gray-600" />
        <span className="font-medium text-gray-900">Supabase</span>
      </div>
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className="text-sm text-gray-700">{getStatusMessage()}</span>
      </div>
    </div>
  );
};