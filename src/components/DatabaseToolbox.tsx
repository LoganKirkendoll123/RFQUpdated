import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Users, 
} from 'lucide-react';
import { MarginAnalysisTools } from './MarginAnalysisTools';

export const DatabaseToolbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipments' | 'customercarriers' | 'margin-tools'>('shipments');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Database Toolbox</h1>
            <p className="text-sm text-gray-600">Browse your freight data and analyze carrier margins</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'shipments', label: 'Shipments', icon: Users },
            { id: 'customercarriers', label: 'Customer Carriers', icon: Users },
            { id: 'margin-tools', label: 'Margin Analysis', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'margin-tools' && <MarginAnalysisTools />}
    </div>
  );
};