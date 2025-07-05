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
import { Project44APIClient } from '../utils/apiClient';
import { PricingSettings } from '../types';

interface MarginAnalysisJob {
  id: string;
  customer_name: string;
  carrier_name: string;
  analysis_type: string;
  status: string;
  shipment_count: number;
  date_range_start: string;
  date_range_end: string;
  selected_carriers: string[];
  current_margin?: number;
  recommended_margin?: number;
  potential_savings?: number;
  created_at: string;
  completed_at?: string;
}

interface CustomerResult {
  customer_name: string;
  carrier_name: string;
  current_margin: number;
  recommended_margin: number;
  potential_savings: number;
  shipment_count: number;
  avg_shipment_value: number;
  confidence_score: number;
  margin_variance: number;
  margin_category: string;
  is_customer_specific?: boolean;
}

interface CustomerSummary {
  customer_name: string;
  shipment_count: number;
  total_cost: number;
  total_price: number;
  total_profit: number;
  margin_percentage: number;
}

export const MarginAnalysisTools: React.FC = () => {
  // UI state
  const [activeTab, setActiveTab] = useState<'analysis' | 'queue' | 'completed'>('analysis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Form state
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('All Customers');
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
  
  // Customer summary state
  const [customerSummaries, setCustomerSummaries] = useState<CustomerSummary[]>([]);
  const [isLoadingCustomerData, setIsLoadingCustomerData] = useState(false);
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);

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
  
  // Initialize Project44 client when component mounts
  useEffect(() => {
    const initProject44Client = async () => {
      try {
        // Load Project44 config from local storage
        const savedConfig = localStorage.getItem('project44_config');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          console.log('✅ Loaded saved Project44 config');
          const client = new Project44APIClient(config);
          setProject44Client(client);
        }
      } catch (error) {
        console.error('❌ Failed to initialize Project44 client:', error);
      }
    };
    
    initProject44Client();
  }, []);

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

  const loadCarriers = async () => {
    try {
      console.log('🚛 Loading carriers...');
      
      // Get unique carriers from shipments
      const { data, error } = await supabase
        .from('Shipments')
        .select('Carrier')
        .not('Carrier', 'is', null)
        .not('Carrier', 'eq', '');
      
      if (error) throw error;
      
      const uniqueCarriers = [...new Set(data.map(row => row.Carrier))].sort();
      
      // Create carrier groups structure
      const groups = [{
        groupCode: 'ALL',
        groupName: 'All Carriers',
        carriers: uniqueCarriers.map((carrier, index) => ({
          id: `carrier_${index}`,
          name: carrier,
          scac: carrier.substring(0, 4).toUpperCase()
        }))
      }];
      
      setCarrierGroups(groups);
      console.log(`✅ Loaded ${uniqueCarriers.length} carriers`);
    } catch (err) {
      console.error('❌ Failed to load carriers:', err);
      setError('Failed to load carriers');
    }
  };

  const loadCustomerCarriers = async (customer: string) => {
    if (customer === 'All Customers') {
      setCustomerCarriers([]);
      return;
    }

    try {
      console.log(`🔍 Loading carriers for customer: ${customer}`);
      
      const { data, error } = await supabase
        .from('CustomerCarrierMargins')
        .select('*')
        .eq('customer_name', customer);
      
      if (error) throw error;
      
      setCustomerCarriers(data || []);
      console.log(`✅ Loaded ${data?.length || 0} carrier margins for ${customer}`);
    } catch (err) {
      console.error('❌ Failed to load customer carriers:', err);
      setCustomerCarriers([]);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach((carrier: any) => {
        newSelection[carrier.id] = selected;
      });
    });
    setSelectedCarriers(newSelection);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    const newSelection = { ...selectedCarriers };
    group.carriers.forEach((carrier: any) => {
      newSelection[carrier.id] = selected;
    });
    setSelectedCarriers(newSelection);
  };

  // Helper function to get margin for a carrier
  const getMarginForCarrier = (carrierName: string): number => {
    if (!selectedCustomer || customerCarriers.length === 0) {
      return 23; // Default margin
    }

    const carrierMargin = customerCarriers.find(cc => cc.carrier_name === carrierName);
    return carrierMargin ? carrierMargin.margin_percentage : 23;
  };

  // Helper function to get selected carrier name
  const getSelectedCarrierName = (): string => {
    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) return '';

    const carrierId = selectedCarrierIds[0]; // Get first selected carrier
    const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === carrierId);
    return carrier ? carrier.name : '';
  };

  const runAnalysisForAllCustomers = async () => {
    if (!selectedCarrier) {
      setError('Please select a carrier to analyze');
      return;
    }
    
    if (!project44Client) {
      setError('Project44 client not available. Please check your API configuration.');
      return;
    }

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
      
    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError('');
      setCustomerSummaries([]);
      
      console.log('🔍 Running analysis for all customers with carrier:', selectedCarrier);
      
      // Get all customers from the database
      const { data: customersData, error: customersError } = await supabase
        .from('Shipments')
        .select('Customer')
        .not('Customer', 'is', null)
        .not('Customer', 'eq', '');
      
      if (customersError) throw customersError;
      
      // Get unique customers
      const uniqueCustomers = [...new Set(customersData.map(row => row.Customer))];
      console.log(`✅ Found ${uniqueCustomers.length} unique customers`);
      
      // Create a summary for each customer
      const summaries: CustomerSummary[] = [];
      
      // Set progress tracking
      setAnalysisProgress(0);
      const totalCustomers = uniqueCustomers.length;
      
      // Process each customer
      for (let i = 0; i < uniqueCustomers.length; i++) {
        const customer = uniqueCustomers[i];
        setAnalysisProgress(Math.round((i / totalCustomers) * 100));
        
        try {
          // Get the margin percentage for this customer and carrier
          const marginPercentage = getMarginForCarrier(selectedCarrier);
          
          // Create pricing settings with this margin
          const pricingSettings: PricingSettings = {
            markupPercentage: marginPercentage,
            minimumProfit: 100,
            markupType: 'percentage',
            usesCustomerMargins: true,
            fallbackMarkupPercentage: marginPercentage
          };
          
          // Get shipments for this customer
          const { data: shipments, error: shipmentsError } = await supabase
            .from('Shipments')
            .select('*')
            .eq('Customer', customer)
            .gte('Scheduled Pickup Date', dateRange.start)
            .lte('Scheduled Pickup Date', dateRange.end);
          
          if (shipmentsError) throw shipmentsError;
          
          if (!shipments || shipments.length === 0) {
            console.log(`⚠️ No shipments found for customer: ${customer}`);
            continue;
          }
          
          console.log(`✅ Found ${shipments.length} shipments for customer: ${customer}`);
          
          // Calculate totals
          let totalCost = 0;
          let totalPrice = 0;
          
          shipments.forEach(shipment => {
            // Parse numeric values from string fields
            const parseNumeric = (value: string | null | undefined): number => {
              if (!value) return 0;
              const cleaned = value.toString().replace(/[^\d.-]/g, '');
              return parseFloat(cleaned) || 0;
            };
            
            const carrierQuote = parseNumeric(shipment["Carrier Quote"]);
            const revenue = parseNumeric(shipment["Revenue"]);
            
            totalCost += carrierQuote;
            totalPrice += revenue;
          });
          
          const totalProfit = totalPrice - totalCost;
          const calculatedMarginPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
          
          // Add to summaries
          summaries.push({
            customer_name: customer,
            shipment_count: shipments.length,
            total_cost: totalCost,
            total_price: totalPrice,
            total_profit: totalProfit,
            margin_percentage: calculatedMarginPercentage
          });
          
          console.log(`✅ Processed customer: ${customer} - Margin: ${calculatedMarginPercentage.toFixed(2)}%`);
          
        } catch (customerError) {
          console.error(`❌ Error processing customer ${customer}:`, customerError);
          // Continue with next customer
        }
      }
      
      // Sort summaries by total profit (descending)
      summaries.sort((a, b) => b.total_profit - a.total_profit);
      
      setCustomerSummaries(summaries);
      setAnalysisProgress(100);

    } catch (err) {
      console.error('❌ Failed to start analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
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

      // Update job status
      await supabase
        .from('MarginAnalysisJobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      console.log('✅ Analysis completed');
      loadJobs();
    } catch (err) {
      console.error('❌ Analysis failed:', err);
      
      // Update job status to failed
      await supabase
        .from('MarginAnalysisJobs')
        .update({ status: 'failed' })
        .eq('id', jobId);
    }
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const queued = data.filter(job => job.status === 'running' || job.status === 'queued');
      const completed = data.filter(job => job.status === 'completed' || job.status === 'failed');

      setQueuedJobs(queued);
      setCompletedJobs(completed);
    } catch (err) {
      console.error('❌ Failed to load jobs:', err);
    }
  };

  const renderAnalysisTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Margin Analysis</h2>
            <p className="text-sm text-gray-600">
              Analyze carrier margins and identify optimization opportunities
              across all customers
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer (Optional)</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="All Customers">All Customers</option>
              {customerList.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))} 
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier</label>
            {carrierGroups.length === 0 ? (
              <button
                onClick={loadCarriers}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Truck className="h-4 w-4" />
                  <span>Load Carriers</span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setSelectedCarrier(getSelectedCarrierName())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Load Carriers
              </button>
            )}
          </div> */}
          
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
        
        {/* Carrier Selection */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Carrier for Analysis</h3>
          
          {carrierGroups.length === 0 ? (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="text-center">
                <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Carriers Loaded</h3>
                <button
                  onClick={loadCarriers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Load Carriers
                </button>
              </div>
            </div>
          ) : (
            <CarrierSelection
              carrierGroups={carrierGroups}
              selectedCarriers={selectedCarriers}
              onToggleCarrier={handleCarrierToggle}
              onSelectAll={handleSelectAll}
              onSelectAllInGroup={handleSelectAllInGroup}
              isLoading={false}
              singleSelect={true}
            />
          )}
        </div>
      </div>

      {/* Analysis Summary */}
      {selectedCarrier && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {selectedCustomer}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {getSelectedCarrierName() || 'No carrier selected'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {dateRange.start} to {dateRange.end}
                  </span>
                </div>
              </div>
              
              <button
                onClick={runAnalysisForAllCustomers}
                disabled={isAnalyzing || !selectedCarrier}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4" />
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
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">{analysisProgress}% complete</p>
        </div>
      )}

      {/* Customer Summaries */}
      {customerSummaries.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Customer Summaries</h3>
            <div className="text-sm text-gray-600">
              {customerSummaries.length} customers analyzed
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customerSummaries.map((summary, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {summary.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {summary.shipment_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(summary.total_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(summary.total_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(summary.total_profit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        summary.margin_percentage < 15 ? 'bg-red-100 text-red-800' :
                        summary.margin_percentage < 25 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {summary.margin_percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carrier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recommended</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Savings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analysisResults.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.carrier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.current_margin.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.recommended_margin.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(result.potential_savings)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        result.confidence_score >= 80 ? 'bg-green-100 text-green-800' :
                        result.confidence_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.confidence_score}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderQueueTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Analysis Queue</h2>
            <p className="text-sm text-gray-600">
              {queuedJobs.length} jobs in queue
            </p>
          </div>
        </div>
      </div>

      {queuedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs in Queue</h3>
          <p className="text-gray-600">Start an analysis to see jobs here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queuedJobs.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{job.customer_name}</h3>
                  <p className="text-sm text-gray-600">{job.carrier_name}</p>
                  <p className="text-xs text-gray-500">
                    {job.date_range_start} to {job.date_range_end}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    job.status === 'running' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {job.status}
                  </span>
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Completed Analysis</h2>
            <p className="text-sm text-gray-600">
              {completedJobs.length} completed jobs
            </p>
          </div>
        </div>
      </div>

      {completedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Jobs</h3>
          <p className="text-gray-600">Completed analysis jobs will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completedJobs.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{job.customer_name}</h3>
                  <p className="text-sm text-gray-600">{job.carrier_name}</p>
                  <p className="text-xs text-gray-500">
                    Completed: {job.completed_at ? new Date(job.completed_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {job.status}
                  </span>
                  {job.potential_savings && (
                    <p className="text-sm font-medium text-green-600 mt-1">
                      {formatCurrency(job.potential_savings)} potential savings
                    </p>
                  )}
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
            { id: 'analysis', label: 'New Analysis', icon: BarChart3 },
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