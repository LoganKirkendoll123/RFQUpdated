import React, { useState } from 'react';
import { DollarSign, Truck, BarChart3, Shield, Zap, Globe } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

type AuthMode = 'login' | 'signup';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  FreightIQ Pro
                </h1>
                <p className="text-sm text-slate-600 font-medium">Enterprise Freight Quoting Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-2 border border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Enterprise Edition</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-80px)]">
        {/* Left Side - Features */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-12 items-center">
          <div className="max-w-lg">
            <h2 className="text-4xl font-bold text-white mb-6">
              Automated Freight Quoting Engine
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Intelligent routing across FreshX reefer and Project44 LTL/VLTL networks with real-time pricing optimization.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Smart Routing</h3>
                  <p className="text-blue-100">Automatically routes shipments to optimal networks</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Multi-Network Access</h3>
                  <p className="text-blue-100">FreshX reefer + Project44 LTL/VLTL carriers</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Real-Time Analytics</h3>
                  <p className="text-blue-100">Comprehensive reporting and business intelligence</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Enterprise Security</h3>
                  <p className="text-blue-100">Bank-level security with role-based access</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          {mode === 'login' && (
            <LoginForm
              onSwitchToSignup={() => setMode('signup')}
            />
          )}
          
          {mode === 'signup' && (
            <SignupForm
              onSwitchToLogin={() => setMode('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
};