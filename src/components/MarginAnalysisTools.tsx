import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Database, 
  Play, 
  Pause, 
  BarChart3, 
  Users, 
  Truck, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Target,
  Zap,
  Brain,
  Activity,
  Archive,
  FileText,
  Settings,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  Loader,
  CalendarDays,
  Check,
  X
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { CarrierSelection } from './CarrierSelection';
import { CarrierGroup, Project44APIClient } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';

interface MarginAnalysisJob {
  id: string;
  customer_name: string;
  carrier_name: string;
  analysis_type: 'benchmark' | 'comparison';
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  shipment_count: number;
  benchmark_data?: any;
  comparison_data?: any;
  recommended_margin?: number;
  current_margin?: number;
  confidence_score?: number;
  error_message?: string;
  date_range_start?: string;
  date_range_end?: string;
  selected_carriers?: string[];
}

interface MarginRecommendation {
  customer_name: string;
  carrier_name: string;
  current_margin: number;
  recommended_margin: number;
  confidence_score: number;
  potential_revenue_impact: number;
  shipment_count: number;
  avg_shipment_value: number;
  margin_variance: number;
  last_updated: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'recommendations' | 'settings'>('overview');
  const [analysisJobs, setAnalysisJobs] = useState<MarginAnalysisJob[]>([]);
  const [recommendations, setRecommendations] = useState<MarginRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Analysis settings
  const [analysisSettings, setAnalysisSettings] = useState({
    minShipmentCount: 10,
    confidenceThreshold: 0.75,
    maxMarginChange: 5.0,
    autoRunEnabled: false,
    scheduleTime: '02:00'
  });
  
  // Date range configuration
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    endDate: new Date().toISOString().split('T')[0] // Today
  });
  
  // Customer-carrier pairs state
  const [availableCarriers, setAvailableCarriers] = useState<string[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [showCarrierSelection, setShowCarrierSelection] = useState(false);
  
  // Filters
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [customerList, setCustomerList] = useState<string[]>([]);

  useEffect(() => {
    loadAnalysisData();
    loadCustomerList();
  }, []);

  const loadCustomerList = async () => {
    try {
      console.log('🔍 Loading customer list for margin analysis...');
      
      // Get unique customers from CustomerCarriers table
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null);
      
      if (error) {
        throw error;
      }
      
      // Get unique customer names
      const uniqueCustomers = [...new Set(data?.map(d => d.InternalName).filter(Boolean))].sort();
      setCustomerList(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers`);
    } catch (err) {
      console.error('❌ Failed to load customer list:', err);
      setError('Failed to load customer list');
    }
  };

  const loadAvailableCarriers = async () => {
    setIsLoadingCarriers(true);
    try {
      console.log(`🔍 Loading carriers for customer: ${customerFilter}`);
      
      // Get all customer-carrier pairs for this customer
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode')
        .eq('InternalName', customerFilter)
        .not('P44CarrierCode', 'is', null);
      
      if (error) {
        console.error('❌ Error loading customer carriers:', error);
        throw error;
      }
      
      // Extract unique carrier codes
      const carriers = [...new Set(data?.map(d => d.P44CarrierCode).filter(Boolean))];
      setAvailableCarriers(carriers);
      
      console.log(`✅ Found ${carriers.length} carriers for customer ${customerFilter}:`, carriers);
      
      // Clear selected carrier if it's not in the available list
      if (selectedCarrier && !carriers.includes(selectedCarrier)) {
        setSelectedCarrier('');
      }
    } catch (error) {
      console.error('❌ Failed to load available carriers:', error);
      setError(error instanceof Error ? error.message : 'Failed to load carriers');
      setAvailableCarriers([]);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    // For margin analysis, only allow one carrier at a time
    if (selected) {
      setSelectedCarrier(carrierId);
    } else if (selectedCarrier === carrierId) {
      setSelectedCarrier('');
    }
  };

  const handleSelectAll = () => {
    // Not applicable for single carrier selection
    return;
  };

  const handleSelectAllInGroup = () => {
    // Not applicable for single carrier selection
    return;
  };

  const getSelectedCarrierCount = () => {
    return selectedCarrier ? 1 : 0;
  };

  const getDateRangeDays = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };
  const loadAnalysisData = async () => {
    setLoading(true);
    try {
      console.log('📊 Loading real margin analysis data...');
      
      // Load analysis jobs from Supabase
      const { data: jobsData, error: jobsError } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (jobsError) {
        console.error('❌ Error loading analysis jobs:', jobsError);
        throw jobsError;
      }
      
      setAnalysisJobs(jobsData || []);
      console.log(`✅ Loaded ${jobsData?.length || 0} analysis jobs`);
      
      // Load recommendations from Supabase
      const { data: recsData, error: recsError } = await supabase
        .from('MarginRecommendations')
        .select('*')
        .order('last_updated', { ascending: false });
      
      if (recsError) {
        console.error('❌ Error loading recommendations:', recsError);
        throw recsError;
      }
      
      setRecommendations(recsData || []);
      console.log(`✅ Loaded ${recsData?.length || 0} margin recommendations`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  const startBenchmarkAnalysis = async () => {
    if (!selectedCarrier || !availableCarriers.includes(selectedCarrier)) {
      setError('Please select a valid carrier');
      return;
    }
    
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Please select a valid date range');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting benchmark analysis:', {
        dateRange,
        selectedCarrier,
        days: getDateRangeDays()
      });
      
      // Get unique customer-carrier pairs from shipment history
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('Shipments')
        .select('"Customer", "Booked Carrier", "Quoted Carrier"')
        .gte('"Scheduled Pickup Date"', dateRange.startDate)
        .lte('"Scheduled Pickup Date"', dateRange.endDate)
        .not('"Customer"', 'is', null);
      
      if (shipmentError) {
        throw shipmentError;
      }
      
      if (!shipmentData || shipmentData.length === 0) {
        throw new Error(`No shipments found in the selected date range (${dateRange.startDate} to ${dateRange.endDate})`);
      }
      
      console.log(`📦 Found ${shipmentData.length} shipments in the selected date range`);
      
      // Extract unique customer-carrier pairs
      const pairs = new Set<string>();
      shipmentData.forEach(shipment => {
        const customer = shipment.Customer;
        if (!customer) return;
        
        // Check both booked and quoted carriers
        const carriers = [shipment["Booked Carrier"], shipment["Quoted Carrier"]].filter(Boolean);
        
        carriers.forEach(carrier => {
          if (carrier && selectedCarrier) {
            // Find the carrier object to get the name
            const carrierObj = availableCarriers.find(c => c === selectedCarrier);
            if (carrierObj && (carrierObj === carrier)) {
              pairs.add(`${customer}|${carrier}`);
            }
          }
        });
      });
      
      console.log(`🔍 Found ${pairs.size} unique customer-carrier pairs for analysis`);
      
      if (pairs.size === 0) {
        throw new Error('No matching customer-carrier pairs found for the selected carrier');
      }
      
      // Create benchmark analysis jobs for each pair
      const jobs = Array.from(pairs).map(pair => {
        const [customer, carrier] = pair.split('|');
        return {
          customer_name: customer,
          carrier_name: carrier,
          analysis_type: 'benchmark',
          status: 'queued',
          created_at: new Date().toISOString(),
          shipment_count: shipmentData.filter(s => 
            s.Customer === customer && 
            (s["Booked Carrier"] === carrier || s["Quoted Carrier"] === carrier)
          ).length,
          date_range_start: dateRange.startDate,
          date_range_end: dateRange.endDate,
          selected_carriers: [selectedCarrier]
        };
      });
      
      // Insert jobs into Supabase
      const { error: insertError } = await supabase
        .from('MarginAnalysisJobs')
        .insert(jobs);
      
      if (insertError) {
        throw insertError;
      }
      
      console.log(`✅ Created ${jobs.length} benchmark analysis jobs`);
      
      await loadAnalysisData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start benchmark analysis');
    } finally {
      setLoading(false);
    }
  };

  const startComparisonAnalysis = async () => {
    if (!selectedCarrier) {
      setError('Please select a carrier for analysis');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting comparison analysis with new rates:', {
        dateRange,
        selectedCarrier
      });
      
      // Check if we have benchmark data for the selected carrier
      const { data: benchmarkJobs, error: benchmarkError } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .eq('analysis_type', 'benchmark')
        .eq('status', 'completed')
        .gte('date_range_start', dateRange.startDate)
        .lte('date_range_end', dateRange.endDate);
      
      if (benchmarkError) {
        throw benchmarkError;
      }
      
      if (!benchmarkJobs || benchmarkJobs.length === 0) {
        throw new Error('No completed benchmark analysis found for the selected date range. Please run benchmark analysis first.');
      }
      
      console.log(`📊 Found ${benchmarkJobs.length} completed benchmark jobs for comparison`);
      
      // Create comparison jobs for each benchmark
      const comparisonJobs = benchmarkJobs.map(benchmark => ({
        customer_name: benchmark.customer_name,
        carrier_name: benchmark.carrier_name,
        analysis_type: 'comparison',
        status: 'queued',
        created_at: new Date().toISOString(),
        shipment_count: benchmark.shipment_count,
        current_margin: benchmark.current_margin,
        date_range_start: benchmark.date_range_start,
        date_range_end: benchmark.date_range_end,
        selected_carriers: benchmark.selected_carriers,
        benchmark_data: benchmark.benchmark_data
      }));
      
      // Insert comparison jobs into Supabase
      const { error: insertError } = await supabase
        .from('MarginAnalysisJobs')
        .insert(comparisonJobs);
      
      if (insertError) {
        throw insertError;
      }
      
      console.log(`✅ Created ${comparisonJobs.length} comparison analysis jobs`);
      await loadAnalysisData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start comparison analysis');
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (recommendation: MarginRecommendation) => {
    try {
      console.log(`Applying margin recommendation: ${recommendation.customer_name} + ${recommendation.carrier_name} → ${recommendation.recommended_margin}%`);
      
      // Update the CustomerCarriers table with the new margin
      // First, check if the record exists
      const { data: existingData, error: queryError } = await supabase
        .from('CustomerCarriers')
        .select('MarkupId')
        .eq('InternalName', recommendation.customer_name)
        .eq('P44CarrierCode', recommendation.carrier_name)
        .limit(1);
      
      if (queryError) throw queryError;
      
      let error;
      
      if (existingData && existingData.length > 0) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('CustomerCarriers')
          .update({
            Percentage: recommendation.recommended_margin.toString()
          })
          .eq('MarkupId', existingData[0].MarkupId);
        
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('CustomerCarriers')
          .insert({
            InternalName: recommendation.customer_name,
            P44CarrierCode: recommendation.carrier_name,
            Percentage: recommendation.recommended_margin.toString()
          });
        
        error = insertError;
      }
      
      if (error) throw error;
      
      console.log('Margin recommendation applied successfully');
      await loadAnalysisData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply recommendation');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'running':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Analysis Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Analysis Configuration</h3>
            <p className="text-sm text-gray-600">Configure date range and carrier selection for margin analysis</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Range Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">Analysis Date Range</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-800">
                <strong>Analysis Period:</strong> {getDateRangeDays()} days
                <br />
                <strong>Range:</strong> {new Date(dateRange.startDate).toLocaleDateString()} - {new Date(dateRange.endDate).toLocaleDateString()}
              </div>
            </div>
            
            {/* Quick Date Range Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const endDate = new Date().toISOString().split('T')[0];
                  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setDateRange({ startDate, endDate });
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Last 90 Days
              </button>
              <button
                onClick={() => {
                  const endDate = new Date().toISOString().split('T')[0];
                  const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setDateRange({ startDate, endDate });
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Last 6 Months
              </button>
              <button
                onClick={() => {
                  const endDate = new Date().toISOString().split('T')[0];
                  const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setDateRange({ startDate, endDate });
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Last Year
              </button>
            </div>
          </div>
          
          {/* Carrier Selection Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Carrier Selection</h4>
              </div>
              {availableCarriers.length > 0 && (
                <button
                  onClick={() => setShowCarrierSelection(!showCarrierSelection)}
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                >
                  <Settings className="h-4 w-4" />
                  <span>{showCarrierSelection ? 'Hide' : 'Configure'}</span>
                </button>
              )}
            </div>
            
            {availableCarriers.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-800">
                  <strong>Selected Carrier:</strong> {getSelectedCarrierCount()} of {availableCarriers.length}
                </div>
                {getSelectedCarrierCount() > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedCarrier && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {selectedCarrier}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-600">
                  Select a customer to load available carriers
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Workflow */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Intelligent Margin Analysis Workflow</h3>
            <p className="text-blue-700 text-sm">Two-day analysis cycle for optimal margin determination</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Day 1: Benchmark */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <h4 className="font-semibold text-gray-900">Day 1: Benchmark Analysis</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>Run before rate changes</span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-blue-500" />
                <span>Analyze {getDateRangeDays()} days of shipments</span>
              </div>
              <div className="flex items-center space-x-2">
                <Archive className="h-4 w-4 text-blue-500" />
                <span>Store benchmark data in queue</span>
              </div>
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-blue-500" />
                <span>{getSelectedCarrierCount()} selected carrier</span>
              </div>
            </div>
            <button
              onClick={startBenchmarkAnalysis}
              disabled={loading || getSelectedCarrierCount() === 0}
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center space-x-2">
                {loading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>{loading ? 'Starting...' : 'Start Benchmark Analysis'}</span>
              </div>
            </button>
            {getSelectedCarrierCount() === 0 && (
              <p className="text-xs text-red-600 mt-2">Please select a carrier</p>
            )}
          </div>
          
          {/* Day 2: Comparison */}
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <h4 className="font-semibold text-gray-900">Day 2: Comparison Analysis</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-green-500" />
                <span>Run after rate changes</span>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span>Re-analyze with new rates</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-green-500" />
                <span>Generate margin recommendations</span>
              </div>
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-green-500" />
                <span>Same {getSelectedCarrierCount()} carrier</span>
              </div>
            </div>
            <button
              onClick={startComparisonAnalysis}
              disabled={loading || getSelectedCarrierCount() === 0}
              className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center space-x-2">
                {loading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span>{loading ? 'Starting...' : 'Start Comparison Analysis'}</span>
              </div>
            </button>
            {getSelectedCarrierCount() === 0 && (
              <p className="text-xs text-red-600 mt-2">Please select a carrier</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">
                {analysisJobs.filter(j => j.status === 'running').length}
              </p>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {analysisJobs.filter(j => j.status === 'completed').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recommendations</p>
              <p className="text-2xl font-bold text-gray-900">{recommendations.length}</p>
            </div>
            <Target className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Potential Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(recommendations.reduce((sum, r) => sum + r.potential_revenue_impact, 0))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Analysis Activity</h3>
        <div className="space-y-3">
          {analysisJobs.slice(0, 5).map((job) => (
            <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {getStatusIcon(job.status)}
                <div>
                  <div className="font-medium text-gray-900">
                    {job.customer_name} + {job.carrier_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {job.analysis_type} • {job.shipment_count} shipments
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderQueue = () => (
    <div className="space-y-6">
      {/* Queue Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Queue</h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadAnalysisData}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Filter by customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Customers</option>
            {customerList.map(customer => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>
          
          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Carriers</option>
            {availableCarriers.map(carrier => (
              <option key={carrier} value={carrier}>{carrier}</option>
            ))}
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          
          <button
            onClick={() => {
              setCustomerFilter('');
              setCarrierFilter('');
              setStatusFilter('');
            }}
            className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Customer Selection - Only show if customer is selected */}
      {customerFilter && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
            <p className="text-sm text-gray-600 mt-1">
              Select a carrier that has existing margin data for {customerFilter}
            </p>
          </div>
          <div className="p-6">
            {isLoadingCarriers ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">Loading carriers...</span>
              </div>
            ) : availableCarriers.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Carriers Found</h3>
                <p className="text-gray-600">
                  No carriers found for customer "{customerFilter}". 
                  Please ensure there are customer-carrier relationships in the CustomerCarriers table.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Carriers ({availableCarriers.length})
                  </label>
                  <select
                    value={selectedCarrier}
                    onChange={(e) => setSelectedCarrier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a carrier...</option>
                    {availableCarriers.map(carrier => (
                      <option key={carrier} value={carrier}>
                        {carrier}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedCarrier && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Selected: {selectedCarrier} for customer {customerFilter}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="divide-y divide-gray-200">
          {analysisJobs
            .filter(job => 
              (!customerFilter || job.customer_name.toLowerCase().includes(customerFilter.toLowerCase())) &&
              (!carrierFilter || job.carrier_name.toLowerCase().includes(carrierFilter.toLowerCase())) &&
              (!statusFilter || job.status === statusFilter)
            )
            .map((job) => (
              <div key={job.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="font-semibold text-gray-900">
                        {job.customer_name} + {job.carrier_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {job.analysis_type} analysis • {job.shipment_count} shipments
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                        {job.status}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Created: {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedJob === job.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                {expandedJob === job.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Timeline</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Created: {new Date(job.created_at).toLocaleString()}</div>
                          {job.started_at && (
                            <div>Started: {new Date(job.started_at).toLocaleString()}</div>
                          )}
                          {job.completed_at && (
                            <div>Completed: {new Date(job.completed_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm font-medium text-gray-700">Analysis Details</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Shipments: {job.shipment_count}</div>
                          {job.date_range_start && job.date_range_end && (
                            <div>Period: {new Date(job.date_range_start).toLocaleDateString()} - {new Date(job.date_range_end).toLocaleDateString()}</div>
                          )}
                          {job.selected_carriers && (
                            <div>Carriers: {job.selected_carriers.length}</div>
                          )}
                          {job.current_margin && (
                            <div>Current Margin: {job.current_margin}%</div>
                          )}
                          {job.confidence_score && (
                            <div>Confidence: {(job.confidence_score * 100).toFixed(1)}%</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm font-medium text-gray-700">Results</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          {job.recommended_margin && (
                            <div>Recommended: {job.recommended_margin}%</div>
                          )}
                          {job.error_message && (
                            <div className="text-red-600">Error: {job.error_message}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  const renderRecommendations = () => (
    <div className="space-y-6">
      {/* Recommendations Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Margin Recommendations</h3>
            <p className="text-sm text-gray-600">AI-generated margin adjustments based on rate analysis</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {rec.customer_name} + {rec.carrier_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {rec.shipment_count} shipments • Avg value: {formatCurrency(rec.avg_shipment_value)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm text-gray-600">Confidence</div>
                  <div className="font-semibold text-gray-900">
                    {(rec.confidence_score * 100).toFixed(1)}%
                  </div>
                </div>
                <button
                  onClick={() => applyRecommendation(rec)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Apply
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Current Margin</div>
                <div className="text-2xl font-bold text-gray-900">{rec.current_margin}%</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">Recommended Margin</div>
                <div className="text-2xl font-bold text-green-700">{rec.recommended_margin}%</div>
                <div className="text-sm text-green-600">
                  {rec.recommended_margin > rec.current_margin ? '+' : ''}
                  {(rec.recommended_margin - rec.current_margin).toFixed(1)}%
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">Revenue Impact</div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(rec.potential_revenue_impact)}
                </div>
                <div className="text-sm text-blue-600">Annual estimate</div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 mb-1">Margin Variance</div>
                <div className="text-2xl font-bold text-purple-700">{rec.margin_variance}%</div>
                <div className="text-sm text-purple-600">Std deviation</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Analysis Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Shipment Count
            </label>
            <input
              type="number"
              value={analysisSettings.minShipmentCount}
              onChange={(e) => setAnalysisSettings({
                ...analysisSettings,
                minShipmentCount: parseInt(e.target.value) || 10
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Threshold
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={analysisSettings.confidenceThreshold}
              onChange={(e) => setAnalysisSettings({
                ...analysisSettings,
                confidenceThreshold: parseFloat(e.target.value) || 0.75
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Margin Change (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={analysisSettings.maxMarginChange}
              onChange={(e) => setAnalysisSettings({
                ...analysisSettings,
                maxMarginChange: parseFloat(e.target.value) || 5.0
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* Date Range Configuration */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Default Date Range Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Analysis period: {getDateRangeDays()} days
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Automated Analysis</div>
              <div className="text-sm text-gray-600">Run analysis automatically at scheduled times</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={analysisSettings.autoRunEnabled}
                onChange={(e) => setAnalysisSettings({
                  ...analysisSettings,
                  autoRunEnabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {analysisSettings.autoRunEnabled && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule Time (24h format)
              </label>
              <input
                type="time"
                value={analysisSettings.scheduleTime}
                onChange={(e) => setAnalysisSettings({
                  ...analysisSettings,
                  scheduleTime: e.target.value
                })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
        
        <div className="mt-6">
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Enterprise Margin Analysis</h1>
            <p className="text-sm text-gray-600">
              Optimize customer-carrier margins through comprehensive rate change analysis
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'queue', label: 'Analysis Queue', icon: Activity },
            { id: 'recommendations', label: 'Recommendations', icon: Target },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'queue' && renderQueue()}
      {activeTab === 'recommendations' && renderRecommendations()}
      {activeTab === 'settings' && renderSettings()}
    </div>
  );
};