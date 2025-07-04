import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Download,
  Settings,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow, ProcessingResult, PricingSettings } from '../types';
import { parseCSV, parseXLSX } from '../utils/fileParser';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { FileUpload } from './FileUpload';
import { showSuccessToast, showErrorToast, showInfoToast } from './Toast';
import * as XLSX from 'xlsx';

interface BatchQuoteProcessorProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
  onProcessingComplete: (results: ProcessingResult[]) => void;
}

export const BatchQuoteProcessor: React.FC<BatchQuoteProcessorProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer,
  onProcessingComplete
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [processingMode, setProcessingMode] = useState<'sequential' | 'parallel'>('sequential');
  const [batchSize, setBatchSize] = useState(5);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const handleFileSelect = (file: File) => {
    setFiles(prev => [...prev, file]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parseFiles = async () => {
    setRfqData([]);
    setErrors([]);
    
    try {
      let allRfqData: RFQRow[] = [];
      
      for (const file of files) {
        try {
          showInfoToast(`Parsing ${file.name}...`);
          
          let data: RFQRow[];
          if (file.name.endsWith('.csv')) {
            data = await parseCSV(file, true);
          } else {
            data = await parseXLSX(file, true);
          }
          
          allRfqData = [...allRfqData, ...data];
          showSuccessToast(`Parsed ${data.length} rows from ${file.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
          setErrors(prev => [...prev, `Error parsing ${file.name}: ${errorMessage}`]);
          showErrorToast(`Error parsing ${file.name}`);
        }
      }
      
      setRfqData(allRfqData);
      return allRfqData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse files';
      setErrors(prev => [...prev, errorMessage]);
      showErrorToast('Failed to parse files');
      return [];
    }
  };

  const classifyShipment = (rfq: RFQRow): {quoting: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual', reason: string} => {
    // Check the isReefer field first - this is the primary quoting control
    if (rfq.isReefer === true) {
      return {
        quoting: 'freshx',
        reason: `Marked as reefer shipment (isReefer=TRUE) - quoted through FreshX reefer network`
      };
    }
    
    // For non-reefer shipments (isReefer=FALSE or undefined), quote through Project44
    // Determine LTL vs VLTL based on size and weight
    if (rfq.pallets >= 10 || rfq.grossWeight >= 15000) {
      return {
        quoting: 'project44-dual',
        reason: `Large shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through both Project44 Volume LTL and Standard LTL for comparison`
      };
    } else {
      return {
        quoting: 'project44-standard',
        reason: `Standard shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through Project44 Standard LTL`
      };
    }
  };

  const processRFQsSequential = async (data: RFQRow[]) => {
    if (!project44Client) {
      showErrorToast('No Project44 client available');
      return [];
    }

    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: data.length });

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    console.log(`🧠 Starting Sequential Smart Quoting: ${data.length} RFQs, ${selectedCarrierIds.length} carriers`);
    showInfoToast(`Processing ${data.length} shipments sequentially...`);

    const allResults: ProcessingResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const rfq = data[i];
      setProgress({ current: i + 1, total: data.length });
      
      // Classify the shipment using the smart quoting logic
      const classification = classifyShipment(rfq);
      
      console.log(`🧠 RFQ ${i + 1}/${data.length} - ${classification.reason}`);

      const result: ProcessingResult = {
        rowIndex: i,
        originalData: rfq,
        quotes: [],
        status: 'processing'
      };

      try {
        let quotes: any[] = [];

        if (classification.quoting === 'freshx' && freshxClient) {
          console.log(`🌡️ Getting FreshX quotes for RFQ ${i + 1}`);
          quotes = await freshxClient.getQuotes(rfq);
        } else if (classification.quoting === 'project44-dual') {
          console.log(`📦 Getting dual quotes (Volume LTL + Standard LTL) for RFQ ${i + 1}`);
          
          // Get both Volume LTL and Standard LTL quotes
          const [volumeQuotes, standardQuotes] = await Promise.all([
            project44Client.getQuotes(rfq, selectedCarrierIds, true, false, false),  // Volume LTL
            project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false)  // Standard LTL
          ]);
          
          // Tag quotes with their mode for identification
          const taggedVolumeQuotes = volumeQuotes.map(quote => ({
            ...quote,
            quoteMode: 'volume',
            quoteModeLabel: 'Volume LTL'
          }));
          
          const taggedStandardQuotes = standardQuotes.map(quote => ({
            ...quote,
            quoteMode: 'standard',
            quoteModeLabel: 'Standard LTL'
          }));
          
          quotes = [...taggedVolumeQuotes, ...taggedStandardQuotes];
          console.log(`✅ Dual quoting completed: ${volumeQuotes.length} Volume LTL + ${standardQuotes.length} Standard LTL quotes`);
        } else {
          console.log(`🚛 Getting Standard LTL quotes for RFQ ${i + 1}`);
          quotes = await project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false);
        }
        
        if (quotes.length > 0) {
          // Apply pricing to quotes
          const quotesWithPricing = await Promise.all(
            quotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
            )
          );
          
          result.quotes = quotesWithPricing;
          result.status = 'success';
          console.log(`✅ ${classification.quoting.toUpperCase()} RFQ ${i + 1} completed: ${quotes.length} quotes received`);
        } else {
          result.status = 'success'; // No error, just no quotes
          console.log(`ℹ️ ${classification.quoting.toUpperCase()} RFQ ${i + 1} completed: No quotes received`);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        result.status = 'error';
        console.error(`❌ ${classification.quoting.toUpperCase()} RFQ ${i + 1} failed:`, error);
      }

      allResults.push(result);
      setResults([...allResults]);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsProcessing(false);
    console.log(`🏁 Sequential Smart Quoting completed: ${allResults.length} total results`);
    showSuccessToast(`Completed processing ${data.length} shipments`);
    
    onProcessingComplete(allResults);
    return allResults;
  };

  const processRFQsParallel = async (data: RFQRow[]) => {
    if (!project44Client) {
      showErrorToast('No Project44 client available');
      return [];
    }

    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: data.length });

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    console.log(`🧠 Starting Parallel Smart Quoting: ${data.length} RFQs, ${selectedCarrierIds.length} carriers`);
    showInfoToast(`Processing ${data.length} shipments in batches of ${batchSize}...`);

    const allResults: ProcessingResult[] = Array(data.length).fill(null).map((_, i) => ({
      rowIndex: i,
      originalData: data[i],
      quotes: [],
      status: 'processing'
    }));

    // Group RFQs by quoting mode
    const freshxRFQs: RFQRow[] = [];
    const standardRFQs: RFQRow[] = [];
    const dualRFQs: RFQRow[] = [];

    data.forEach((rfq, index) => {
      const classification = classifyShipment(rfq);
      
      // Store classification in the result
      (allResults[index] as any).quotingDecision = classification.quoting;
      (allResults[index] as any).quotingReason = classification.reason;
      
      if (classification.quoting === 'freshx') {
        freshxRFQs.push({ ...rfq, rowIndex: index });
      } else if (classification.quoting === 'project44-standard') {
        standardRFQs.push({ ...rfq, rowIndex: index });
      } else if (classification.quoting === 'project44-dual') {
        dualRFQs.push({ ...rfq, rowIndex: index });
      }
    });

    // Process each group in parallel batches
    const processBatch = async (
      rfqs: RFQRow[], 
      getQuotesFunc: (rfq: RFQRow) => Promise<any[]>,
      description: string
    ) => {
      console.log(`🔄 Processing ${rfqs.length} ${description} RFQs in batches of ${batchSize}`);
      
      for (let i = 0; i < rfqs.length; i += batchSize) {
        const batch = rfqs.slice(i, i + batchSize);
        setProgress(prev => ({ ...prev, current: prev.current + batch.length }));
        
        await Promise.all(batch.map(async (rfq) => {
          const index = rfq.rowIndex!;
          try {
            const quotes = await getQuotesFunc(rfq);
            
            if (quotes.length > 0) {
              // Apply pricing to quotes
              const quotesWithPricing = await Promise.all(
                quotes.map(quote => 
                  calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
                )
              );
              
              allResults[index].quotes = quotesWithPricing;
              allResults[index].status = 'success';
            } else {
              allResults[index].status = 'success'; // No error, just no quotes
            }
          } catch (error) {
            allResults[index].error = error instanceof Error ? error.message : 'Unknown error';
            allResults[index].status = 'error';
          }
          
          // Update results after each RFQ
          setResults([...allResults]);
        }));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    // Process FreshX RFQs
    if (freshxRFQs.length > 0 && freshxClient) {
      await processBatch(
        freshxRFQs,
        (rfq) => freshxClient.getQuotes(rfq),
        'FreshX'
      );
    }

    // Process Standard LTL RFQs
    if (standardRFQs.length > 0) {
      await processBatch(
        standardRFQs,
        (rfq) => project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false),
        'Standard LTL'
      );
    }

    // Process Dual Mode RFQs
    if (dualRFQs.length > 0) {
      await processBatch(
        dualRFQs,
        async (rfq) => {
          // Get both Volume LTL and Standard LTL quotes
          const [volumeQuotes, standardQuotes] = await Promise.all([
            project44Client.getQuotes(rfq, selectedCarrierIds, true, false, false),  // Volume LTL
            project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false)  // Standard LTL
          ]);
          
          // Tag quotes with their mode for identification
          const taggedVolumeQuotes = volumeQuotes.map(quote => ({
            ...quote,
            quoteMode: 'volume',
            quoteModeLabel: 'Volume LTL'
          }));
          
          const taggedStandardQuotes = standardQuotes.map(quote => ({
            ...quote,
            quoteMode: 'standard',
            quoteModeLabel: 'Standard LTL'
          }));
          
          return [...taggedVolumeQuotes, ...taggedStandardQuotes];
        },
        'Dual Mode'
      );
    }

    setIsProcessing(false);
    console.log(`🏁 Parallel Smart Quoting completed: ${allResults.length} total results`);
    showSuccessToast(`Completed processing ${data.length} shipments`);
    
    onProcessingComplete(allResults);
    return allResults;
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      showErrorToast('Please upload at least one file');
      return;
    }

    const data = await parseFiles();
    if (data.length === 0) {
      showErrorToast('No valid data found in files');
      return;
    }

    if (processingMode === 'sequential') {
      await processRFQsSequential(data);
    } else {
      await processRFQsParallel(data);
    }
  };

  const exportTemplate = () => {
    const workbook = XLSX.utils.book_new();
    
    // Create headers
    const headers = [
      'fromDate', 'fromZip', 'toZip', 'pallets', 'grossWeight', 
      'isStackable', 'isReefer', 'temperature', 'commodity'
    ];
    
    // Create sample data
    const sampleData = [
      ['2025-01-15', '60607', '30033', 3, 2500, false, false, '', ''],
      ['2025-01-16', '90210', '10001', 12, 18000, true, false, '', ''],
      ['2025-01-17', '33101', '75201', 5, 4500, false, true, 'CHILLED', 'FOODSTUFFS']
    ];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    XLSX.utils.book_append_sheet(workbook, ws, 'RFQ Template');
    
    // Generate file and trigger download
    XLSX.writeFile(workbook, 'batch-quote-template.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Batch Quote Processor</h2>
            <p className="text-sm text-gray-600">
              Process multiple RFQs at once with smart routing
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* File Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Upload Files</h3>
              <button
                onClick={exportTemplate}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                <span>Download Template</span>
              </button>
            </div>
            
            <FileUpload
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
            />
            
            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files</h4>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={isProcessing}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Processing Settings */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Processing Settings</h3>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center space-x-2 text-sm text-blue-600"
              >
                <Settings className="h-4 w-4" />
                <span>{showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={processingMode === 'sequential'}
                    onChange={() => setProcessingMode('sequential')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Sequential Processing</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={processingMode === 'parallel'}
                    onChange={() => setProcessingMode('parallel')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Parallel Processing</span>
                </label>
              </div>
              
              {showAdvancedSettings && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Batch Size
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Number of RFQs to process simultaneously (1-10)
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>
                        Estimated time: {Math.ceil(rfqData.length / (processingMode === 'parallel' ? batchSize : 1) * 2)} seconds
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-2">Errors</h4>
                    <ul className="space-y-1 text-sm text-red-700">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Process Button */}
          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={handleProcess}
              disabled={isProcessing || files.length === 0}
              className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Processing {progress.current} of {progress.total}...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Process {files.length} File{files.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
            
            {rfqData.length > 0 && !isProcessing && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      {rfqData.length} shipment{rfqData.length !== 1 ? 's' : ''} ready for processing
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Smart routing will automatically classify each shipment
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};