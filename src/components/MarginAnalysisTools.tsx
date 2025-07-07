import React, { useState, useEffect } from 'react';
import { CarrierScorecard } from './CarrierScorecard';
import { AIForecasting } from './AIForecasting';
import { NegotiationAnalysis } from './NegotiationAnalysis';
import { NewCarrierAnalysis } from './NewCarrierAnalysis';
import { Project44APIClient } from '../utils/apiClient';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Search,
  Award,
  BarChart3,
  Target,
  Brain,
  Calendar,
  Filter
} from 'lucide-react';

interface MarginAnalysisToolsProps {
  project44Client?: Project44APIClient | null;
  selectedCustomer?: string;
}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = ({
  project44Client,
  selectedCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'forecasting' | 'negotiation' | 'discovery'>('scorecard');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [dateRange, setDateRange] = useState(() => {
    // Default to last 3 months
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });
  const [availableCarriers, setAvailableCarriers] = useState<string[]>([]);

  // Load available carriers from database
  useEffect(() => {
    const loadCarriers = async () => {
      try {
        const { supabase } = await import('../utils/supabase');
        const { data, error } = await supabase
          .from('Shipments')
          .select('"Booked Carrier", "Quoted Carrier"')
          .not('"Booked Carrier"', 'is', null)
          .limit(100);
        
        if (!error && data) {
          const carriers = new Set<string>();
          data.forEach(row => {
            if (row["Booked Carrier"]) carriers.add(row["Booked Carrier"]);
            if (row["Quoted Carrier"]) carriers.add(row["Quoted Carrier"]);
          });
          const carrierList = Array.from(carriers).sort();
          setAvailableCarriers(carrierList);
          
          // Set first carrier as default if none selected
          if (!selectedCarrier && carrierList.length > 0) {
            setSelectedCarrier(carrierList[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load carriers:', err);
      }
    };
    
    loadCarriers();
  }, []);

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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Analysis Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Carrier
            </label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a carrier...</option>
              {availableCarriers.map(carrier => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
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
        {activeTab === 'scorecard' && (
          <CarrierScorecard 
            selectedCarrier={selectedCarrier}
            dateRange={dateRange}
          />
        )}
        {activeTab === 'forecasting' && (
          <AIForecasting 
            selectedCarrier={selectedCarrier}
            dateRange={dateRange}
          />
        )}
        {activeTab === 'negotiation' && (
          <NegotiationAnalysis 
            project44Client={project44Client}
            dateRange={dateRange}
          />
        )}
        {activeTab === 'discovery' && (
          <NewCarrierAnalysis 
            project44Client={project44Client}
            dateRange={dateRange}
          />
        )}
      </div>
    </div>
  );
};