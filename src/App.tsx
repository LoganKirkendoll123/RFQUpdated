import React, { useState, useEffect } from 'react';
import { CarrierSelection } from './components/CarrierSelection';
import { PricingSettingsComponent } from './components/PricingSettings';
import { ProcessingStatus } from './components/ProcessingStatus';
import { ResultsTable } from './components/ResultsTable';
import { ApiKeyInput } from './components/ApiKeyInput';
import { FileUpload } from './components/FileUpload';
import { TemplateDownload } from './components/TemplateDownload';
import { DatabaseToolbox } from './components/DatabaseToolbox';
import { UnifiedRFQTool } from './components/UnifiedRFQTool';
import { parseCSV, parseXLSX } from './utils/fileParser';
import { Project44APIClient, FreshXAPIClient } from './utils/apiClient';
import { 
  RFQRow, 
  PricingSettings,
  ProcessingResult,
  QuoteWithPricing,
  Project44OAuthConfig,
} from './types';
import { 
  saveProject44Config, 
  loadProject44Config,
  saveFreshXApiKey,
  loadFreshXApiKey,
  saveSelectedCarriers,
  loadSelectedCarriers,
  savePricingSettings,
  loadPricingSettings
} from './utils/credentialStorage';
import { clearMarginCache } from './utils/pricingCalculator';
import { useRFQProcessor } from './hooks/useRFQProcessor';
import { useCarrierManagement } from './hooks/useCarrierManagement';
import { 
  Truck, 
  Upload, 
  Settings, 
  BarChart3, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Loader,
  RefreshCw,
  Users,
  Play,
  ArrowRight,
  Brain,
  Zap,
  Target,
  Shield,
  TrendingUp,
  Clock,
  DollarSign,
  Award,
  Star,
  Sparkles,
  Building2,
  Globe,
  Layers,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';

function App() {
  // Core state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  
  // API configuration
  const [project44Config, setProject44Config] = useState<Project44OAuthConfig>({
    oauthUrl: '/api/v4/oauth2/token',
    basicUser: '',
    basicPassword: '',
    clientId: '',
    clientSecret: '',
    ratingApiUrl: '/api/v4/ltl/quotes/rates/query'
  });
  const [freshxApiKey, setFreshxApiKey] = useState('');
  const [isProject44Valid, setIsProject44Valid] = useState(false);
  const [isFreshXValid, setIsFreshXValid] = useState(false);
  
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: false,
    fallbackMarkupPercentage: 23
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'upload' | 'results' | 'analytics' | 'database' | 'spot-quote' | 'mass-rfq' | 'unified'>('upload');
  const [fileError, setFileError] = useState<string>('');
  
  // API clients - store as instance variables to maintain token state
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [freshxClient, setFreshxClient] = useState<FreshXAPIClient | null>(null);

  // Use consolidated hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const rfqProcessor = useRFQProcessor({ 
    project44Client, 
    freshxClient 
  });
  
  // Load saved data on component mount
  useEffect(() => {
    console.log('🔄 Loading saved configuration from local storage...');
    
    // Load Project44 config
    const savedProject44Config = loadProject44Config();
    if (savedProject44Config) {
      console.log('✅ Loaded saved Project44 config');
      setProject44Config(savedProject44Config);
      // Create client instance with saved config
      const client = new Project44APIClient(savedProject44Config);
      setProject44Client(client);
      setIsProject44Valid(true);
    }
    
    // Load FreshX API key
    const savedFreshXKey = loadFreshXApiKey();
    if (savedFreshXKey) {
      console.log('✅ Loaded saved FreshX API key');
      setFreshxApiKey(savedFreshXKey);
      const client = new FreshXAPIClient(savedFreshXKey);
      setFreshxClient(client);
      setIsFreshXValid(true);
    }
    
    // Load selected carriers
    const savedCarriers = loadSelectedCarriers();
    if (savedCarriers) {
      console.log('✅ Loaded saved carrier selection');
      carrierManagement.setSelectedCarriers(savedCarriers);
    }
    
    // Load pricing settings
    const savedPricing = loadPricingSettings();
    if (savedPricing) {
      console.log('✅ Loaded saved pricing settings');
      setPricingSettings(savedPricing);
    }
  }, []);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    console.log('🔧 Project44 config updated, creating new client...');
    setProject44Config(config);
    saveProject44Config(config);
    
    // Create new client instance with updated config
    const client = new Project44APIClient(config);
    setProject44Client(client);
  };

  const handleProject44Validation = (isValid: boolean) => {
    console.log('🔍 Project44 validation result:', isValid);
    setIsProject44Valid(isValid);
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    console.log('🔧 FreshX API key updated, creating new client...');
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
    
    // Create new client instance with updated key
    const client = new FreshXAPIClient(apiKey);
    setFreshxClient(client);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    console.log('🔍 FreshX validation result:', isValid);
    setIsFreshXValid(isValid);
  };

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
      rfqProcessor.clearResults();
      setActiveTab('upload');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      console.error('❌ File parsing error:', error);
    }
  };

  const handlePricingSettingsChange = (settings: PricingSettings) => {
    setPricingSettings(settings);
    savePricingSettings(settings);
  };

  const handleCustomerChange = (customer: string) => {
    setSelectedCustomer(customer);
    // Clear margin cache when customer changes
    clearMarginCache();
    console.log(`👤 Customer changed to: ${customer || 'None'}`);
  };

  const exportResults = () => {
    if (rfqProcessor.results.length === 0) return;

    const exportData = rfqProcessor.results.flatMap(result => {
      const smartResult = result as any;
      
      return result.quotes.map(quote => {
        const quoteWithPricing = quote as QuoteWithPricing;
        const quoteWithMode = quote as any;
        
        return {
          'RFQ Number': result.rowIndex + 1,
          'Routing Decision': smartResult.quotingDecision?.replace('project44-', '').toUpperCase() || 'STANDARD',
          'Quote Type': quoteWithMode.quoteModeLabel || 'Standard LTL',
          'Routing Reason': smartResult.quotingReason || 'Standard LTL processing',
          'Origin ZIP': result.originalData.fromZip,
          'Destination ZIP': result.originalData.toZip,
          'Pallets': result.originalData.pallets,
          'Weight (lbs)': result.originalData.grossWeight,
          'Is Reefer': result.originalData.isReefer ? 'TRUE' : 'FALSE',
          'Temperature': result.originalData.temperature || 'AMBIENT',
          'Pickup Date': result.originalData.fromDate,
          'Carrier Name': quote.carrier.name,
          'Carrier SCAC': quote.carrier.scac || '',
          'Carrier MC': quote.carrier.mcNumber || '',
          'Service Level': quote.serviceLevel?.description || quote.serviceLevel?.code || '',
          'Transit Days': quote.transitDays || '',
          'Carrier Rate': quoteWithPricing.carrierTotalRate || 0,
          'Customer Price': quoteWithPricing.customerPrice || 0,
          'Profit Margin': quoteWithPricing.profit || 0,
          'Profit %': quoteWithPricing.carrierTotalRate > 0 ? 
            ((quoteWithPricing.profit / quoteWithPricing.carrierTotalRate) * 100).toFixed(1) + '%' : '0%',
          'Processing Status': result.status.toUpperCase(),
          'Error Message': result.error || ''
        };
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Smart Quoting Results');
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 12 }, // RFQ Number
      { wch: 15 }, // Routing Decision
      { wch: 15 }, // Quote Type
      { wch: 40 }, // Routing Reason
      { wch: 12 }, // Origin ZIP
      { wch: 12 }, // Destination ZIP
      { wch: 10 }, // Pallets
      { wch: 12 }, // Weight
      { wch: 10 }, // Is Reefer
      { wch: 12 }, // Temperature
      { wch: 12 }, // Pickup Date
      { wch: 25 }, // Carrier Name
      { wch: 12 }, // Carrier SCAC
      { wch: 12 }, // Carrier MC
      { wch: 20 }, // Service Level
      { wch: 12 }, // Transit Days
      { wch: 15 }, // Carrier Rate
      { wch: 15 }, // Customer Price
      { wch: 15 }, // Profit Margin
      { wch: 10 }, // Profit %
      { wch: 15 }, // Processing Status
      { wch: 30 }  // Error Message
    ];
    
    ws['!cols'] = colWidths;
    
    const fileName = `freight-quotes-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportAnalytics = () => {
    console.log('📊 Analytics export functionality removed');
  };

  const processRFQs = async () => {
    if (rfqData.length === 0) return;
    
    setActiveTab('results');
    await rfqProcessor.processMultipleRFQs(rfqData, {
      selectedCarriers: carrierManagement.selectedCarriers,
      pricingSettings,
      selectedCustomer
    });
  };

  const getSuccessfulResults = () => results.filter(r => r.status === 'success');
  const getErrorResults = () => results.filter(r => r.status === 'error');

  // Determine current workflow step
  const getCurrentWorkflowStep = () => {
    if (!isProject44Valid) return 1; // Step 1: Enter API Info
    if (!carrierManagement.carriersLoaded) return 2; // Step 2: Load and Select Carriers
    if (rfqData.length === 0) return 3; // Step 3: Upload Shipment File
    if (Object.values(carrierManagement.selectedCarriers).every(v => !v)) return 2; // Back to Step 2: Select Carriers
    if (rfqProcessor.results.length === 0) return 4; // Step 4: Run RFQs
    if (rfqProcessor.processingStatus.isProcessing) return 5; // Step 5: Processing
    if (activeTab === 'results') return 6; // Step 6: Display Results
    return 7; // Step 7: Display Analysis
  };

  const currentWorkflowStep = getCurrentWorkflowStep();

  // For backward compatibility
  const results = rfqProcessor.results;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Professional Header */}
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
              {/* Enterprise Badge */}
              <div className="flex items-center space-x-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-2 border border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Enterprise Edition</span>
                </div>
                <div className="h-4 w-px bg-emerald-300"></div>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-amber-500 fill-current" />
                  <span className="text-xs font-medium text-slate-600">Automated</span>
                </div>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-4 bg-slate-50 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isProject44Valid ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-slate-300'}`} />
                  <span className="text-sm font-medium text-slate-700">Project44</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isFreshXValid ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-slate-300'}`} />
                  <span className="text-sm font-medium text-slate-700">FreshX</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Smart Quoting Hero Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Automated Freight Quoting Engine</h2>
                <p className="text-blue-100 mt-1">
                  Automatically quotes shipments across optimal networks: <strong>FreshX</strong> for reefer, 
                  <strong>Project44</strong> for LTL/VLTL based on intelligent classification
                </p>
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-6 text-white">
              <div className="text-center">
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm text-blue-100">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">50+</div>
                <div className="text-sm text-blue-100">Carriers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm text-blue-100">Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Workflow Progress */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Workflow Progress</h2>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Clock className="h-4 w-4" />
              <span>Step {currentWorkflowStep} of 7</span>
            </div>
          </div>
          <div className="relative">
            <div className="flex items-center justify-between">
              {[
                { step: 1, label: 'API Setup', icon: Settings, color: 'blue' },
                { step: 2, label: 'Carrier Network', icon: Users, color: 'indigo' },
                { step: 3, label: 'Data Upload', icon: Upload, color: 'purple' },
                { step: 4, label: 'Smart Processing', icon: Brain, color: 'pink' },
                { step: 5, label: 'Auto Quoting', icon: Zap, color: 'orange' },
                { step: 6, label: 'Results', icon: Target, color: 'emerald' },
                { step: 7, label: 'Analytics', icon: BarChart3, color: 'teal' }
              ].map((item, index) => {
                const Icon = item.icon;
                const isCompleted = currentWorkflowStep > item.step;
                const isCurrent = currentWorkflowStep === item.step;
                
                return (
                  <React.Fragment key={item.step}>
                    <div className={`flex flex-col items-center space-y-2 ${
                      isCompleted ? 'opacity-100' :
                      isCurrent ? 'opacity-100' :
                      'opacity-40'
                    }`}>
                      <div className={`relative flex items-center justify-center w-12 h-12 rounded-xl shadow-lg transition-all duration-300 ${
                        isCompleted ? `bg-emerald-500 text-white` :
                        isCurrent ? `bg-${item.color}-500 text-white shadow-${item.color}-500/50` :
                        'bg-slate-200 text-slate-500'
                      }`}>
                        <Icon className="h-6 w-6" />
                        {isCompleted && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium text-center ${
                        isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-500'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                    {index < 6 && (
                      <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Professional Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-slate-100 rounded-xl p-1">
            {[
              { id: 'upload', label: 'Setup & Processing', icon: Upload, badge: rfqData.length },
              { id: 'results', label: 'Smart Quotes', icon: Target, badge: results.length },
              { id: 'database', label: 'Database Toolbox', icon: Database },
              { id: 'unified', label: 'Unified RFQ Tool', icon: Zap }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-3 py-3 px-6 rounded-lg font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-lg shadow-slate-200/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      activeTab === tab.id 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* STEP 1: API Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      currentWorkflowStep > 1 ? 'bg-emerald-500 text-white' : 
                      currentWorkflowStep === 1 ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      1
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Project44 Integration</h3>
                      <p className="text-sm text-slate-600">Enterprise LTL & Volume LTL Network</p>
                    </div>
                    {isProject44Valid && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                  </div>
                </div>
                <div className="p-6">
                  <ApiKeyInput
                    value={project44Config.clientId}
                    onChange={(clientId) => {
                      const newConfig = { ...project44Config, clientId };
                      setProject44Config(newConfig);
                    }}
                    onValidation={handleProject44Validation}
                    onOAuthConfigChange={handleProject44ConfigChange}
                    isProject44={true}
                  />
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      isFreshXValid ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      1b
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">FreshX Integration</h3>
                      <p className="text-sm text-slate-600">Specialized Reefer Network (Optional)</p>
                    </div>
                    {isFreshXValid && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                  </div>
                </div>
                <div className="p-6">
                  <ApiKeyInput
                    value={freshxApiKey}
                    onChange={handleFreshXKeyChange}
                    onValidation={handleFreshXValidation}
                    placeholder="Enter your FreshX API key"
                  />
                </div>
              </div>
            </div>

            {/* Template Download */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold bg-purple-500 text-white">
                    📋
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Smart Quoting Template</h3>
                    <p className="text-sm text-slate-600">Download enterprise-grade Excel template with automated quoting controls</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <TemplateDownload isProject44={true} />
              </div>
            </div>

            {/* STEP 2: Load and Select Carriers */}
            {isProject44Valid && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      currentWorkflowStep > 2 ? 'bg-emerald-500 text-white' : 
                      currentWorkflowStep === 2 ? 'bg-indigo-500 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      2
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Carrier Network Management</h3>
                      <p className="text-sm text-slate-600">Configure your preferred carrier network for optimal quoting</p>
                    </div>
                    {carrierManagement.carriersLoaded && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                  </div>
                </div>
                
                <div className="p-6">
                  {!carrierManagement.carriersLoaded && !carrierManagement.isLoadingCarriers && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8">
                      <div className="text-center">
                        <div className="bg-blue-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <Users className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold mb-3 text-blue-900">
                          Initialize Carrier Network
                        </h3>
                        <p className="mb-6 text-blue-700 max-w-md mx-auto">
                          Connect to Project44's enterprise carrier network for LTL and Volume LTL services.
                        </p>
                        <button
                          onClick={carrierManagement.loadCarriers}
                          className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <Users className="h-5 w-5" />
                          <span>Load Enterprise Carriers</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {(carrierManagement.carriersLoaded || carrierManagement.isLoadingCarriers) && (
                    <CarrierSelection
                      carrierGroups={carrierManagement.carrierGroups}
                      selectedCarriers={carrierManagement.selectedCarriers}
                      onToggleCarrier={carrierManagement.handleCarrierToggle}
                      onSelectAll={carrierManagement.handleSelectAll}
                      onSelectAllInGroup={carrierManagement.handleSelectAllInGroup}
                      isLoading={carrierManagement.isLoadingCarriers}
                    />
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Upload Shipment File */}
            {isProject44Valid && carrierManagement.carriersLoaded && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      currentWorkflowStep > 3 ? 'bg-emerald-500 text-white' : 
                      currentWorkflowStep === 3 ? 'bg-purple-500 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      3
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Smart Data Processing</h3>
                      <p className="text-sm text-slate-600">Upload your shipment data for automated quoting analysis</p>
                    </div>
                    {rfqData.length > 0 && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                  </div>
                </div>
                <div className="p-6">
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    error={fileError}
                    isProcessing={rfqProcessor.processingStatus.isProcessing}
                  />
                  {rfqData.length > 0 && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center space-x-3 text-emerald-800">
                        <div className="bg-emerald-500 rounded-full p-2">
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">
                            {rfqData.length} shipment{rfqData.length !== 1 ? 's' : ''} ready for smart quoting
                          </div>
                          <div className="text-sm text-emerald-700 mt-1">
                            System will automatically classify each shipment: FreshX for reefer, Project44 for LTL/VLTL
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Settings */}
            {rfqData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <PricingSettingsComponent
                  settings={pricingSettings}
                  onSettingsChange={handlePricingSettingsChange}
                  selectedCustomer={selectedCustomer}
                  onCustomerChange={handleCustomerChange}
                />
              </div>
            )}

            {/* STEP 4: Run Smart RFQs Button */}
            {rfqData.length > 0 && Object.values(carrierManagement.selectedCarriers).some(v => v) && (
              <div className="text-center py-8">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      currentWorkflowStep > 4 ? 'bg-emerald-500 text-white' : 
                      currentWorkflowStep === 4 ? 'bg-pink-500 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      4
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">Execute Smart Quoting</h3>
                  </div>
                  <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                    Launch automated freight quoting across multiple networks for optimal pricing and service
                  </p>
                  <button
                    onClick={processRFQs}
                    disabled={rfqProcessor.processingStatus.isProcessing}
                    className={`inline-flex items-center space-x-4 px-12 py-6 font-bold rounded-2xl transition-all duration-200 text-xl shadow-2xl ${
                      rfqProcessor.processingStatus.isProcessing 
                        ? 'bg-slate-400 cursor-not-allowed text-white' 
                        : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white hover:shadow-3xl transform hover:scale-105'
                    }`}
                  >
                    {rfqProcessor.processingStatus.isProcessing ? (
                      <>
                        <Loader className="h-8 w-8 animate-spin" />
                        <span>Processing Smart Quotes...</span>
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-8 w-8" />
                        <span>Quote {rfqData.length} Shipment{rfqData.length !== 1 ? 's' : ''}</span>
                        <Sparkles className="h-6 w-6" />
                      </>
                    )}
                  </button>
                  <p className="mt-4 text-sm text-slate-500">
                    Automated quoting • Real-time pricing • Enterprise-grade security
                  </p>
                </div>
              </div>
            )}

            {/* API Connection Warning */}
            {!isProject44Valid && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8">
                <div className="flex items-start space-x-4">
                  <div className="bg-amber-500 rounded-full p-3">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-amber-800">
                    <h3 className="font-semibold text-lg mb-2">Enterprise Integration Required</h3>
                    <p className="text-sm leading-relaxed">
                      Connect your Project44 enterprise account to access the full carrier network. 
                      You'll need your OAuth credentials from the Project44 developer portal to get started.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {activeTab === 'results' && (
          <div className="space-y-8">
            {/* STEP 5: Processing Status */}
            {(rfqProcessor.processingStatus.isProcessing || results.length > 0) && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-pink-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      !rfqProcessor.processingStatus.isProcessing && results.length > 0 ? 'bg-emerald-500 text-white' : 
                      rfqProcessor.processingStatus.isProcessing ? 'bg-orange-500 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      5
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Automated Quoting Engine</h3>
                      <p className="text-sm text-slate-600">Real-time smart quoting and competitive analysis</p>
                    </div>
                    {!rfqProcessor.processingStatus.isProcessing && results.length > 0 && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                  </div>
                </div>
                <div className="p-6">
                  <ProcessingStatus
                    total={rfqProcessor.processingStatus.totalSteps}
                    completed={rfqProcessor.processingStatus.currentStep}
                    success={getSuccessfulResults().length}
                    errors={getErrorResults().length}
                    isProcessing={rfqProcessor.processingStatus.isProcessing}
                    currentCarrier={rfqProcessor.processingStatus.currentItem}
                    carrierProgress={undefined}
                  />
                </div>
              </div>
            )}

            {/* STEP 6: Results Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                    results.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'
                  }`}>
                    6
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Smart Quoting Results</h3>
                    <p className="text-sm text-slate-600">Competitive pricing analysis across all networks</p>
                  </div>
                  {results.length > 0 && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                </div>
              </div>
              <div className="p-6">
                <ResultsTable
                  results={results}
                  onExport={exportResults}
                  onPriceUpdate={(resultIndex, quoteId, newPrice) => rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, { pricingSettings, selectedCustomer })}
                />
              </div>
            </div>
          </div>
        )}


        {activeTab === 'database' && (
          <DatabaseToolbox />
        )}

        {activeTab === 'unified' && (
          <UnifiedRFQTool
            project44Client={project44Client}
            freshxClient={freshxClient}
            initialPricingSettings={pricingSettings}
            initialSelectedCustomer={selectedCustomer}
          />
        )}
      </main>
    </div>
  );
}

export default App;