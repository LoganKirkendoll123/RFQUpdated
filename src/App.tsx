import React, { useState, useEffect } from 'react';
import { Project44APIClient, FreshXAPIClient } from './utils/apiClient';
import { PricingSettings } from './types';
import { BatchQuoteProcessor } from './components/BatchQuoteProcessor';
import { SpotQuote } from './components/SpotQuote';
import { DatabaseToolbox } from './components/DatabaseToolbox';
import { Analytics } from './components/Analytics';
import { ApiKeyInput } from './components/ApiKeyInput';
import { PricingSettingsComponent } from './components/PricingSettings';
import { SupabaseStatus } from './components/SupabaseStatus';
import { 
  loadProject44Config, 
  loadFreshXApiKey, 
  loadSelectedCarriers, 
  loadPricingSettings,
  loadSelectedCustomer 
} from './utils/credentialStorage';

function App() {
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [freshxClient, setFreshxClient] = useState<FreshXAPIClient | null>(null);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: false,
    fallbackMarkupPercentage: 23
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'batch' | 'spot' | 'database' | 'analytics'>('batch');

  useEffect(() => {
    // Load saved settings on startup
    const loadSavedSettings = async () => {
      try {
        const project44Config = loadProject44Config();
        const freshxApiKey = loadFreshXApiKey();
        const savedCarriers = loadSelectedCarriers();
        const savedPricingSettings = loadPricingSettings();
        const savedCustomer = loadSelectedCustomer();

        if (project44Config?.clientId) {
          const client = new Project44APIClient(project44Config);
          setProject44Client(client);
        }

        if (freshxApiKey) {
          const client = new FreshXAPIClient(freshxApiKey);
          setFreshxClient(client);
        }

        if (savedCarriers) {
          setSelectedCarriers(savedCarriers);
        }

        if (savedPricingSettings) {
          setPricingSettings(savedPricingSettings);
        }

        if (savedCustomer) {
          setSelectedCustomer(savedCustomer);
        }
      } catch (error) {
        console.error('Failed to load saved settings:', error);
      }
    };

    loadSavedSettings();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">FreightIQ</h1>
          <p className="text-gray-600">Smart freight quoting and analytics platform</p>
        </div>

        {/* Supabase Status */}
        <div className="mb-6">
          <SupabaseStatus />
        </div>

        {/* API Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ApiKeyInput
            value=""
            onChange={() => {}}
            placeholder="Project44 Client ID"
            isProject44={true}
          />
          <ApiKeyInput
            value=""
            onChange={() => {}}
            placeholder="FreshX API Key"
            isProject44={false}
          />
        </div>

        {/* Pricing Settings */}
        <div className="mb-8">
          <PricingSettingsComponent
            settings={pricingSettings}
            onSettingsChange={setPricingSettings}
            selectedCustomer={selectedCustomer}
            onCustomerChange={setSelectedCustomer}
          />
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'batch', label: 'Batch Processing' },
              { id: 'spot', label: 'Spot Quote' },
              { id: 'database', label: 'Database' },
              { id: 'analytics', label: 'Analytics' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'batch' && (
          <BatchQuoteProcessor
            project44Client={project44Client}
            freshxClient={freshxClient}
            selectedCarriers={selectedCarriers}
            pricingSettings={pricingSettings}
            selectedCustomer={selectedCustomer}
            onProcessingComplete={() => {}}
          />
        )}

        {activeTab === 'spot' && (
          <SpotQuote
            project44Client={project44Client}
            freshxClient={freshxClient}
            selectedCarriers={selectedCarriers}
            pricingSettings={pricingSettings}
            selectedCustomer={selectedCustomer}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseToolbox />
        )}

        {activeTab === 'analytics' && (
          <Analytics
            results={[]}
            onExport={() => {}}
          />
        )}
      </div>
    </div>
  );
}

export default App;