import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  Play, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  MapPin, 
  Calendar, 
  Users, 
  Building2, 
  Truck, 
  DollarSign, 
  BarChart3, 
  RefreshCw, 
  Trash2,
  Copy,
  FolderOpen,
  X,
  Save,
  Download
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { PricingSettings, ProcessingResult, RFQRow, QuoteWithPricing } from '../types';
import { PricingSettingsComponent } from './PricingSettings';
import { CustomerSelection } from './CustomerSelection';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { Analytics } from './Analytics';
import { calculatePricingWithCustomerMargins, clearMarginCache } from '../utils/pricingCalculator';
import { 
  saveMassRFQBatch, 
  getMassRFQBatches, 
  deleteMassRFQBatch, 
  calculateBatchSummary,
  MassRFQBatch 
} from '../utils/massRfqDatabase';
import * as XLSX from 'xlsx';

interface MassRFQFromShipmentsProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

interface ShipmentFilters {
  customer: string;
  branch: string;
  salesRep: string;
  carrier: string;
  dateStart: string;
  dateEnd: string;
}

export const MassRFQFromShipments: React.FC<MassRFQFromShipmentsProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  // State for shipment data and filtering
  const [shipments, setShipments] = useState<any[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Filter state
  const [filters, setFilters] = useState<ShipmentFilters>({
    customer: '',
    branch: '',
    salesRep: '',
    carrier: '',
    dateStart: '',
    dateEnd: ''
  });
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    customers: [] as string[],
    branches: [] as string[],
    salesReps: [] as string[],
    carriers: [] as string[]
  });
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentCarrier, setCurrentCarrier] = useState<string>('');
  
  // Local settings
  const [localPricingSettings, setLocalPricingSettings] = useState<PricingSettings>(pricingSettings);
  const [localSelectedCustomer, setLocalSelectedCustomer] = useState<string>(selectedCustomer);
  const [localSelectedCarriers, setLocalSelectedCarriers] = useState<{ [carrierId: string]: boolean }>(selectedCarriers);
  
  // Saved batches state
  const [savedBatches, setSavedBatches] = useState<MassRFQBatch[]>([]);
  const [showSavedBatches, setShowSavedBatches] = useState(false);
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadShipments();
    loadSavedBatches();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shipments, filters]);

  const loadShipments = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📦 Loading shipments from database...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select('*')
        .order('"Scheduled Pickup Date"', { ascending: false })
        .limit(1000);
      
      if (error) {
        throw error;
      }
      
      setShipments(data || []);
      
      // Extract unique values for filter options
      const customers = [...new Set(data?.map(s => s.Customer).filter(Boolean))].sort();
      const branches = [...new Set(data?.map(s => s.Branch).filter(Boolean))].sort();
      const salesReps = [...new Set(data?.map(s => s["Sales Rep"]).filter(Boolean))].sort();
      const carriers = [...new Set([
        ...data?.map(s => s["Booked Carrier"]).filter(Boolean) || [],
        ...data?.map(s => s["Quoted Carrier"]).filter(Boolean) || []
      ])].sort();
      
      setFilterOptions({ customers, branches, salesReps, carriers });
      
      console.log(`✅ Loaded ${data?.length || 0} shipments`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load shipments';
      setError(errorMsg);
      console.error('❌ Failed to load shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedBatches = async () => {
    try {
      const batches = await getMassRFQBatches();
      setSavedBatches(batches);
    } catch (err) {
      console.error('❌ Failed to load saved batches:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...shipments];
    
    if (filters.customer) {
      filtered = filtered.filter(s => s.Customer === filters.customer);
    }
    
    if (filters.branch) {
      filtered = filtered.filter(s => s.Branch === filters.branch);
    }
    
    if (filters.salesRep) {
      filtered = filtered.filter(s => s["Sales Rep"] === filters.salesRep);
    }
    
    if (filters.carrier) {
      filtered = filtered.filter(s => 
        s["Booked Carrier"] === filters.carrier || 
        s["Quoted Carrier"] === filters.carrier
      );
    }
    
    if (filters.dateStart) {
      filtered = filtered.filter(s => 
        s["Scheduled Pickup Date"] && s["Scheduled Pickup Date"] >= filters.dateStart
      );
    }
    
    if (filters.dateEnd) {
      filtered = filtered.filter(s => 
        s["Scheduled Pickup Date"] && s["Scheduled Pickup Date"] <= filters.dateEnd
      );
    }
    
    setFilteredShipments(filtered);
  };

  const clearFilters = () => {
    setFilters({
      customer: '',
      branch: '',
      salesRep: '',
      carrier: '',
      dateStart: '',
      dateEnd: ''
    });
  };

  const convertShipmentToRFQ = (shipment: any): RFQRow => {
    // Parse weight from string format
    const weightStr = shipment["Tot Weight"]?.toString() || '0';
    const weight = parseInt(weightStr.replace(/[^\d]/g, '')) || 1000;
    
    // Parse pallets
    const pallets = parseInt(shipment["Tot Packages"]?.toString() || '1') || 1;
    
    // Determine if it's a reefer shipment based on commodities or other indicators
    const commodities = shipment["Commodities"]?.toLowerCase() || '';
    const isReefer = commodities.includes('frozen') || 
                    commodities.includes('refrigerated') || 
                    commodities.includes('dairy') ||
                    commodities.includes('produce');
    
    return {
      fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
      fromZip: shipment["Zip"] || '00000',
      toZip: shipment["Zip_1"] || '00000',
      pallets,
      grossWeight: weight,
      isStackable: false,
      isReefer,
      accessorial: [],
      originCity: shipment["Origin City"],
      originState: shipment["State"],
      destinationCity: shipment["Destination City"],
      destinationState: shipment["State_1"],
      commodityDescription: shipment["Commodities"],
      freightClass: shipment["Max Freight Class"] || '70'
    };
  };

  const classifyShipment = (rfq: RFQRow): {quoting: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual', reason: string} => {
    if (rfq.isReefer === true) {
      return {
        quoting: 'freshx',
        reason: `Reefer shipment - quoted through FreshX reefer network`
      };
    }
    
    if (rfq.pallets >= 10 || rfq.grossWeight >= 15000) {
      return {
        quoting: 'project44-dual',
        reason: `Large shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through both Project44 Volume LTL and Standard LTL`
      };
    } else {
      return {
        quoting: 'project44-standard',
        reason: `Standard shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through Project44 Standard LTL`
      };
    }
  };

  const processSelectedShipments = async () => {
    if (!project44Client) {
      setError('Project44 client not available');
      return;
    }

    if (filteredShipments.length === 0) {
      setError('No shipments to process');
      return;
    }

    const selectedCarrierIds = Object.entries(localSelectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setError('');
    setTotalSteps(filteredShipments.length);
    setCurrentStep(0);

    console.log(`🚀 Starting Mass RFQ processing: ${filteredShipments.length} shipments, ${selectedCarrierIds.length} carriers`);

    const allResults: ProcessingResult[] = [];

    for (let i = 0; i < filteredShipments.length; i++) {
      const shipment = filteredShipments[i];
      setCurrentStep(i + 1);
      
      try {
        const rfqData = convertShipmentToRFQ(shipment);
        const classification = classifyShipment(rfqData);
        
        setCurrentCarrier(`Shipment ${i + 1}: ${classification.quoting.toUpperCase()}`);
        
        console.log(`🧠 Shipment ${i + 1}/${filteredShipments.length} - ${classification.reason}`);

        const result: ProcessingResult = {
          rowIndex: i,
          originalData: rfqData,
          quotes: [],
          status: 'processing'
        };

        let quotes: any[] = [];

        if (classification.quoting === 'freshx' && freshxClient) {
          console.log(`🌡️ Getting FreshX quotes for shipment ${i + 1}`);
          quotes = await freshxClient.getQuotes(rfqData);
        } else if (classification.quoting === 'project44-dual') {
          console.log(`📦 Getting dual quotes for shipment ${i + 1}`);
          
          const [volumeQuotes, standardQuotes] = await Promise.all([
            project44Client.getQuotes(rfqData, selectedCarrierIds, true, false, false),
            project44Client.getQuotes(rfqData, selectedCarrierIds, false, false, false)
          ]);
          
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
        } else {
          console.log(`🚛 Getting Standard LTL quotes for shipment ${i + 1}`);
          quotes = await project44Client.getQuotes(rfqData, selectedCarrierIds, false, false, false);
        }
        
        if (quotes.length > 0) {
          const quotesWithPricing = await Promise.all(
            quotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, localPricingSettings, localSelectedCustomer)
            )
          );
          
          result.quotes = quotesWithPricing;
          result.status = 'success';
          console.log(`✅ Shipment ${i + 1} completed: ${quotes.length} quotes received`);
        } else {
          result.status = 'success';
          console.log(`ℹ️ Shipment ${i + 1} completed: No quotes received`);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        result.status = 'error';
        console.error(`❌ Shipment ${i + 1} failed:`, error);
      }

      allResults.push(result);
      setResults([...allResults]);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsProcessing(false);
    setCurrentCarrier('');
    console.log(`🏁 Mass RFQ processing completed: ${allResults.length} total results`);
  };

  const handleSaveBatch = async () => {
    if (!batchName.trim()) {
      setError('Please enter a batch name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const batchSummary = calculateBatchSummary(results);
      
      const batch: Omit<MassRFQBatch, 'id' | 'created_at' | 'updated_at'> = {
        batch_name: batchName.trim(),
        customer_name: filters.customer || undefined,
        branch_filter: filters.branch || undefined,
        sales_rep_filter: filters.salesRep || undefined,
        carrier_filter: filters.carrier || undefined,
        date_range_start: filters.dateStart || undefined,
        date_range_end: filters.dateEnd || undefined,
        ...batchSummary,
        pricing_settings: localPricingSettings,
        selected_carriers: localSelectedCarriers,
        rfq_data: filteredShipments,
        results_data: results,
        created_by: 'user'
      };

      await saveMassRFQBatch(batch);
      
      setShowSaveDialog(false);
      setBatchName('');
      await loadSavedBatches();
      
      console.log('✅ Mass RFQ batch saved successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save batch';
      setError(errorMsg);
      console.error('❌ Failed to save batch:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadBatch = async (batch: MassRFQBatch) => {
    try {
      // Load the batch configuration
      setFilters({
        customer: batch.customer_name || '',
        branch: batch.branch_filter || '',
        salesRep: batch.sales_rep_filter || '',
        carrier: batch.carrier_filter || '',
        dateStart: batch.date_range_start || '',
        dateEnd: batch.date_range_end || ''
      });
      
      setLocalPricingSettings(batch.pricing_settings);
      setLocalSelectedCarriers(batch.selected_carriers);
      
      if (batch.customer_name) {
        setLocalSelectedCustomer(batch.customer_name);
      }
      
      // Load the results if available
      if (batch.results_data) {
        setResults(batch.results_data);
      }
      
      setShowSavedBatches(false);
      console.log('✅ Batch loaded successfully:', batch.batch_name);
    } catch (err) {
      console.error('❌ Failed to load batch:', err);
      setError('Failed to load batch');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;
    
    try {
      await deleteMassRFQBatch(batchId);
      await loadSavedBatches();
      console.log('✅ Batch deleted successfully');
    } catch (err) {
      console.error('❌ Failed to delete batch:', err);
      setError('Failed to delete batch');
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;

    const exportData = results.flatMap(result => {
      return result.quotes.map(quote => {
        const quoteWithPricing = quote as QuoteWithPricing;
        
        return {
          'Shipment Index': result.rowIndex + 1,
          'Origin ZIP': result.originalData.fromZip,
          'Destination ZIP': result.originalData.toZip,
          'Pallets': result.originalData.pallets,
          'Weight (lbs)': result.originalData.grossWeight,
          'Is Reefer': result.originalData.isReefer ? 'TRUE' : 'FALSE',
          'Pickup Date': result.originalData.fromDate,
          'Carrier Name': quote.carrier.name,
          'Carrier SCAC': quote.carrier.scac || '',
          'Service Level': quote.serviceLevel?.description || '',
          'Transit Days': quote.transitDays || '',
          'Carrier Rate': quoteWithPricing.carrierTotalRate || 0,
          'Customer Price': quoteWithPricing.customerPrice || 0,
          'Profit Margin': quoteWithPricing.profit || 0,
          'Processing Status': result.status.toUpperCase(),
          'Error Message': result.error || ''
        };
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mass RFQ Results');
    
    const fileName = `mass-rfq-results-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      const result = newResults[resultIndex];
      
      if (result && result.quotes) {
        const updatedQuotes = result.quotes.map(quote => {
          if (quote.quoteId === quoteId) {
            return calculatePricingWithCustomerMargins(quote, localPricingSettings, localSelectedCustomer, newPrice);
          }
          return quote;
        });
        
        newResults[resultIndex] = {
          ...result,
          quotes: updatedQuotes
        };
      }
      
      return newResults;
    });
  };

  const getSuccessfulResults = () => results.filter(r => r.status === 'success');
  const getErrorResults = () => results.filter(r => r.status === 'error');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Mass RFQ from Shipments</h1>
              <p className="text-sm text-gray-600">
                Process multiple shipments from your database for competitive freight quotes
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSavedBatches(!showSavedBatches)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Saved Batches ({savedBatches.length})</span>
            </button>
            <button
              onClick={loadShipments}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Saved Batches Panel */}
      {showSavedBatches && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Saved Mass RFQ Batches</h3>
            <button
              onClick={() => setShowSavedBatches(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {savedBatches.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No saved batches found</p>
          ) : (
            <div className="space-y-3">
              {savedBatches.map((batch) => (
                <div key={batch.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{batch.batch_name}</h4>
                      <div className="text-sm text-gray-600 mt-1">
                        <span>{batch.shipment_count} shipments • </span>
                        <span>{batch.total_quotes_received} quotes • </span>
                        <span>Created {new Date(batch.created_at!).toLocaleDateString()}</span>
                      </div>
                      {batch.customer_name && (
                        <div className="text-sm text-blue-600 mt-1">
                          Customer: {batch.customer_name}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleLoadBatch(batch)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id!)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filter Shipments</h3>
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Clear All Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={filters.customer}
              onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Customers</option>
              {filterOptions.customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={filters.branch}
              onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Branches</option>
              {filterOptions.branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep</label>
            <select
              value={filters.salesRep}
              onChange={(e) => setFilters({ ...filters, salesRep: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Sales Reps</option>
              {filterOptions.salesReps.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
            <select
              value={filters.carrier}
              onChange={(e) => setFilters({ ...filters, carrier: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Carriers</option>
              {filterOptions.carriers.map(carrier => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Shipments Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Filtered Shipments ({filteredShipments.length})
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {filteredShipments.length} shipments ready for mass RFQ processing
            </p>
          </div>
          
          {filteredShipments.length > 0 && !isProcessing && (
            <button
              onClick={processSelectedShipments}
              disabled={!project44Client}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
            >
              <Play className="h-5 w-5" />
              <span>Process {filteredShipments.length} Shipments</span>
            </button>
          )}
        </div>
      </div>

      {/* Pricing Settings */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <PricingSettingsComponent
          settings={localPricingSettings}
          onSettingsChange={setLocalPricingSettings}
          selectedCustomer={localSelectedCustomer}
          onCustomerChange={setLocalSelectedCustomer}
          showAsCard={false}
        />
      </div>

      {/* Processing Status */}
      {(isProcessing || results.length > 0) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <ProcessingStatus
            total={totalSteps}
            completed={currentStep}
            success={getSuccessfulResults().length}
            errors={getErrorResults().length}
            isProcessing={isProcessing}
            currentCarrier={currentCarrier}
          />
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-6">
          {/* Results Header with Save Button */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Mass RFQ Results</h2>
                <p className="text-sm text-gray-600">
                  {results.length} shipments processed • {getSuccessfulResults().length} successful • {getErrorResults().length} errors
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Batch</span>
                </button>
                <button
                  onClick={exportResults}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Results</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <ResultsTable
            results={results}
            onExport={exportResults}
            onPriceUpdate={handlePriceUpdate}
          />

          {/* Analytics */}
          <Analytics
            results={getSuccessfulResults()}
            onExport={() => console.log('Export analytics')}
          />
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Mass RFQ Batch</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Enter a name for this batch..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">What will be saved:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• All filter settings and shipment data</li>
                  <li>• Complete results with quotes and pricing</li>
                  <li>• Pricing settings and carrier selection</li>
                  <li>• Configuration for easy re-running</li>
                </ul>
              </div>
            </div>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setBatchName('');
                  setError('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBatch}
                disabled={!batchName.trim() || saving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Batch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !showSaveDialog && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      )}
    </div>
  );
};