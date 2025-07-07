import React, { useState } from 'react';
import { CarrierScorecard } from './CarrierScorecard';
import { AIForecasting } from './AIForecasting';
import { NegotiationAnalysis } from './NegotiationAnalysis';
import { NewCarrierAnalysis } from './NewCarrierAnalysis';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Search,
  Award,
  BarChart3,
  Target,
  Brain
} from 'lucide-react';

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'forecasting' | 'negotiation' | 'discovery'>('scorecard');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Advanced analytics for carrier performance, forecasting, and negotiation insights
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'scorecard', label: 'Carrier Scorecard', icon: Award },
            { id: 'forecasting', label: 'AI Forecasting', icon: Brain },
            { id: 'negotiation', label: 'Negotiation Analysis', icon: Target },
            { id: 'discovery', label: 'New Carrier Discovery', icon: Search }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
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
      <div>
        {activeTab === 'scorecard' && <CarrierScorecard />}
        {activeTab === 'forecasting' && <AIForecasting />}
        {activeTab === 'negotiation' && <NegotiationAnalysis />}
        {activeTab === 'discovery' && <NewCarrierAnalysis />}
      </div>
    </div>
  );
};