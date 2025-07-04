import React, { useState, useEffect } from 'react';
import { Truck, Upload, Database, Settings, BarChart3, Calculator, Users, FileText, Zap } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { ApiKeyInput } from './components/ApiKeyInput';
import { ResultsTable } from './components/ResultsTable';
import { ProcessingStatus } from './components/ProcessingStatus';
import { SupabaseStatus } from './components/SupabaseStatus';
import { DatabaseManager } from './components/DatabaseManager';
import { PricingSettingsComponent as PricingSettings } from './components/PricingSettings';
import { Analytics } from './components/Analytics';
import { SpotQuote } from './components/SpotQuote';
import { CustomerSelection } from './components/CustomerSelection';
import { QuickActions } from './components/QuickActions';
import { RFQRow, QuoteResult } from './types';
import { parseCSV, parseXLSX } from './utils/fileParser';
import { processRFQBatch } from './utils/apiClient';
import { getStoredCredentials } from './utils/credentialStorage';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  const handleFileSelect = async (file: File) => {
    setFileError('');
    try {
      console.log('📁 Processing file:', file.name);
      let data: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        data = await parseCSV(file, true); // Assume Project44 format
      } else {
        data = await parseXLSX(file, true); // Assume Project44 format
      }
      
      setRfqData(data);
      console.log(`✅ Parsed ${data.length} RFQ rows`);
      
      // Reset results when new file is loaded
      setResults([]);
      setActiveTab('upload');
    } catch (error) {
      console.error('❌ Failed to parse file:', error);
      setFileError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleProcessRFQ = async () => {
    if (rfqData.length === 0) {
      alert('Please upload an RFQ file first');
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials.project44ApiKey) {
      alert('Please enter your Project44 API key first');
      setActiveTab('settings');
      return;
    }

    setIsProcessing(true);
    try {
      const quoteResults = await processRFQBatch(rfqData, credentials.project44ApiKey);
      setResults(quoteResults);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to process RFQ:', error);
      alert('Failed to process RFQ. Please check your API key and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const tabs = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'spot', label: 'Spot Quote', icon: Zap },
    { id: 'results', label: 'Results', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'pricing', label: 'Pricing', icon: Calculator },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FreightFlow Pro</h1>
                <p className="text-sm text-gray-500">LTL Quote Management System</p>
              </div>
            </div>
            <SupabaseStatus />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload RFQ File</h2>
              <FileUpload onFileSelect={handleFileSelect} error={fileError} />
              
              {rfqData.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      Loaded {rfqData.length} RFQ rows
                    </p>
                    <button
                      onClick={handleProcessRFQ}
                      disabled={isProcessing}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : 'Get Quotes'}
                    </button>
                  </div>
                  
                  {isProcessing && <ProcessingStatus />}
                </div>
              )}
            </div>

            <QuickActions 
              onProcessRFQ={handleProcessRFQ}
              hasData={rfqData.length > 0}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {activeTab === 'spot' && (
          <div className="bg-white rounded-lg shadow p-6">
            <SpotQuote />
          </div>
        )}

        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Quote Results</h2>
            {results.length > 0 ? (
              <ResultsTable results={results} />
            ) : (
              <p className="text-gray-500 text-center py-8">
                No results yet. Upload an RFQ file and process it to see quotes.
              </p>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow p-6">
            <Analytics results={results} />
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="bg-white rounded-lg shadow p-6">
            <PricingSettings />
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <CustomerSelection 
              selectedCustomer={selectedCustomer}
              onCustomerChange={setSelectedCustomer}
            />
          </div>
        )}

        {activeTab === 'database' && (
          <div className="bg-white rounded-lg shadow p-6">
            <DatabaseManager />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">API Settings</h2>
            <ApiKeyInput />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;