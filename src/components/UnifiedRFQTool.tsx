import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Truck,
  BarChart3,
  Save,
  FileText,
  Clock,
  Target,
  Zap,
  Brain,
  Users,
  Building2
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
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { RFQRow, PricingSettings, Project44OAuthConfig } from '../types';
import { 
  saveProject44Config, 
  loadProject44Config,
  saveFreshXApiKey,
  loadFreshXApiKey,
  saveSelectedCarriers,
  loadSelectedCarriers
} from '../utils/credentialStorage';
import { saveRFQBatch, calculateBatchSummary } from '../utils/rfqBatchManager';
import * as XLSX from 'xlsx';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
}

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client: initialProject44Client,
  freshxClient: initialFreshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // State management
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(initialProject44Client);
  const [freshxClient, setFreshxClient] = useState<FreshXAPIClient | null>(initialFreshxClient);
  const [isProject44Valid, setIsProject44Valid] = useState(!!initialProject44Client);
  const [isFreshXValid, setIsFreshXValid] = useState(!!initialFreshxClient);
  
  // File and data state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentItem, setCurrentItem] = useState<string>('');
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');

  // Use custom hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const rfqProcessor = useRFQProcessor({ project44Client, freshxClient });
  const { 
    pricingSettings, 
    selectedCustomer, 
    updatePricingSettings, 
    updateSelectedCustomer 
  } = usePricingSettings(initialPricingSettings);

  // Load saved data on mount
  useEffect(() => {
    const savedProject44Config = loadProject44Config();
    if (savedProject44Config && !project44Client) {
      const client = new Project44APIClient(savedProject44Config);
      setProject44Client(client);
      setIsProject44Valid(true);
    }
    
    const savedFreshXKey = loadFreshXApiKey();
    if (savedFreshXKey && !freshxClient) {
      const client = new FreshXAPIClient(savedFreshXKey);
      setFreshxClient(client);
      setIsFreshXValid(true);
    }
    
    const savedCarriers = loadSelectedCarriers();
    if (savedCarriers) {
      carrierManagement.setSelectedCarriers(savedCarriers);
    }
  }, []);

  // Update selected customer
  useEffect(() => {
    updateSelectedCustomer(initialSelectedCustomer);
  }, [initialSelectedCustomer]);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    saveProject44Config(config);
    const client = new Project44APIClient(config);
    setProject44Client(client);
  };

  const handleProject44Validation = (isValid: boolean) => {
    setIsProject44Valid(isValid);
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    saveFreshXApiKey(apiKey);
    const client = new FreshXAPIClient(apiKey);
    setFreshxClient(client);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    setIsFreshXValid(isValid);
  };

  const handleFileSelect = async (file: File) => {
    setFileError('');
    setFileName(file.name);
    
    try {
      let parsedData: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file, true);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsedData = await parseXLSX(file, true);
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
      }
      
      if (parsedData.length === 0) {
        throw new Error('No valid data found in file');
      }
      
      setRfqData(parsedData);
      console.log(`✅ Loaded ${parsedData.length} RFQ rows from ${file.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      setRfqData([]);
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
    setCurrentStep(0);
    setTotalSteps(rfqData.length);
    setCurrentItem('');
    rfqProcessor.clearResults();

    try {
      await rfqProcessor.processMultipleRFQs(rfqData, {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings,
        selectedCustomer,
        onProgress: (current, total, item) => {
          setCurrentStep(current);
          setTotalSteps(total);
          setCurrentItem(item || '');
        }
      });
    } catch (error) {
      console.error('❌ RFQ processing failed:', error);
      setFileError(error instanceof Error ? error.message : 'Processing failed');
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
      alert('No results to export');
      return;
    }

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
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `rfq-results-${timestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);
  };

  const handleSaveResults = async () => {
    if (rfqProcessor.results.length === 0) {
      setSaveError('No results to save');
      return;
    }

    if (!batchName.trim()) {
      setSaveError('Please enter a batch name');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      // Calculate batch summary
      const summary = calculateBatchSummary(rfqProcessor.results);
      
      // Prepare batch data
      const batchData = {
        batch_name: batchName.trim(),
        customer_name: selectedCustomer || undefined,
        shipment_count: rfqData.length,
        total_quotes_received: summary.total_quotes_received,
        best_total_price: summary.best_total_price,
        total_profit: summary.total_profit,
        pricing_settings: pricingSettings,
        selected_carriers: carrierManagement.selectedCarriers,
        rfq_data: rfqData,
        results_data: rfqProcessor.results,
        created_by: 'user' // You might want to get this from auth context
      };

      // Save to database
      const savedBatch = await saveRFQBatch(batchData);
      
      setSaveSuccess(true);
      setBatchName(''); // Clear the batch name
      console.log('✅ RFQ batch saved successfully:', savedBatch.id);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('❌ Failed to save RFQ batch:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save batch');
    } finally {
      setIsSaving(false);
    }
  };

  const getProcessingStats = () => {
    const completed = rfqProcessor.results.length;
    const success = rfqProcessor.results.filter(r => r.status === 'success').length;
    const errors = rfqProcessor.results.filter(r => r.status === 'error').length;
    
    return { completed, success, errors };
  };

  const stats = getProcessingStats();
  const hasResults = rfqProcessor.results.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Smart Multi-Mode RFQ Processor</h2>
              <p className="text-gray-600 mt-1">
                Intelligent routing: FreshX for reefer, Project44 for LTL/VLTL with automatic classification
              </p>
            </div>
          </div>
          
          {hasResults && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                <div className="text-sm text-gray-500">Successful</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{rfqProcessor.results.reduce((sum, r) => sum + r.quotes.length, 0)}</div>
                <div className="text-sm text-gray-500">Total Quotes</div>
              </div>
            </div>
          )}
        </div>

        {/* Smart Routing Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Truck className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">FreshX Reefer</span>
            </div>
            <p className="text-sm text-green-700">
              isReefer = TRUE routes to specialized reefer network
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800">Standard LTL</span>
            </div>
            <p className="text-sm text-blue-700">
              1-9 pallets, under 15,000 lbs
            </p>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-800">Volume LTL</span>
            </div>
            <p className="text-sm text-purple-700">
              10+ pallets OR 15,000+ lbs (dual-mode comparison)
            </p>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building2 className="h-5 w-5 mr-2 text-blue-600" />
            Project44 Configuration
          </h3>
          <ApiKeyInput
            value=""
            onChange={() => {}}
            onValidation={handleProject44Validation}
            isProject44={true}
            onOAuthConfigChange={handleProject44ConfigChange}
          />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-green-600" />
            FreshX Configuration
          </h3>
          <ApiKeyInput
            value=""
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
        settings={pricingSettings}
        onSettingsChange={updatePricingSettings}
        selectedCustomer={selectedCustomer}
        onCustomerChange={updateSelectedCustomer}
        showAsCard={true}
      />

      {/* File Upload and Template */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Upload className="h-5 w-5 mr-2 text-blue-600" />
            Upload RFQ Data
          </h3>
          <FileUpload
            onFileSelect={handleFileSelect}
            error={fileError}
            isProcessing={isProcessing}
          />
          {fileName && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Loaded: {fileName} ({rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Download className="h-5 w-5 mr-2 text-green-600" />
            Template Download
          </h3>
          <TemplateDownload isProject44={true} />
        </div>
      </div>

      {/* Processing Controls */}
      {rfqData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Play className="h-5 w-5 mr-2 text-blue-600" />
              Process RFQs
            </h3>
            <div className="flex items-center space-x-4">
              {hasResults && (
                <>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Enter batch name to save..."
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSaving}
                    />
                    <button
                      onClick={handleSaveResults}
                      disabled={isSaving || !batchName.trim()}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Batch'}</span>
                    </button>
                  </div>
                  <button
                    onClick={handleExportResults}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Export Excel</span>
                  </button>
                </>
              )}
              <button
                onClick={handleProcessRFQs}
                disabled={isProcessing || !isProject44Valid || carrierManagement.getSelectedCarrierCount() === 0}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                <span>{isProcessing ? 'Processing...' : 'Process RFQs'}</span>
              </button>
            </div>
          </div>

          {/* Save Status Messages */}
          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Batch saved successfully!</span>
              </div>
            </div>
          )}

          {saveError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{saveError}</span>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {(isProcessing || hasResults) && (
            <ProcessingStatus
              total={totalSteps}
              completed={currentStep}
              success={stats.success}
              errors={stats.errors}
              isProcessing={isProcessing}
              currentCarrier={currentItem}
            />
          )}
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <ResultsTable
          results={rfqProcessor.results}
          onExport={handleExportResults}
          onPriceUpdate={handlePriceUpdate}
        />
      )}
    </div>
  );
};