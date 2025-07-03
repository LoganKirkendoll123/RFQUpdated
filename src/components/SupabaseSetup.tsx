import React, { useState } from 'react';
import { Database, ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react';

export const SupabaseSetup: React.FC = () => {
  const [copied, setCopied] = useState<string>('');

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  const envTemplate = `# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Supabase Integration Setup</h3>
            <p className="text-sm text-gray-600">Configure your Supabase database for analytics and customer data</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Create Supabase Project */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Create Supabase Project</h4>
          </div>
          
          <div className="ml-8 space-y-3">
            <p className="text-gray-700">
              First, create a new Supabase project if you haven't already:
            </p>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Go to Supabase Dashboard</span>
            </a>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Click "New Project"</li>
              <li>Choose your organization</li>
              <li>Enter project name (e.g., "FreightIQ Analytics")</li>
              <li>Set a strong database password</li>
              <li>Select your region</li>
              <li>Click "Create new project"</li>
            </ul>
          </div>
        </div>

        {/* Step 2: Get API Keys */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Get Your API Keys</h4>
          </div>
          
          <div className="ml-8 space-y-3">
            <p className="text-gray-700">
              Once your project is created, get your API keys:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Go to Settings → API in your Supabase dashboard</li>
              <li>Copy your "Project URL"</li>
              <li>Copy your "anon public" key</li>
            </ul>
          </div>
        </div>

        {/* Step 3: Environment Variables */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Configure Environment Variables</h4>
          </div>
          
          <div className="ml-8 space-y-3">
            <p className="text-gray-700">
              Add these environment variables to your <code className="bg-gray-100 px-2 py-1 rounded">.env</code> file:
            </p>
            
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                {envTemplate}
              </pre>
              <button
                onClick={() => copyToClipboard(envTemplate, 'env')}
                className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copied === 'env' ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-300" />
                )}
              </button>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Replace <code>your_supabase_project_url</code> with your actual Project URL</li>
                    <li>Replace <code>your_supabase_anon_key</code> with your actual anon public key</li>
                    <li>Never commit your <code>.env</code> file to version control</li>
                    <li>Restart your development server after adding these variables</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Next Steps */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              4
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Next Steps</h4>
          </div>
          
          <div className="ml-8 space-y-3">
            <p className="text-gray-700">
              After configuring your environment variables:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Restart your development server</li>
              <li>The Supabase status indicator should show "connected"</li>
              <li>We'll then create the database schema for analytics</li>
              <li>Set up tables for shipping history and customer pricing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};