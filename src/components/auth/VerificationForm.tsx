import React, { useState } from 'react';
import { Mail, Shield, Loader, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface VerificationFormProps {
  email: string;
  onSwitchToLogin: () => void;
}

export const VerificationForm: React.FC<VerificationFormProps> = ({ email, onSwitchToLogin }) => {
  const { verifyEmail, resendVerification } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await verifyEmail(email, code);
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    }
    
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError('');

    const { error } = await resendVerification(email);
    
    if (error) {
      setError(error.message);
    }
    
    setResending(false);
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
                <p className="text-green-100">Account successfully activated</p>
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Verification Complete
              </h3>
              <p className="text-green-700">
                Your email has been verified successfully. You can now sign in to your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Verify Email</h2>
              <p className="text-purple-100">Enter verification code</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
            <Mail className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">
              We've sent a 6-digit verification code to:
            </p>
            <p className="font-semibold text-gray-900 mt-1">{email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 text-sm">{error}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>Verify Email</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-4">
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center justify-center space-x-2 mx-auto"
            >
              {resending ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Resending...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Resend Code</span>
                </>
              )}
            </button>

            <p className="text-sm text-gray-600">
              Already verified?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};