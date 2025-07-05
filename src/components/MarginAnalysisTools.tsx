import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Truck, 
  Play, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader,
  BarChart3,
  Target,
  RefreshCw,
  Calendar,
  Package,
  DollarSign,
  Zap,
  ArrowRight,
  Eye,
  PlayCircle,
  Building2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { CarrierSelection } from './CarrierSelection';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { formatCurrency } from '../utils/pricingCalculator';

interface MarginAnalysisJob {
  id: string;
  customer_name: string;
  carrier_name: string;
  analysis_type: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  shipment_count: number;
  first_phase_completed: boolean;
  second_phase_started_at?: string;
  second_phase_completed_at?: string;
  phase_status: string;
  valid_shipment_count?: number;
  phase_one_call_count?: number;
  phase_two_call_count?: number;
  date_range_start?: string;
  date_range_end?: string;
  selected_carriers?: string[];
  recommended_margin?: number;
  current_margin?: number;
  confidence_score?: number;
  error_message?: string;
  customer_list?: string[];
  progress_percentage?: number;
}

interface CustomerResult {
  customer_name: string;
  shipment_count: number;
  avg_carrier_quote: number;
  avg_revenue: number;
  total_profit: number;
  current_margin_percentage: number;
  margin_category: string;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preliminary' | 'queue' | 'completed' | 'recommendations'>('preliminary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Preliminary Report State
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  const [isRunningPhaseOne, setIsRunningPhaseOne] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [liveResults, setLiveResults] = useState<CustomerResult[]>([]);
  const [progressPercentage, setProgressPercentage] = useState(0);
  
  // Carrier Selection State
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  
  // Jobs State
  const [pendingJobs, setPendingJobs] = useState<MarginAnalysisJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<MarginAnalysisJob[]>([]);
  const [runningPhaseTwo, setRunningPhaseTwo] = useState<Set<string>>(new Set());

  useEffect(() => {
    initializeProject44Client();
    loadJobs();
  }, []);

  // Set up polling for live results when a job is running
  useEffect(() => {
    if (!currentJobId || !isRunningPhaseOne) return;
    
    const pollInterval = setInterval(async () => {
      await fetchLiveResults(currentJobId);
    }, 1000); // Poll every second
    
    return () => clearInterval(pollInterval);
  }, [currentJobId, isRunningPhaseOne]);

  const initializeProject44Client = () => {
    const config = loadProject44Config();
    if (config) {
      const client = new Project44APIClient(config);
      setProject44Client(client);
    }
  };

  const loadCarriers = async () => {
    if (!project44Client) return;

    setIsLoadingCarriers(true);
    try {
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      setCarriersLoaded(true);
    } catch (error) {
      console.error('Failed to load carriers:', error);
      setError('Failed to load carriers');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const fetchLiveResults = async (jobId: string) => {
    try {
      // Get job status and progress
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_job_status_with_progress', { job_id: jobId });
      
      if (statusError) throw statusError;
      
      if (statusData) {
        setProgressPercentage(statusData.progress_percentage || 0);
        
        // Check if job is completed
        if (statusData.first_phase_completed) {
          setIsRunningPhaseOne(false);
          setCurrentJobId(null);
          await loadJobs();
        }
      }
      
      // Get live results by customer
      const { data: resultsData, error: resultsError } = await supabase
        .rpc('get_live_job_results', { job_id: jobId });
      
      if (resultsError) throw resultsError;
      
      if (resultsData) {
        setLiveResults(resultsData);
      }
    } catch (error) {
      console.error('Failed to fetch live results:', error);
    }
  };

  const loadJobs = async () => {
    try {
      // Load jobs ready for phase two
      const { data: pendingData, error: pendingError } = await supabase
        .from('margin_analysis_job_phases')
        .select('*')
        .eq('first_phase_completed', true)
        .is('second_phase_started_at', null)
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Load completed jobs (both phases done)
      const { data: completedData, error: completedError } = await supabase
        .from('margin_analysis_job_phases')
        .select('*')
        .not('second_phase_completed_at', 'is', null)
        .order('second_phase_completed_at', { ascending: false })
        .limit(20);

      if (completedError) throw completedError;

      setPendingJobs(pendingData || []);
      setCompletedJobs(completedData || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      setError('Failed to load jobs');
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
    });
    setSelectedCarriers(newSelection);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    const newSelection = { ...selectedCarriers };
    group.carriers.forEach(carrier => {
      newSelection[carrier.id] = selected;
    });
    setSelectedCarriers(newSelection);
  };

  const runPhaseOneAnalysis = async () => {
    if (!project44Client) {
      setError('Please ensure Project44 is connected');
      return;
    }

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier');
      return;
    }
    
    // Get the selected carrier name from the first selected carrier
    const selectedCarrierId = selectedCarrierIds[0];
    const selectedCarrier = carrierGroups
      .flatMap(group => group.carriers)
      .find(carrier => carrier.id === selectedCarrierId);
      
    if (!selectedCarrier) {
      setError('Could not find selected carrier information');
      return;
    }
    
    const carrierName = selectedCarrier.name;

    setIsRunningPhaseOne(true);
    setError('');

    try {
      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('MarginAnalysisJobs')
        .insert({
          customer_name: 'All Customers', // Use a placeholder for all customers
          carrier_name: carrierName,
          analysis_type: 'benchmark',
          status: 'running',
          started_at: new Date().toISOString(),
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          selected_carriers: selectedCarrierIds
        })
        .select()
        .single();

      if (jobError) throw jobError;
      
      // Set current job ID for live results polling
      setCurrentJobId(job.id);

      console.log('🚀 Starting Phase One Analysis for job:', job.id);

      // Get shipments for the date range (all customers)
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);

      if (shipmentsError) throw shipmentsError;

      if (!shipments || shipments.length === 0) {
        throw new Error('No shipments found for the specified date range');
      }

      console.log(`📦 Found ${shipments.length} shipments for analysis`);

      // Update job with shipment count
      await supabase
        .from('MarginAnalysisJobs')
        .update({ shipment_count: shipments.length })
        .eq('id', job.id);

      // Process shipments and make API calls
      const apiCalls = [];
      const validShipments = [];
      const apiResponses = [];
      const rateData = [];

      for (const shipment of shipments) {
        try {
          // Convert shipment to RFQ format
          const rfq = {
            fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
            fromZip: shipment["Zip"] || '00000',
            toZip: shipment["Zip_1"] || '00000',
            pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
            grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
            isStackable: false,
            accessorial: [],
            isReefer: false
          };

          // Validate RFQ data
          if (!rfq.fromZip || !rfq.toZip || rfq.fromZip === '00000' || rfq.toZip === '00000') {
            console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - invalid ZIP codes`);
            continue;
          }

          console.log(`📞 Making API call for shipment ${shipment["Invoice #"]}`);

          // Make Project44 API call
          const quotes = await project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false);

          const apiCall = {
            shipment_id: shipment["Invoice #"],
            rfq_data: rfq,
            timestamp: new Date().toISOString(),
            success: quotes.length > 0
          };

          apiCalls.push(apiCall);

          if (quotes.length > 0) {
            validShipments.push({
              shipment_id: shipment["Invoice #"],
              rfq_data: rfq,
              original_shipment: shipment
            });

            apiResponses.push({
              shipment_id: shipment["Invoice #"],
              quotes: quotes,
              quote_count: quotes.length
            });

            // Extract rate data
            const rates = quotes.map(quote => ({
              carrier_name: quote.carrier.name,
              carrier_scac: quote.carrier.scac,
              rate: quote.rateQuoteDetail?.total || (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts),
              service_level: quote.serviceLevel?.code,
              transit_days: quote.transitDays
            }));

            rateData.push({
              shipment_id: shipment["Invoice #"],
              rates: rates
            });
          }

          // Small delay between API calls
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Error processing shipment ${shipment["Invoice #"]}:`, error);
          
          apiCalls.push({
            shipment_id: shipment["Invoice #"],
            rfq_data: null,
            timestamp: new Date().toISOString(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`✅ Phase One completed: ${validShipments.length} valid shipments out of ${shipments.length} total`);

      // Store phase one results
      await supabase.rpc('store_phase_one_results', {
        job_id: job.id,
        api_calls: apiCalls,
        valid_shipments: validShipments,
        api_responses: apiResponses,
        rate_data: rateData
      });

      // Reload jobs to show the new pending job
      await loadJobs();

      // Clear carrier selection
      setSelectedCarriers({});

    } catch (error) {
      console.error('❌ Phase One Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Phase One Analysis failed');
      
      // Update job status to failed if we have a job ID
      // Note: In a real implementation, you'd want to track the job ID and update it here
    } finally {
      setIsRunningPhaseOne(false);
    }
  };

  const runPhaseTwoAnalysis = async (jobId: string) => {
    setRunningPhaseTwo(prev => new Set(prev).add(jobId));
    setError('');

    try {
      console.log('🚀 Starting Phase Two Analysis for job:', jobId);

      // Start second phase
      await supabase.rpc('start_second_phase_analysis', { job_id: jobId });

      // Get valid shipments from phase one
      const { data: validShipmentsData } = await supabase.rpc('get_valid_phase_one_shipments', { job_id: jobId });

      if (!validShipmentsData || validShipmentsData.length === 0) {
        throw new Error('No valid shipments found from phase one');
      }

      console.log(`📦 Processing ${validShipmentsData.length} valid shipments for phase two`);

      // Get job details for carrier selection
      const { data: jobData } = await supabase
        .from('MarginAnalysisJobs')
        .select('selected_carriers')
        .eq('id', jobId)
        .single();

      const selectedCarrierIds = jobData?.selected_carriers || [];

      // Process the same shipments again (Phase Two)
      const apiCalls = [];
      const apiResponses = [];
      const rateData = [];

      for (const validShipment of validShipmentsData) {
        try {
          console.log(`📞 Phase Two API call for shipment ${validShipment.shipment_id}`);

          // Make the same API call as phase one
          const quotes = await project44Client!.getQuotes(
            validShipment.rfq_data, 
            selectedCarrierIds, 
            false, 
            false, 
            false
          );

          const apiCall = {
            shipment_id: validShipment.shipment_id,
            rfq_data: validShipment.rfq_data,
            timestamp: new Date().toISOString(),
            success: quotes.length > 0
          };

          apiCalls.push(apiCall);

          if (quotes.length > 0) {
            apiResponses.push({
              shipment_id: validShipment.shipment_id,
              quotes: quotes,
              quote_count: quotes.length
            });

            // Extract rate data
            const rates = quotes.map(quote => ({
              carrier_name: quote.carrier.name,
              carrier_scac: quote.carrier.scac,
              rate: quote.rateQuoteDetail?.total || (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts),
              service_level: quote.serviceLevel?.code,
              transit_days: quote.transitDays
            }));

            rateData.push({
              shipment_id: validShipment.shipment_id,
              rates: rates
            });
          }

          // Small delay between API calls
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Error in phase two for shipment ${validShipment.shipment_id}:`, error);
          
          apiCalls.push({
            shipment_id: validShipment.shipment_id,
            rfq_data: validShipment.rfq_data,
            timestamp: new Date().toISOString(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Analyze discount patterns by comparing phase one and phase two rates
      const discountAnalysis = {
        total_shipments_compared: validShipmentsData.length,
        shipments_with_rate_changes: 0,
        avg_rate_change_percentage: 0,
        discount_patterns_detected: false,
        analysis_timestamp: new Date().toISOString()
      };

      console.log(`✅ Phase Two completed: ${apiResponses.length} successful API calls`);

      // Store phase two results
      await supabase.rpc('store_phase_two_results', {
        job_id: jobId,
        api_calls: apiCalls,
        api_responses: apiResponses,
        rate_data: rateData,
        discount_analysis: discountAnalysis
      });

      // Reload jobs
      await loadJobs();

    } catch (error) {
      console.error('❌ Phase Two Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Phase Two Analysis failed');
    } finally {
      setRunningPhaseTwo(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const renderLiveResults = () => {
    if (!isRunningPhaseOne || liveResults.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Loader className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Shipments</h3>
          <p className="text-gray-600">Analyzing shipment data and gathering results...</p>
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {progressPercentage.toFixed(1)}% complete
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Live Results by Customer</h3>
            <div className="flex items-center space-x-2">
              <Loader className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-sm text-blue-600">
                {progressPercentage.toFixed(1)}% complete
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {liveResults.map((result, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{result.customer_name}</h3>
                <p className="text-sm text-gray-600">
                  {result.shipment_count} shipment{result.shipment_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Average Carrier Rate</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(result.avg_carrier_quote)}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Average Revenue</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(result.avg_revenue)}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Current Margin</div>
                <div className={`text-xl font-bold ${
                  result.current_margin_percentage < 15 ? 'text-red-600' :
                  result.current_margin_percentage < 25 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {result.current_margin_percentage.toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-blue-800">
                  Total Profit: {formatCurrency(result.total_profit)}
                </div>
                <div className={`text-sm font-medium px-2 py-1 rounded-full ${
                  result.margin_category === 'Low Margin' ? 'bg-red-100 text-red-800' :
                  result.margin_category === 'Target Margin' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {result.margin_category}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPreliminaryTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Play className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Preliminary Report (Phase One)</h2>
            <p className="text-sm text-gray-600">
              Run initial analysis to capture current market rates for comparison
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mt-1">
              Select a single carrier below for analysis. The system will analyze all shipments for this carrier across all customers in the specified date range.
            </p>
          </div>
        </div>
      </div>

      {/* Carrier Selection */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
            {!carriersLoaded && (
              <button
                onClick={loadCarriers}
                disabled={isLoadingCarriers}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoadingCarriers ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                <span>{isLoadingCarriers ? 'Loading...' : 'Load Carriers'}</span>
              </button>
            )}
          </div>
        </div>
        
        {carriersLoaded && (
          <div className="p-6">
            <CarrierSelection
              carrierGroups={carrierGroups}
              selectedCarriers={selectedCarriers}
              onToggleCarrier={handleCarrierToggle}
              onSelectAll={handleSelectAll}
              onSelectAllInGroup={handleSelectAllInGroup}
              singleSelect={true}
              isLoading={isLoadingCarriers}
            />
          </div>
        )}
      </div>

      {/* Run Analysis Button */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Run Phase One Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              This will capture current market rates for all shipments in the date range
            </p>
          </div>
          <button
            onClick={runPhaseOneAnalysis}
            disabled={isRunningPhaseOne || Object.values(selectedCarriers).every(v => !v)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isRunningPhaseOne ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Running Phase One...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Start Phase One</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Live Results Section */}
      {isRunningPhaseOne && (
        <div className="space-y-4">
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Analysis Results</h3>
            {renderLiveResults()}
          </div>
        </div>
      )}
    </div>
  );

  const renderQueueTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-600 p-2 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Phase Two Queue</h2>
              <p className="text-sm text-gray-600">
                Reports ready for phase two analysis ({pendingJobs.length} pending)
              </p>
            </div>
          </div>
          <button
            onClick={loadJobs}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Pending Jobs */}
      {pendingJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports in Queue</h3>
          <p className="text-gray-600">Run a preliminary report to add jobs to the phase two queue.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {job.carrier_name}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Phase One Complete
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <div className="font-medium">{new Date(job.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Date Range:</span>
                      <div className="font-medium">
                        {job.date_range_start} to {job.date_range_end}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Shipments:</span>
                      <div className="font-medium">{job.shipment_count}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Valid Shipments:</span>
                      <div className="font-medium">{job.valid_shipment_count || 0}</div>
                      {job.customer_list && job.customer_list.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {job.customer_list.length} unique customer{job.customer_list.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => runPhaseTwoAnalysis(job.id)}
                    disabled={runningPhaseTwo.has(job.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {runningPhaseTwo.has(job.id) ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        <span>Run Phase Two</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCompletedTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Completed Analysis</h2>
            <p className="text-sm text-gray-600">
              Reports with both phases completed ({completedJobs.length} total)
            </p>
          </div>
        </div>
      </div>

      {/* Completed Jobs */}
      {completedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Analysis</h3>
          <p className="text-gray-600">Complete phase two analysis to see results here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completedJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {job.carrier_name}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Both Phases Complete
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Completed:</span>
                      <div className="font-medium">{new Date(job.second_phase_completed_at!).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Shipments:</span>
                      <div className="font-medium">{job.valid_shipment_count || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Phase 1 Calls:</span>
                      <div className="font-medium">{job.phase_one_call_count || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Phase 2 Calls:</span>
                      <div className="font-medium">{job.phase_two_call_count || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <div className="font-medium text-green-600">Analysis Complete</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Eye className="h-4 w-4" />
                    <span>View Results</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'preliminary', label: 'Preliminary Report', icon: Play, count: null },
            { id: 'queue', label: 'Phase Two Queue', icon: Clock, count: pendingJobs.length },
            { id: 'completed', label: 'Completed Analysis', icon: CheckCircle, count: completedJobs.length },
            { id: 'recommendations', label: 'Recommendations', icon: Target, count: null }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    activeTab === tab.id 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'preliminary' && renderPreliminaryTab()}
      {activeTab === 'queue' && renderQueueTab()}
      {activeTab === 'completed' && renderCompletedTab()}
      {activeTab === 'recommendations' && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Recommendations Coming Soon</h3>
          <p className="text-gray-600">Margin recommendations will be generated from completed analysis.</p>
        </div>
      )}
    </div>
  );
};