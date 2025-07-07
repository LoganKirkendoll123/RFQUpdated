import React, { useState, useEffect } from 'react';
import { 
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
  Save,
  History,
  Building2,
  Globe,
  Layers
} from 'lucide-react';

import { ApiKeyInput } from './ApiKeyInput';
import { CarrierSelection } from './CarrierSelection';
import { PricingSettingsComponent } from './PricingSettings';
import { FileUpload } from './FileUpload';
import { TemplateDownload } from './TemplateDownload';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';

import { parseCSV, parseXLSX } from '../utils/fileParser';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { 
  RFQRow, 
  PricingSettings,
  Project44OAuthConfig,
} from '../types';
import { 
  saveProject44Config, 
  loadProject44Config,
  saveFreshXApiKey,
  loadFreshXApiKey,
  saveSelectedCarriers,
  loadSelectedCarriers,
  savePricingSettings,
  loadPricingSettings
} from '../utils/credentialStorage';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { usePricingSettings } from '../hooks/usePricingSettings';
import * as XLSX from 'xlsx';
import { saveRFQBatch, updateRFQBatchResults, calculateBatchSummary } from '../utils/rfqBatchManager';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
}

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // Core state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'file' | 'manual' | 'historical' | 'negotiation'>('file');
  
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
  
  // API clients
  const [localProject44Client, setLocalProject44Client] = useState<Project44APIClient | null>(project44Client);
  const [localFreshxClient, setLocalFreshxClient] = useState<FreshXAPIClient | null>(freshxClient);

  // Use consolidated hooks
  const carrierManagement = useCarrierManagement({ project44Client: localProject44Client });
  const rfqProcessor = useRFQProcessor({ 
    project44Client: localProject44Client, 
    freshxClient: localFreshxClient 
  });
  const pricingHook = usePricingSettings(initialPricingSettings);

  // Batch management state
  const [batchName, setBatchName] = useState('');
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved data on component mount
  useEffect(() => {
    console.log('🔄 Loading saved configuration from local storage...');
    
    // Load Project44 config
    const savedProject44Config = loadProject44Config();
    if (savedProject44Config) {
      console.log('✅ Loaded saved Project44 config');
      setProject44Config(savedProject44Config);
      const client = new Project44APIClient(savedProject44Config);
      setLocalProject44Client(client);
      setIsProject44Valid(true);
    }
    
    // Load FreshX API key
    const savedFreshXKey = loadFreshXApiKey();
    if (savedFreshXKey) {
      console.log('✅ Loaded saved FreshX API key');
      setFreshxApiKey(savedFreshXKey);
      const client = new FreshXAPIClient(savedFreshXKey);
      setLocalFreshxClient(client);
      setIsFreshXValid(true);
    }
    
    // Load selected carriers
    const savedCarriers = loadSelectedCarriers();
    if (savedCarriers) {
      console.log('✅ Loaded saved carrier selection');
      carrierManagement.setSelectedCarriers(savedCarriers);
    }
  }, []);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    console.log('🔧 Project44 config updated, creating new client...');
    setProject44Config(config);
    saveProject44Config(config);
    
    const client = new Project44APIClient(config);
    setLocalProject44Client(client);
  };

  const handleProject44Validation = (isValid: boolean) => {
    console.log('🔍 Project44 validation result:', isValid);
    setIsProject44Valid(isValid);
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    console.log('🔧 FreshX API key updated, creating new client...');
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
    
    const client = new FreshXAPIClient(apiKey);
    setLocalFreshxClient(client);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    console.log('🔍 FreshX validation result:', isValid);
    setIsFreshXValid(isValid);
  };

  const handleFileSelect = async (file: File) => {
    setFileError('');
    try {
      console.log('📁 Processing file:', file.name);
      
      let parsedData: RFQRow[];
      if (file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file, true);
      } else {
        parsedData = await parseXLSX(file, true);
      }
      
      console.log(`✅ Parsed ${parsedData.length} RFQ rows`);
      setRfqData(parsedData);
      
      // Generate batch name from file
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setBatchName(`${file.name.replace(/\.[^/.]+$/, "")} - ${timestamp}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      console.error('❌ File parsing error:', errorMessage);
      setFileError(errorMessage);
    }
  };

  const handleProcessRFQs = async () => {
    if (rfqData.length === 0) {
      setFileError('No RFQ data to process');
      return;
    }

    if (!localProject44Client && !localFreshxClient) {
      setFileError('Please configure at least one API client (Project44 or FreshX)');
      return;
    }

    try {
      console.log('🚀 Starting RFQ processing...');
      
      // Save batch before processing
      const batch = await saveBatch();
      if (!batch) {
        setFileError('Failed to save batch - processing cancelled');
        return;
      }

      const selectedCarrierIds = carrierManagement.getSelectedCarrierIds();
      
      const results = await rfqProcessor.processMultipleRFQs(rfqData, {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings: pricingHook.pricingSettings,
        selectedCustomer: pricingHook.selectedCustomer
      });

      console.log(`✅ Processing completed: ${results.length} results`);

      // Update batch with results
      if (batch.id) {
        const summary = calculateBatchSummary(results);
        await updateRFQBatchResults(batch.id, results, summary);
        console.log('✅ Batch updated with results');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error('❌ RFQ processing error:', errorMessage);
      setFileError(errorMessage);
    }
  };

  const saveBatch = async () => {
    if (!batchName.trim()) {
      setFileError('Please enter a batch name');
      return null;
    }

    if (rfqData.length === 0) {
      setFileError('No RFQ data to save');
      return null;
    }

    setIsSaving(true);
    try {
      console.log('💾 Saving RFQ batch:', batchName);

      const batch = await saveRFQBatch({
        batch_name: batchName.trim(),
        customer_name: pricingHook.selectedCustomer || undefined,
        shipment_count: rfqData.length,
        total_quotes_received: 0,
        pricing_settings: pricingHook.pricingSettings,
        selected_carriers: carrierManagement.selectedCarriers,
        rfq_data: rfqData,
        created_by: 'unified-tool'
      });

      setCurrentBatchId(batch.id || null);
      console.log('✅ Batch saved successfully:', batch.id);
      return batch;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save batch';
      console.error('❌ Batch save error:', errorMessage);
      setFileError(errorMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportResults = () => {
    if (rfqProcessor.results.length === 0) {
      setFileError('No results to export');
      return;
    }

    try {
      console.log('📊 Exporting results to Excel...');
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Prepare results data for export
      const exportData = rfqProcessor.results.map((result, index) => {
        const bestQuote = result.quotes.length > 0 
          ? result.quotes.reduce((best, current) => 
              (current as any).customerPrice < (best as any).customerPrice ? current : best
            )
          : null;

        return {
          'RFQ #': index + 1,
          'Status': result.status,
          'Origin ZIP': result.originalData.fromZip,
          'Destination ZIP': result.originalData.toZip,
          'Pallets': result.originalData.pallets,
          'Weight (lbs)': result.originalData.grossWeight,
          'Pickup Date': result.originalData.fromDate,
          'Is Reefer': result.originalData.isReefer ? 'Yes' : 'No',
          'Quotes Received': result.quotes.length,
          'Best Price': bestQuote ? `$${(bestQuote as any).customerPrice?.toFixed(2) || '0.00'}` : 'N/A',
          'Best Carrier': bestQuote?.carrier.name || 'N/A',
          'Profit': bestQuote ? `$${(bestQuote as any).profit?.toFixed(2) || '0.00'}` : 'N/A',
          'Error': result.error || ''
        };
      });
      
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RFQ Results');
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
      const filename = `rfq_results_${timestamp}.xlsx`;
      
      // Download file
      XLSX.writeFile(workbook, filename);
      console.log('✅ Results exported successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      console.error('❌ Export error:', errorMessage);
      setFileError(errorMessage);
    }
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, {
      pricingSettings: pricingHook.pricingSettings,
      selectedCustomer: pricingHook.selectedCustomer
    });
  };

  const renderModeContent = () => {
    switch (activeMode) {
      case 'file':
        return (
          <div className="space-y-6">
            {/* File Upload Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">File Upload & Processing</h3>
                  <p className="text-sm text-gray-600">Upload Excel or CSV files with RFQ data for automated processing</p>
                </div>
              </div>

              <div className="space-y-4">
                <FileUpload 
                  onFileSelect={handleFileSelect}
                  error={fileError}
                  isProcessing={rfqProcessor.processingStatus.isProcessing}
                />

                {rfqData.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''} loaded and ready for processing
                      </span>
                    </div>
                  </div>
                )}

                {/* Batch Name Input */}
                {rfqData.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Batch Name
                    </label>
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Enter a name for this batch..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Process Button */}
                {rfqData.length > 0 && (
                  <div className="flex space-x-4">
                    <button
                      onClick={handleProcessRFQs}
                      disabled={rfqProcessor.processingStatus.isProcessing || !batchName.trim()}
                      className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {rfqProcessor.processingStatus.isProcessing ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5" />
                          <span>Process RFQs</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={saveBatch}
                      disabled={isSaving || !batchName.trim() || rfqData.length === 0}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          <span>Save Batch</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Template Download */}
            <TemplateDownload isProject44={true} />
          </div>
        );

      case 'manual':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-purple-600 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manual RFQ Entry</h3>
                <p className="text-sm text-gray-600">Enter individual RFQ details manually for quick quotes</p>
              </div>
            </div>
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Manual RFQ entry form coming soon...</p>
            </div>
          </div>
        );

      case 'historical':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-orange-600 p-2 rounded-lg">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Historical Data Analysis</h3>
                <p className="text-sm text-gray-600">Analyze historical shipment data to identify cost-saving opportunities</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* File Upload for Historical Data */}
              <div className="space-y-4">
                <FileUpload 
                  onFileSelect={handleFileSelect}
                  error={fileError}
                  isProcessing={rfqProcessor.processingStatus.isProcessing}
                />

                {rfqData.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-orange-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {rfqData.length} historical shipment{rfqData.length !== 1 ? 's' : ''} loaded for analysis
                      </span>
                    </div>
                  </div>
                )}

                {/* Batch Name Input for Historical */}
                {rfqData.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Analysis Batch Name
                    </label>
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Enter a name for this historical analysis..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Process Historical Data Button */}
                {rfqData.length > 0 && (
                  <div className="flex space-x-4">
                    <button
                      onClick={handleProcessRFQs}
                      disabled={rfqProcessor.processingStatus.isProcessing || !batchName.trim()}
                      className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {rfqProcessor.processingStatus.isProcessing ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <BarChart3 className="h-5 w-5" />
                          <span>Analyze Historical Data</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={saveBatch}
                      disabled={isSaving || !batchName.trim() || rfqData.length === 0}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          <span>Save Analysis</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <BarChart3 className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-2">Historical Analysis Features:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Compare historical rates with current market pricing</li>
                      <li>Identify cost-saving opportunities across carriers</li>
                      <li>Analyze shipping patterns and optimize routes</li>
                      <li>Generate savings reports and recommendations</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'negotiation':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-green-600 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Negotiation Impact Analyzer</h3>
                <p className="text-sm text-gray-600">Analyze potential savings from carrier negotiations and contract changes</p>
              </div>
            </div>
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Negotiation impact analysis tools coming soon...</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Mode Selection */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Unified Multi-Mode RFQ Tool</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose your processing mode: File upload, manual entry, historical analysis, or negotiation impact
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => setActiveMode('file')}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all duration-200 ${
                activeMode === 'file'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Upload className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">File Upload</div>
                <div className="text-xs text-gray-500">Bulk RFQ processing</div>
              </div>
            </button>

            <button
              onClick={() => setActiveMode('manual')}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all duration-200 ${
                activeMode === 'manual'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FileText className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Manual Entry</div>
                <div className="text-xs text-gray-500">Single RFQ quotes</div>
              </div>
            </button>

            <button
              onClick={() => setActiveMode('historical')}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all duration-200 ${
                activeMode === 'historical'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <History className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Historical Analysis</div>
                <div className="text-xs text-gray-500">Cost optimization</div>
              </div>
            </button>

            <button
              onClick={() => setActiveMode('negotiation')}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all duration-200 ${
                activeMode === 'negotiation'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <TrendingUp className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Negotiation Impact</div>
                <div className="text-xs text-gray-500">Savings analysis</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <ApiKeyInput
            value={project44Config.clientId}
            onChange={(clientId) => handleProject44ConfigChange({ ...project44Config, clientId })}
            onValidation={handleProject44Validation}
            isProject44={true}
            onOAuthConfigChange={handleProject44ConfigChange}
          />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <ApiKeyInput
            value={freshxApiKey}
            onChange={handleFreshXKeyChange}
            onValidation={handleFreshXValidation}
            placeholder="Enter your FreshX API key"
          />
        </div>
      </div>

      {/* Carrier Selection */}
      {isProject44Valid && (
        <CarrierSelection
          carrierGroups={carrierManagement.carrierGroups}
          selectedCarriers={carrierManagement.selectedCarriers}
          onToggleCarrier={carrierManagement.handleCarrierToggle}
          onSelectAll={carrierManagement.handleSelectAll}
          onSelectAllInGroup={carrierManagement.handleSelectAllInGroup}
          isLoading={carrierManagement.isLoadingCarriers}
        />
      )}

      {/* Pricing Settings */}
      <PricingSettingsComponent
        settings={pricingHook.pricingSettings}
        onSettingsChange={pricingHook.updatePricingSettings}
        selectedCustomer={pricingHook.selectedCustomer}
        onCustomerChange={pricingHook.updateSelectedCustomer}
        showAsCard={true}
      />

      {/* Mode-specific Content */}
      {renderModeContent()}

      {/* Processing Status */}
      {rfqProcessor.processingStatus.isProcessing && (
        <ProcessingStatus
          total={rfqProcessor.processingStatus.totalSteps}
          completed={rfqProcessor.processingStatus.currentStep}
          success={rfqProcessor.results.filter(r => r.status === 'success').length}
          errors={rfqProcessor.results.filter(r => r.status === 'error').length}
          isProcessing={rfqProcessor.processingStatus.isProcessing}
          currentCarrier={rfqProcessor.processingStatus.currentItem}
        />
      )}

      {/* Results */}
      {rfqProcessor.results.length > 0 && (
        <ResultsTable
          results={rfqProcessor.results}
          onExport={handleExportResults}
          onPriceUpdate={handlePriceUpdate}
        />
      )}
    </div>
  );
};

export default UnifiedRFQTool;