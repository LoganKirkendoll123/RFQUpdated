import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  Users,
  Package,
  Play,
  Loader,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  BarChart3,
  Truck,
  DollarSign,
  Clock,
  AlertCircle,
  RefreshCw,
  Target,
  TrendingUp,
  Building2,
  MapPin
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { PricingSettings, RFQRow, ProcessingResult, QuoteWithPricing } from '../types';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQCard } from './RFQCard';
import * as XLSX from 'xlsx';
import { CarrierSelection } from './CarrierSelection';

interface MassRFQFromShipmentsProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

interface CustomerShipmentSummary {
  customerName: string;
  shipmentCount: number;
  totalWeight: number;
  totalRevenue: number;
  avgRevenue: number;
  dateRange: { start: string; end: string };
  topLanes: Array<{ lane: string; count: number }>;
  topCarriers: Array<{ carrier: string; count: number }>;
}

interface MassRFQJob {
  id: string;
  customerName: string;
  shipmentCount: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  results?: ProcessingResult[];
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

const BATCH_SIZE = 5; // Process 5 RFQs at a time
const BATCH_DELAY = 2000; // 2 second delay between batches

export const MassRFQFromShipments: React.FC<MassRFQFromShipmentsProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerSummaries, setCustomerSummaries] = useState<CustomerShipmentSummary[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [jobs, setJobs] = useState<MassRFQJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load customer shipment summaries
  const loadCustomerSummaries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .gte('Scheduled Pickup Date', dateRange.start)
        .lte('Scheduled Pickup Date', dateRange.end);

      if (shipmentsError) throw shipmentsError;

      // Group shipments by customer
      const customerGroups = shipments?.reduce((acc, shipment) => {
        const customer = shipment.Customer || 'Unknown';
        if (!acc[customer]) {
          acc[customer] = [];
        }
        acc[customer].push(shipment);
        return acc;
      }, {} as Record<string, any[]>) || {};

      // Create summaries
      const summaries: CustomerShipmentSummary[] = Object.entries(customerGroups).map(([customerName, customerShipments]) => {
        const totalWeight = customerShipments.reduce((sum, s) => sum + (parseFloat(s['Tot Weight']) || 0), 0);
        const totalRevenue = customerShipments.reduce((sum, s) => sum + (parseFloat(s.Revenue) || 0), 0);
        
        // Get top lanes
        const laneGroups = customerShipments.reduce((acc, s) => {
          const lane = `${s['Origin City']}, ${s.State} → ${s['Destination City']}, ${s.State_1}`;
          acc[lane] = (acc[lane] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const topLanes = Object.entries(laneGroups)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([lane, count]) => ({ lane, count }));

        // Get top carriers
        const carrierGroups = customerShipments.reduce((acc, s) => {
          const carrier = s['Booked Carrier'] || 'Unknown';
          acc[carrier] = (acc[carrier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const topCarriers = Object.entries(carrierGroups)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([carrier, count]) => ({ carrier, count }));

        return {
          customerName,
          shipmentCount: customerShipments.length,
          totalWeight,
          totalRevenue,
          avgRevenue: totalRevenue / customerShipments.length,
          dateRange: { start: dateRange.start, end: dateRange.end },
          topLanes,
          topCarriers
        };
      });

      setCustomerSummaries(summaries.sort((a, b) => b.shipmentCount - a.shipmentCount));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer summaries');
    } finally {
      setLoading(false);
    }
  };

  // Process mass RFQ for selected customers
  const processMassRFQ = async () => {
    if (selectedCustomers.length === 0) {
      setError('Please select at least one customer');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create jobs for each selected customer
      const newJobs: MassRFQJob[] = selectedCustomers.map(customerName => ({
        id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerName,
        shipmentCount: customerSummaries.find(c => c.customerName === customerName)?.shipmentCount || 0,
        status: 'pending',
        progress: 0,
        startTime: new Date()
      }));

      setJobs(newJobs);

      // Process each job
      for (const job of newJobs) {
        await processCustomerRFQ(job);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process mass RFQ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process RFQ for a single customer
  const processCustomerRFQ = async (job: MassRFQJob) => {
    try {
      // Update job status
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { ...j, status: 'processing', progress: 0 }
          : j
      ));

      // Get customer shipments
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .eq('Customer', job.customerName)
        .gte('Scheduled Pickup Date', dateRange.start)
        .lte('Scheduled Pickup Date', dateRange.end);

      if (shipmentsError) throw shipmentsError;

      if (!shipments || shipments.length === 0) {
        throw new Error('No shipments found for customer');
      }

      // Convert shipments to RFQ rows
      const rfqRows: RFQRow[] = shipments.map(shipment => ({
        originCity: shipment['Origin City'] || '',
        originState: shipment.State || '',
        originZip: shipment.Zip || '',
        destinationCity: shipment['Destination City'] || '',
        destinationState: shipment.State_1 || '',
        destinationZip: shipment.Zip_1 || '',
        weight: parseFloat(shipment['Tot Weight']) || 0,
        freightClass: shipment['Max Freight Class'] || '70',
        length: parseFloat(shipment['Max Length']) || 0,
        width: parseFloat(shipment['Max Width']) || 0,
        height: parseFloat(shipment['Max Height']) || 0,
        pieces: parseInt(shipment['Tot Packages']) || 1,
        commodity: shipment.Commodities || 'General Freight',
        accessorials: shipment.Accessorials || '',
        pickupDate: shipment['Scheduled Pickup Date'] || new Date().toISOString().split('T')[0]
      }));

      // Process RFQs in batches
      const results: ProcessingResult[] = [];
      const totalBatches = Math.ceil(rfqRows.length / BATCH_SIZE);

      for (let i = 0; i < rfqRows.length; i += BATCH_SIZE) {
        const batch = rfqRows.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        
        // Update progress
        const progress = (batchNumber / totalBatches) * 100;
        setJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { ...j, progress }
            : j
        ));

        // Process batch
        const batchResults = await processBatch(batch);
        results.push(...batchResults);

        // Add delay between batches
        if (i + BATCH_SIZE < rfqRows.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      // Update job with results
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { 
              ...j, 
              status: 'completed', 
              progress: 100, 
              results,
              endTime: new Date()
            }
          : j
      ));

    } catch (err) {
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { 
              ...j, 
              status: 'error', 
              error: err instanceof Error ? err.message : 'Unknown error',
              endTime: new Date()
            }
          : j
      ));
    }
  };

  // Process a batch of RFQs
  const processBatch = async (batch: RFQRow[]): Promise<ProcessingResult[]> => {
    const results: ProcessingResult[] = [];

    for (const rfq of batch) {
      try {
        const quotes: QuoteWithPricing[] = [];

        // Get quotes from selected carriers
        const carrierIds = Object.keys(selectedCarriers).filter(id => selectedCarriers[id]);
        
        for (const carrierId of carrierIds) {
          try {
            let quote;
            
            if (project44Client) {
              quote = await project44Client.getQuote(rfq, carrierId);
            } else if (freshxClient) {
              quote = await freshxClient.getQuote(rfq, carrierId);
            }

            if (quote) {
              const pricing = calculatePricingWithCustomerMargins(
                quote.totalCost,
                pricingSettings,
                selectedCustomer
              );

              quotes.push({
                ...quote,
                pricing
              });
            }
          } catch (quoteError) {
            console.warn(`Failed to get quote from carrier ${carrierId}:`, quoteError);
          }
        }

        results.push({
          rfq,
          quotes,
          success: quotes.length > 0,
          error: quotes.length === 0 ? 'No quotes received' : undefined
        });

      } catch (err) {
        results.push({
          rfq,
          quotes: [],
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return results;
  };

  // Export results to Excel
  const exportResults = () => {
    const allResults = jobs.flatMap(job => job.results || []);
    
    if (allResults.length === 0) {
      setError('No results to export');
      return;
    }

    const exportData = allResults.flatMap(result => 
      result.quotes.map(quote => ({
        'Customer': jobs.find(j => j.results?.includes(result))?.customerName || '',
        'Origin': `${result.rfq.originCity}, ${result.rfq.originState} ${result.rfq.originZip}`,
        'Destination': `${result.rfq.destinationCity}, ${result.rfq.destinationState} ${result.rfq.destinationZip}`,
        'Weight': result.rfq.weight,
        'Class': result.rfq.freightClass,
        'Pieces': result.rfq.pieces,
        'Carrier': quote.carrierName,
        'Service': quote.serviceType,
        'Transit Days': quote.transitDays,
        'Total Cost': quote.totalCost,
        'Customer Price': quote.pricing.customerPrice,
        'Margin': `${quote.pricing.marginPercentage.toFixed(1)}%`,
        'Profit': quote.pricing.profit
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mass RFQ Results');
    XLSX.writeFile(wb, `mass-rfq-results-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => {
    loadCustomerSummaries();
  }, [dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Mass RFQ from Shipments</h2>
              <p className="text-sm text-gray-600">Generate quotes for historical shipments by customer</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadCustomerSummaries}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
          </div>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Customer Selection */}
      {!loading && customerSummaries.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Select Customers</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedCustomers(customerSummaries.map(c => c.customerName))}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setSelectedCustomers([])}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerSummaries.map((summary) => (
              <div
                key={summary.customerName}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedCustomers.includes(summary.customerName)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedCustomers(prev => 
                    prev.includes(summary.customerName)
                      ? prev.filter(c => c !== summary.customerName)
                      : [...prev, summary.customerName]
                  );
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate">{summary.customerName}</h4>
                  <input
                    type="checkbox"
                    checked={selectedCustomers.includes(summary.customerName)}
                    onChange={() => {}}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Package className="h-3 w-3" />
                      <span>Shipments</span>
                    </span>
                    <span className="font-medium">{summary.shipmentCount}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <DollarSign className="h-3 w-3" />
                      <span>Avg Revenue</span>
                    </span>
                    <span className="font-medium">{formatCurrency(summary.avgRevenue)}</span>
                  </div>
                  
                  {summary.topLanes.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Top Lane:</p>
                      <p className="text-xs truncate">{summary.topLanes[0].lane}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedCustomers.length > 0 && (
            <div className="mt-6 flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-blue-900">
                  {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <button
                onClick={processMassRFQ}
                disabled={isProcessing || !project44Client && !freshxClient}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                <span>Start Mass RFQ</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Processing Jobs */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Processing Status</h3>
            {jobs.some(j => j.status === 'completed') && (
              <button
                onClick={exportResults}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                <span>Export Results</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`p-1 rounded-full ${
                      job.status === 'completed' ? 'bg-green-100' :
                      job.status === 'error' ? 'bg-red-100' :
                      job.status === 'processing' ? 'bg-blue-100' :
                      'bg-gray-100'
                    }`}>
                      {job.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : job.status === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : job.status === 'processing' ? (
                        <Loader className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{job.customerName}</h4>
                      <p className="text-sm text-gray-600">{job.shipmentCount} shipments</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 capitalize">{job.status}</p>
                    {job.status === 'processing' && (
                      <p className="text-sm text-gray-600">{Math.round(job.progress)}%</p>
                    )}
                  </div>
                </div>

                {job.status === 'processing' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}

                {job.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {job.error}
                  </div>
                )}

                {job.results && job.results.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-600">Total RFQs</p>
                      <p className="font-medium">{job.results.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">Successful</p>
                      <p className="font-medium text-green-600">
                        {job.results.filter(r => r.success).length}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">Total Quotes</p>
                      <p className="font-medium text-blue-600">
                        {job.results.reduce((sum, r) => sum + r.quotes.length, 0)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center space-x-3">
            <Loader className="h-6 w-6 text-blue-600 animate-spin" />
            <span className="text-gray-600">Loading customer shipment data...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && customerSummaries.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Shipments Found</h3>
            <p className="text-gray-600 mb-4">
              No shipments were found for the selected date range. Try adjusting the date range or check your data.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};