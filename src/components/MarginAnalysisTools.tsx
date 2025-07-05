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
import { CarrierGroup } from '../utils/apiClient';

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
  
  // Carrier selection
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);
  const [showCarrierSelection, setShowCarrierSelection] = useState(false);
  
  // Filters
  const [customerFilter, setCustomerFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadCarriers = async () => {
    setIsLoadingCarriers(true);
    try {
      // Mock carrier data - replace with actual API call
      const mockCarrierGroups: CarrierGroup[] = [
        {
          groupCode: 'LTL_CARRIERS',
          groupName: 'LTL Carriers',
          carriers: [
            { id: 'FXFE', name: 'FedEx Freight', scac: 'FXFE' },
            { id: 'ODFL', name: 'Old Dominion Freight Line', scac: 'ODFL' },
            { id: 'SAIA', name: 'Saia LTL Freight', scac: 'SAIA' },
            { id: 'RLCA', name: 'R+L Carriers', scac: 'RLCA' },
            { id: 'ABFS', name: 'ABF Freight', scac: 'ABFS' },
            { id: 'EXLA', name: 'Estes Express Lines', scac: 'EXLA' }
          ]
        }
      ];
      
      setCarrierGroups(mockCarrierGroups);
      setCarriersLoaded(true);
      console.log('✅ Loaded carriers for margin analysis');
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
      setError('Failed to load carriers');
    } finally {
      setIsLoadingCarriers(false);
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

  const getSelectedCarrierCount = () => {
    return Object.values(selectedCarriers).filter(Boolean).length;
  };

  const getDateRangeDays = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };
  const loadAnalysisData = async () => {
    setLoading(true);
    try {
      // Load analysis jobs and recommendations
      // This would connect to your analysis queue system
      console.log('Loading margin analysis data...');
      
      // Mock data for now - replace with actual Supabase queries
      setAnalysisJobs([
        {
          id: '1',
          customer_name: 'ACME Corp',
          carrier_name: 'FedEx Freight',
          analysis_type: 'benchmark',
          status: 'completed',
          created_at: '2025-01-15T02:00:00Z',
          completed_at: '2025-01-15T02:45:00Z',
          shipment_count: 156,
          current_margin: 18.5,
          confidence_score: 0.87,
          date_range_start: '2024-01-01',
          date_range_end: '2024-12-31',
          selected_carriers: ['FXFE', 'ODFL', 'SAIA']
        },
        {
          id: '2',
          customer_name: 'ACME Corp',
          carrier_name: 'FedEx Freight',
          analysis_type: 'comparison',
          status: 'running',
          created_at: '2025-01-16T02:00:00Z',
          started_at: '2025-01-16T02:00:00Z',
          shipment_count: 156,
          current_margin: 18.5,
          date_range_start: '2024-01-01',
          date_range_end: '2024-12-31',
          selected_carriers: ['FXFE', 'ODFL', 'SAIA']
        }
      ]);
      
      setRecommendations([
        {
          customer_name: 'ACME Corp',
          carrier_name: 'FedEx Freight',
          current_margin: 18.5,
          recommended_margin: 21.2,
          confidence_score: 0.87,
          potential_revenue_impact: 12500,
          shipment_count: 156,
          avg_shipment_value: 1850,
          margin_variance: 2.3,
          last_updated: '2025-01-16T02:45:00Z'
        }
      ]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  const startBenchmarkAnalysis = async () => {
    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
    
    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier for analysis');
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
        selectedCarriers: selectedCarrierIds,
        days: getDateRangeDays()
      });
      
      // This would trigger the benchmark analysis job
      // Query all unique customer-carrier pairs from shipment history
      // Queue benchmark analysis jobs for each pair
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      console.log(`Benchmark analysis jobs queued for ${selectedCarrierIds.length} carriers over ${getDateRangeDays()} days`);
      await loadAnalysisData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start benchmark analysis');
    } finally {
      setLoading(false);
    }
  };

  const startComparisonAnalysis = async () => {
    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
    
    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier for analysis');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting comparison analysis with new rates:', {
        dateRange,
        selectedCarriers: selectedCarrierIds
      });
      
      // This would trigger the comparison analysis job
      // Use the same historical data but with current/new rates
      // Compare against benchmark data to generate recommendations
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      console.log(`Comparison analysis jobs queued for ${selectedCarrierIds.length} carriers`);
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
      const { error } = await supabase
        .from('CustomerCarriers')
        .upsert({
          InternalName: recommendation.customer_name,
          P44CarrierCode: recommendation.carrier_name,
          Percentage: recommendation.recommended_margin.toString(),
          updated_at: new Date().toISOString()
        });
      
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
              {carriersLoaded && (
                <button
                  onClick={() => setShowCarrierSelection(!showCarrierSelection)}
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                >
                  <Settings className="h-4 w-4" />
                  <span>{showCarrierSelection ? 'Hide' : 'Configure'}</span>
                </button>
              )}
            </div>
            
            {carriersLoaded ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-800">
                  <strong>Selected Carriers:</strong> {getSelectedCarrierCount()} of {carrierGroups.reduce((sum, group) => sum + group.carriers.length, 0)}
                </div>
                {getSelectedCarrierCount() > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(selectedCarriers)
                      .filter(([_, selected]) => selected)
                      .slice(0, 5)
                      .map(([carrierId, _]) => {
                        const carrier = carrierGroups
                          .flatMap(g => g.carriers)
                          .find(c => c.id === carrierId);
                        return (
                          <span key={carrierId} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {carrier?.name || carrierId}
                          </span>
                        );
                      })}
                    {getSelectedCarrierCount() > 5 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        +{getSelectedCarrierCount() - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-600">
                  Load carriers to configure selection for analysis
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Carrier Selection Panel */}
        {showCarrierSelection && carriersLoaded && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <CarrierSelection
              carrierGroups={carrierGroups}
              selectedCarriers={selectedCarriers}
              onToggleCarrier={handleCarrierToggle}
              onSelectAll={handleSelectAll}
              onSelectAllInGroup={handleSelectAllInGroup}
              isLoading={isLoadingCarriers}
            />
          </div>
        )}
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
                <span>{getSelectedCarrierCount()} selected carriers</span>
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
              <p className="text-xs text-red-600 mt-2">Please select at least one carrier</p>
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
                <span>Same {getSelectedCarrierCount()} carriers</span>
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
              <p className="text-xs text-red-600 mt-2">Please select at least one carrier</p>
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
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Filter by customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <input
            type="text"
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            placeholder="Filter by carrier..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
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
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              AI-powered customer-carrier margin optimization through rate change analysis
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