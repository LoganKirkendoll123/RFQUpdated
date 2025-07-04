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
import { RFQRow, QuoteResult, PricingSettings as PricingSettingsType } from './types';
import { parseCSV, parseXLSX } from './utils/fileParser';
import { processRFQBatch } from './utils/apiClient';
import { getStoredCredentials } from './utils/credentialStorage';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [processingCompleted, setProcessingCompleted] = useState(0);
  const [processingSuccess, setProcessingSuccess] = useState(0);
  const [processingErrors, setProcessingErrors] = useState(0);
  const [currentProcessingStatus, setCurrentProcessingStatus] = useState('');
  const [fileError, setFileError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [pricingSettings, setPricingSettings] = useState<PricingSettingsType>({
    usesCustomerMargins: false,
    defaultMargin: 15,
    minimumMargin: 5,
    maximumMargin: 50,
    accessorialMarkup: 10,
    fuelSurchargeMarkup: 5,
    carrierSpecificMarkups: {},
    customerSpecificMarkups: {},
    laneSpecificMarkups: {},
    weightBreakMarkups: {},
    serviceTypeMarkups: {},
    seasonalAdjustments: {},
    competitorPricing: {},
    autoApprovalThreshold: 1000,
    requiresApprovalAbove: 5000,
    discountLimits: {
      maxDiscount: 20,
      requiresApproval: 10
    }
  });
  const [project44Client, setProject44Client] = useState<any>(null);
  const [freshxClient, setFreshxClient] = useState<any>(null);

  // Load initial state from localStorage
  useEffect(() => {
    const savedPricingSettings = localStorage.getItem('pricingSettings');
    if (savedPricingSettings) {
      try {
        setPricingSettings(JSON.parse(savedPricingSettings));
      } catch (error) {
        console.error('Failed to parse saved pricing settings:', error);
      }
    }

    const savedSelectedCustomer = localStorage.getItem('selectedCustomer');
    if (savedSelectedCustomer) {
      setSelectedCustomer(savedSelectedCustomer);
    }

    const savedSelectedCarriers = localStorage.getItem('selectedCarriers');
    if (savedSelectedCarriers) {
      try {
        setSelectedCarriers(JSON.parse(savedSelectedCarriers));
      } catch (error) {
        console.error('Failed to parse saved selected carriers:', error);
      }
    }
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('pricingSettings', JSON.stringify(pricingSettings));
  }, [pricingSettings]);

  useEffect(() => {
    localStorage.setItem('selectedCustomer', selectedCustomer);
  }, [selectedCustomer]);

  useEffect(() => {
    localStorage.setItem('selectedCarriers', JSON.stringify(selectedCarriers));
  }, [selectedCarriers]);

  // Initialize API clients based on stored credentials
  useEffect(() => {
    const credentials = getStoredCredentials();
    
    if (credentials.project44ApiKey) {
      // Initialize Project44 client (placeholder - would need actual implementation)
      setProject44Client({ apiKey: credentials.project44ApiKey });
    }
    
    if (credentials.freshxApiKey) {
      // Initialize FreshX client (placeholder - would need actual implementation)
      setFreshxClient({ apiKey: credentials.freshxApiKey });
    }
  }, []);

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
    setProcessingTotal(rfqData.length);
    setProcessingCompleted(0);
    setProcessingSuccess(0);
    setProcessingErrors(0);
    setCurrentProcessingStatus('Starting batch processing...');
    
    const processedQuotes: QuoteResult[] = [];
    
    try {
      const onProgress = (status: string) => {
        setCurrentProcessingStatus(status);
      };
      
      const onQuoteReceived = (rfqIndex: number, quotes: any[]) => {
        setProcessingCompleted(prev => prev + 1);
        
        if (quotes && quotes.length > 0) {
          setProcessingSuccess(prev => prev + 1);
          // Convert quotes to QuoteResult format
          const quoteResults = quotes.map(quote => ({
            rfqId: rfqData[rfqIndex].id || `rfq-${rfqIndex}`,
            carrierId: quote.carrierId || 'unknown',
            carrierName: quote.carrierName || 'Unknown Carrier',
            serviceType: quote.serviceType || 'Standard',
            totalCost: quote.totalCost || 0,
            transitTime: quote.transitTime || 'Unknown',
            quote: quote
          }));
          processedQuotes.push(...quoteResults);
        } else {
          setProcessingErrors(prev => prev + 1);
        }
      };
      
      await processRFQBatch(rfqData, 
        (progress: number, status: string) => {
          setCurrentProcessingStatus(status);
          setProcessingCompleted(Math.floor(progress * rfqData.length / 100));
        }, 
        onQuoteReceived
      );
      setResults(processedQuotes);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to process RFQ:', error);
      alert('Failed to process RFQ. Please check your API key and try again.');
    } finally {
      setIsProcessing(false);
      setCurrentProcessingStatus('');
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
          </div>
        )}

        {activeTab === 'spot' && (
          <div className="bg-white rounded-lg shadow p-6">
            <SpotQuote 
              selectedCustomer={selectedCustomer}
              selectedCarriers={selectedCarriers}
              onCustomerChange={setSelectedCustomer}
              onCarriersChange={setSelectedCarriers}
              pricingSettings={pricingSettings}
              onPricingSettingsChange={setPricingSettings}
              project44Client={project44Client}
              freshxClient={freshxClient}
            />
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
            <PricingSettings 
              settings={pricingSettings}
              onSettingsChange={setPricingSettings}
            />
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