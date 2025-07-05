import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Truck, 
  Users, 
  Building2, 
  Calendar, 
  RefreshCw, 
  Play, 
  Loader, 
  CheckCircle, 
  AlertCircle, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Download,
  FileText,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Target,
  Zap,
  Sparkles,
  Award
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { CarrierSelection } from './CarrierSelection';
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
  date_range_start?: string;
  date_range_end?: string;
  selected_carriers?: string[];
  recommended_margin?: number;
  current_margin?: number;
  confidence_score?: number;
  error_message?: string;
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
  is_customer_specific?: boolean;
}

export const MarginAnalysisTools: React.FC = () => {
  // UI state
  const [activeTab, setActiveTab] = useState<'analysis' | 'queue' | 'completed'>('analysis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Form state
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Data state
  const [customerList, setCustomerList] = useState<string[]>([]);
  const [carrierGroups, setCarrierGroups] = useState<any[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [customerCarriers, setCustomerCarriers] = useState<any[]>([]);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  // Jobs state
  const [queuedJobs, setQueuedJobs] = useState<MarginAnalysisJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<MarginAnalysisJob[]>([]);
  const [analysisResults, setAnalysisResults] = useState<CustomerResult[]>([]);

  useEffect(() => {
    loadCustomerList();
  }, []);

  // Load customer carriers when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerCarriers(selectedCustomer);
    } else {
      setCustomerCarriers([]);
    }
  }, [selectedCustomer]);

  const loadCustomerList = async () => {
    try {
      console.log('🔍 Loading customer list...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select('Customer')
        .not('Customer', 'is', null)
        .not('Customer', 'eq', '');
      
      if (error) {
        console.error('❌ Error loading customers:', error);
        return;
      }
      
      // Get unique customers
      const uniqueCustomers = [...new Set(data.map(row => row.Customer))].sort();
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers`);
      setCustomerList(uniqueCustomers);
    } catch (err) {
      console.error('❌ Failed to load customer list:', err);
    }
  };

  const loadCustomerCarriers = async (customerName: string) => {
    try {
      console.log(`🔍 Loading carriers for customer: ${customerName}`);
      
      const { data, error } = await supabase
        .rpc('get_customer_carriers_for_analysis', { customer_name: customerName });
      
      if (error) {
        console.error('❌ Error loading customer carriers:', error);
        return;
      }
      
      console.log(`✅ Loaded ${data.length} carriers for customer ${customerName}:`, data);
      setCustomerCarriers(data || []);
    } catch (err) {
      console.error('❌ Failed to load customer carriers:', err);
    }
  };

  const loadCarriers = async () => {
    try {
      console.log('🔍 Loading carriers...');

      // First query for Booked Carriers
      const { data: bookedData, error: bookedError } = await supabase
        .from('Shipments')
        .select('"Booked Carrier"')
        .not('Booked Carrier', 'is', null)
        .not('Booked Carrier', 'eq', '');
      
      if (bookedError) {
        console.error('❌ Error loading booked carriers:', bookedError);
        throw bookedError;
      }
      
      // Second query for Quoted Carriers
      const { data: quotedData, error: quotedError } = await supabase
        .from('Shipments')
        .select('"Quoted Carrier"')
        .not('Quoted Carrier', 'is', null)
        .not('Quoted Carrier', 'eq', '');
      
      if (quotedError) {
        console.error('❌ Error loading quoted carriers:', quotedError);
        throw quotedError;
      }
      
      // Get unique carriers from both booked and quoted carriers
      const allCarriers = [];
      
      // Add booked carriers
      bookedData.forEach(row => {
        if (row['Booked Carrier'] && row['Booked Carrier'].trim()) {
          allCarriers.push(row['Booked Carrier'].trim());
        }
      });
      
      // Add quoted carriers
      quotedData.forEach(row => {
        if (row['Quoted Carrier'] && row['Quoted Carrier'].trim()) {
          allCarriers.push(row['Quoted Carrier'].trim());
        }
      });
      
      const uniqueCarriers = [...new Set(allCarriers)].sort();
      console.log(`✅ Loaded ${uniqueCarriers.length} unique carriers`);
      
      // Convert to carrier groups format for compatibility
      const carrierGroup = {
        groupCode: 'ALL',
        groupName: 'All Carriers',
        carriers: uniqueCarriers.map(carrier => ({
          id: carrier,
          name: carrier,
          scac: carrier
        }))
      };
      
      setCarrierGroups([carrierGroup]);
    } catch (err) {
      console.error('❌ Failed to load carriers:', err);
    }
  };

  // Helper function to get margin for a carrier
  const getMarginForCarrier = (carrierName: string): number => {
    if (!selectedCustomer || customerCarriers.length === 0) {
      return 23; // Default fallback margin
    }
    
    // Try to find an exact match
    const exactMatch = customerCarriers.find(c => 
      c.carrier_code.toLowerCase() === carrierName.toLowerCase()
    );
    
    if (exactMatch) {
      console.log(`✅ Found exact margin match for ${carrierName}: ${exactMatch.margin_percentage}%`);
      return exactMatch.margin_percentage;
    }
    
    // Try to find a partial match
    const partialMatch = customerCarriers.find(c => 
      c.carrier_code.toLowerCase().includes(carrierName.toLowerCase()) ||
      carrierName.toLowerCase().includes(c.carrier_code.toLowerCase())
    );
    
    if (partialMatch) {
      console.log(`✅ Found partial margin match for ${carrierName}: ${partialMatch.margin_percentage}%`);
      return partialMatch.margin_percentage;
    }
    
    console.log(`⚠️ No margin found for ${carrierName}, using fallback 23%`);
    return 23; // Default fallback margin
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

  const handleStartAnalysis = async () => {
    if (!Object.values(selectedCarriers).some(Boolean)) {
      setError('Please select a carrier to analyze');
      return;
    }

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    try {
      setIsAnalyzing(true);
      setError('');
      
      // Get the margin percentage for the selected carrier
      const selectedCarrierName = Object.entries(selectedCarriers)
        .filter(([_, selected]) => selected)
        .map(([id, _]) => {
          const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
          return carrier?.name || id;
        })[0] || '';
      
      const marginPercentage = getMarginForCarrier(selectedCarrierName);
      console.log(`🔍 Using margin percentage for analysis: ${marginPercentage}%`);

      // Create a new analysis job
      const { data, error } = await supabase
        .from('MarginAnalysisJobs')
        .insert({
          customer_name: selectedCustomer || 'All Customers',
          carrier_name: selectedCarrierName,
          analysis_type: 'benchmark',
          status: 'running',
          shipment_count: 0,
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          selected_carriers: selectedCarrierIds,
          current_margin: marginPercentage
        })
        .select()
        .single();

      if (error) throw error;

      setAnalysisJobId(data.id);
      console.log('✅ Analysis job created:', data.id);

      // Start the analysis process
      await runAnalysis(data.id);

    } catch (err) {
      console.error('❌ Failed to start analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setIsAnalyzing(false);
    }
  };

  const runAnalysis = async (jobId: string) => {
    try {
      // Simulate analysis progress
      for (let i = 0; i <= 100; i += 10) {
        setAnalysisProgress(i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Mark job as completed
      await supabase
        .from('MarginAnalysisJobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percentage: 100
        })
        .eq('id', jobId);

      // Generate mock results
      const mockResults: CustomerResult[] = [
        {
          customer_name: selectedCustomer || 'Sample Customer',
          shipment_count: 45,
          avg_carrier_quote: 1250.00,
          avg_revenue: 1625.00,
          total_profit: 16875.00,
          current_margin_percentage: 23.0,
          margin_category: 'Target Margin',
          is_customer_specific: !!selectedCustomer
        }
      ];

      setAnalysisResults(mockResults);
      setIsAnalyzing(false);
      setAnalysisJobId(null);
      setAnalysisProgress(0);

    } catch (err) {
      console.error('❌ Analysis failed:', err);
      setError('Analysis failed');
      setIsAnalyzing(false);
    }
  };

  const renderAnalysisTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Margin Analysis</h2>
            <p className="text-sm text-gray-600">
              Analyze carrier margins and identify optimization opportunities
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer (Optional)</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customerList.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier Selection</label>
            {carrierGroups.length === 0 ? (
              <button
                onClick={loadCarriers}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Truck className="h-4 w-4" />
                  <span>Load Available Carriers</span>
                </div>
              </button>
            ) : (
              <div className="text-sm text-gray-600">
                {Object.values(selectedCarriers).filter(Boolean).length === 1 ? (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Truck className="h-4 w-4" />
                    <span>
                      {Object.entries(selectedCarriers)
                        .filter(([_, selected]) => selected)
                        .map(([id, _]) => {
                          const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
                          return carrier?.name || id;
                        })[0]}
                    </span>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    {Object.values(selectedCarriers).filter(Boolean).length} carriers selected
                  </div>
                )}
              </div>
            )}
          </div>
          
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
        </div>
      </div>
      
      {/* Carrier Selection */}
      {carrierGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Select Carrier for Analysis</h3>
            <p className="text-sm text-gray-600">Choose one carrier to analyze margin performance</p>
          </div>
          <div className="p-6">
            <CarrierSelection
              carrierGroups={carrierGroups}
              selectedCarriers={selectedCarriers}
              onToggleCarrier={handleCarrierToggle}
              onSelectAll={handleSelectAll}
              onSelectAllInGroup={handleSelectAllInGroup}
              isLoading={false}
              singleSelect={true}
            />
          </div>
        </div>
      )}

      {/* Analysis Summary */}
      {(selectedCustomer || Object.values(selectedCarriers).some(Boolean)) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {selectedCustomer || 'All Customers'} 
                    {selectedCustomer && customerCarriers.length > 0 && (
                      <span className="text-xs text-blue-600 ml-2">
                        ({customerCarriers.length} carrier margins available)
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {Object.entries(selectedCarriers)
                      .filter(([_, selected]) => selected)
                      .map(([id, _]) => {
                        const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
                        return carrier?.name || id;
                      })[0] || 'No carrier selected'}
                  </span>
                  {selectedCustomer && Object.values(selectedCarriers).some(Boolean) && (
                    <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {getMarginForCarrier(Object.entries(selectedCarriers)
                        .filter(([_, selected]) => selected)
                        .map(([id, _]) => {
                          const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
                          return carrier?.name || id;
                        })[0] || '')}% margin
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {dateRange.start} to {dateRange.end}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing || !Object.values(selectedCarriers).some(Boolean)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Start Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress */}
      {isAnalyzing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="h-5 w-5 text-blue-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900">Analysis in Progress</h3>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${analysisProgress}%` }}
            ></div>
          </div>
          
          <p className="text-sm text-gray-600">
            {analysisProgress}% complete - Analyzing shipment data and calculating margins...
          </p>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
          
          <div className="space-y-4">
            {analysisResults.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{result.customer_name}</span>
                      {result.is_customer_specific && (
                        <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          Custom Margin
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {Object.entries(selectedCarriers)
                          .filter(([_, selected]) => selected)
                          .map(([id, _]) => {
                            const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
                            return carrier?.name || id;
                          })[0] || 'No carrier selected'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {formatCurrency(result.avg_carrier_quote)} avg cost • 
                        {formatCurrency(result.avg_revenue)} avg revenue
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {result.current_margin_percentage.toFixed(1)}% margin • 
                        {formatCurrency(result.total_profit)} total profit
                      </span>
                    </div>
                  </div>
                  
                  <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                    result.margin_category === 'Low Margin' ? 'bg-red-100 text-red-800' :
                    result.margin_category === 'Target Margin' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {result.margin_category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderQueueTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Analysis Queue</h2>
            <p className="text-sm text-gray-600">
              Jobs waiting to be processed ({queuedJobs.length} queued)
            </p>
          </div>
        </div>
      </div>

      {/* Queued Jobs */}
      {queuedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs in Queue</h3>
          <p className="text-gray-600">Start an analysis to add jobs to the queue.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queuedJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {job.customer_name} - {job.carrier_name}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Queued
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
                      <span className="text-gray-500">Shipments:</span>
                      <div className="font-medium">{job.shipment_count}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <div className="font-medium text-orange-600">{job.status}</div>
                    </div>
                  </div>
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
              Finished analysis jobs ({completedJobs.length} completed)
            </p>
          </div>
        </div>
      </div>

      {/* Completed Jobs */}
      {completedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Analysis</h3>
          <p className="text-gray-600">Complete an analysis to see results here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completedJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {job.customer_name} - {job.carrier_name}
                      </h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completed
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Completed:</span>
                        <div className="font-medium">{new Date(job.completed_at!).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Shipments:</span>
                        <div className="font-medium">{job.shipment_count}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Margin:</span>
                        <div className="font-medium">{job.current_margin}%</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Recommended:</span>
                        <div className="font-medium">{job.recommended_margin}%</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Confidence:</span>
                        <div className="font-medium">{job.confidence_score}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Job Results */}
              <div className="border-t border-gray-200 p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Analysis Results</h4>
                
                <div className="space-y-4">
                  {analysisResults.filter(result => 
                    result.customer_name === job.customer_name
                  ).map((result, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{result.customer_name}</span>
                          {result.is_customer_specific && (
                            <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              Custom Margin
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{job.carrier_name}</span>
                          {job.current_margin && (
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              {job.current_margin}% margin
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {formatCurrency(result.avg_carrier_quote)} avg cost • 
                            {formatCurrency(result.avg_revenue)} avg revenue
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {result.current_margin_percentage.toFixed(1)}% margin • 
                            {formatCurrency(result.total_profit)} total profit
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
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
            { id: 'analysis', label: 'New Analysis', icon: Calculator },
            { id: 'queue', label: 'Queue', icon: Clock, count: queuedJobs.length },
            { id: 'completed', label: 'Completed', icon: CheckCircle, count: completedJobs.length }
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
                {tab.count !== undefined && tab.count > 0 && (
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
      {activeTab === 'analysis' && renderAnalysisTab()}
      {activeTab === 'queue' && renderQueueTab()}
      {activeTab === 'completed' && renderCompletedTab()}
    </div>
  );
};