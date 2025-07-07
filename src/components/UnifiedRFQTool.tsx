import React, { useState, useEffect } from 'react';
import { FileUpload } from './FileUpload';
import { TemplateDownload } from './TemplateDownload';
import { ApiKeyInput } from './ApiKeyInput';
import { CarrierSelection } from './CarrierSelection';
import { PricingSettingsComponent } from './PricingSettings';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { parseCSV, parseXLSX } from '../utils/fileParser';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { saveRFQBatch, calculateBatchSummary } from '../utils/rfqBatchManager';
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
  Building2,
  Globe,
  Layers,
  Database,
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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

  // Use consolidated hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const rfqProcessor = useRFQProcessor({ 
    project44Client, 
    freshxClient 
  });
  const { 
    pricingSettings, 
    selectedCustomer, 
    updatePricingSettings, 
    updateSelectedCustomer 
  } = usePricingSettings(initialPricingSettings);

  // Load saved data on component mount
  useEffect(() => {
    console.log('🔄 Loading saved configuration from local storage...');
    
    // Load Project44 config
    const savedProject44Config = loadProject44Config();
    if (savedProject44Config) {
      console.log('✅ Loaded saved Project44 config');
      setProject44Config(savedProject44Config);
      setIsProject44Valid(true);
    }
    
    // Load FreshX API key
    const savedFreshXKey = loadFreshXApiKey();
    if (savedFreshXKey) {
      console.log('✅ Loaded saved FreshX API key');
      setFreshxApiKey(savedFreshXKey);
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
      updatePricingSettings(savedPricing);
    }

    // Set initial customer
    if (initialSelectedCustomer) {
      updateSelectedCustomer(initialSelectedCustomer);
    }
  }, []);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    console.log('🔧 Project44 config updated');
    setProject44Config(config);
    saveProject44Config(config);
  };

  const handleProject44Validation = (isValid: boolean) => {
    console.log('🔍 Project44 validation result:', isValid);
    setIsProject44Valid(isValid);
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    console.log('🔧 FreshX API key updated');
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
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
        data = await parseCSV(file, true);
      } else {
        data = await parseXLSX(file, true);
      }
      
      setRfqData(data);
      console.log(`✅ Parsed ${data.length} RFQ rows`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      console.error('❌ File parsing error:', error);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    carrierManagement.handleCarrierToggle(carrierId, selected);
    // Save to localStorage whenever carriers change
    const newSelection = { ...carrierManagement.selectedCarriers, [carrierId]: selected };
    saveSelectedCarriers(newSelection);
  };

  const handleSelectAll = (selected: boolean) => {
    carrierManagement.handleSelectAll(selected);
    saveSelectedCarriers(carrierManagement.selectedCarriers);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    carrierManagement.handleSelectAllInGroup(groupCode, selected);
    saveSelectedCarriers(carrierManagement.selectedCarriers);
  };

  const handlePricingSettingsChange = (settings: PricingSettings) => {
    updatePricingSettings(settings);
    savePricingSettings(settings);
  };

  const handleCustomerChange = (customer: string) => {
    updateSelectedCustomer(customer);
  };

  // Auto-save RFQ batch to database
  const saveRFQBatchToDatabase = async (
    rfqData: RFQRow[],
    results: any[],
    processingSettings: {
      pricingSettings: PricingSettings;
      selectedCarriers: { [carrierId: string]: boolean };
      selectedCustomer: string;
    }
  ) => {
    try {
      setIsSaving(true);
      console.log('💾 Auto-saving RFQ batch to database...');

      // Generate batch name with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const batchName = `Auto-RFQ-${timestamp}`;

      // Calculate summary statistics
      const summary = calculateBatchSummary(results);

      // Prepare batch data
      const batchData = {
        batch_name: batchName,
        customer_name: processingSettings.selectedCustomer || null,
        shipment_count: rfqData.length,
        total_quotes_received: summary.total_quotes_received,
        best_total_price: summary.best_total_price,
        total_profit: summary.total_profit,
        pricing_settings: processingSettings.pricingSettings,
        selected_carriers: processingSettings.selectedCarriers,
        rfq_data: rfqData,
        results_data: results,
        created_by: 'auto-save'
      };

      // Save to database
      const savedBatch = await saveRFQBatch(batchData);
      console.log('✅ RFQ batch auto-saved to database:', savedBatch.id);

      return savedBatch;
    } catch (error) {
      console.error('❌ Failed to auto-save RFQ batch:', error);
      // Don't throw error - auto-save failure shouldn't break the main flow
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessRFQs = async () => {
    if (rfqData.length === 0) {
      setFileError('Please upload RFQ data first');
      return;
    }

    const selectedCarrierIds = carrierManagement.getSelectedCarrierIds();
    if (selectedCarrierIds.length === 0) {
      setFileError('Please select at least one carrier');
      return;
    }

    setIsProcessing(true);
    setFileError('');

    try {
      console.log('🚀 Starting RFQ processing...');
      
      const processingOptions = {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings,
        selectedCustomer
      };

      const results = await rfqProcessor.processMultipleRFQs(rfqData, processingOptions);
      
      console.log('✅ RFQ processing completed');

      // Auto-save to database after successful processing
      await saveRFQBatchToDatabase(rfqData, results, processingOptions);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setFileError(errorMessage);
      console.error('❌ RFQ processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, {
      pricingSettings,
      selectedCustomer
    });
  };

  const handleExportResults = () => {
    if (rfqProcessor.results.length === 0) {
      console.log('⚠️ No results to export');
      return;
    }

    console.log('📊 Exporting results to Excel...');
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export
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
        'Temperature': result.originalData.temperature || 'N/A',
        'Quotes Received': result.quotes.length,
        'Best Price': bestQuote ? `$${(bestQuote as any).customerPrice.toFixed(2)}` : 'N/A',
        'Best Carrier': bestQuote ? bestQuote.carrier.name : 'N/A',
        'Profit': bestQuote ? `$${(bestQuote as any).profit.toFixed(2)}` : 'N/A',
        'Error': result.error || ''
      };
    });
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RFQ Results');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `rfq-results-${timestamp}.xlsx`;
    
    // Download file
    XLSX.writeFile(workbook, filename);
    console.log('✅ Results exported to:', filename);
  };

  const canProcess = rfqData.length > 0 && 
                    carrierManagement.getSelectedCarrierCount() > 0 && 
                    (isProject44Valid || isFreshXValid) &&
                    !isProcessing;

  return (
    <div className="space-y-8">
      {/* API Configuration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project44 Configuration */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Project44 Integration</h3>
                <p className="text-sm text-gray-600">LTL & Volume LTL Network Access</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ApiKeyInput
              value={project44Config.clientId}
              onChange={(clientId) => handleProject44ConfigChange({ ...project44Config, clientId })}
              onValidation={handleProject44Validation}
              isProject44={true}
              onOAuthConfigChange={handleProject44ConfigChange}
            />
          </div>
        </div>

        {/* FreshX Configuration */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">FreshX Integration</h3>
                <p className="text-sm text-gray-600">Reefer & Temperature-Controlled Network</p>
              </div>
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
      <TemplateDownload isProject44={true} />

      {/* File Upload Section */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upload RFQ Data</h3>
              <p className="text-sm text-gray-600">
                {rfqData.length > 0 
                  ? `${rfqData.length} RFQ${rfqData.length !== 1 ? 's' : ''} loaded and ready for processing`
                  : 'Upload your Excel or CSV file with RFQ data'
                }
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <FileUpload
            onFileSelect={handleFileSelect}
            error={fileError}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {/* Configuration Sections - Only show if we have data */}
      {rfqData.length > 0 && (
        <>
          {/* Carrier Selection */}
          <CarrierSelection
            carrierGroups={carrierManagement.carrierGroups}
            selectedCarriers={carrierManagement.selectedCarriers}
            onToggleCarrier={handleCarrierToggle}
            onSelectAll={handleSelectAll}
            onSelectAllInGroup={handleSelectAllInGroup}
            isLoading={carrierManagement.isLoadingCarriers}
          />

          {/* Pricing Settings */}
          <PricingSettingsComponent
            settings={pricingSettings}
            onSettingsChange={handlePricingSettingsChange}
            selectedCustomer={selectedCustomer}
            onCustomerChange={handleCustomerChange}
            showAsCard={true}
          />

          {/* Process Button */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-600 p-2 rounded-lg">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Process RFQs</h3>
                    <p className="text-sm text-gray-600">
                      Ready to process {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''} with {carrierManagement.getSelectedCarrierCount()} selected carrier{carrierManagement.getSelectedCarrierCount() !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                {isSaving && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Database className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Auto-saving...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6">
              <button
                onClick={handleProcessRFQs}
                disabled={!canProcess}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-3 ${
                  canProcess
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader className="h-6 w-6 animate-spin" />
                    <span>Processing RFQs...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-6 w-6" />
                    <span>Process {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''}</span>
                    <ArrowRight className="h-6 w-6" />
                  </>
                )}
              </button>
              
              {!canProcess && !isProcessing && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-2">Requirements to process RFQs:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {rfqData.length === 0 && <li>Upload RFQ data file</li>}
                        {carrierManagement.getSelectedCarrierCount() === 0 && <li>Select at least one carrier</li>}
                        {!isProject44Valid && !isFreshXValid && <li>Configure at least one API (Project44 or FreshX)</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Processing Status */}
      {(isProcessing || rfqProcessor.results.length > 0) && (
        <ProcessingStatus
          total={rfqData.length}
          completed={rfqProcessor.processingStatus.currentStep}
          success={rfqProcessor.results.filter(r => r.status === 'success').length}
          errors={rfqProcessor.results.filter(r => r.status === 'error').length}
          isProcessing={isProcessing}
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

      {/* Auto-save Status */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Save className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Auto-saving to database...</span>
        </div>
      )}
    </div>
  );
};