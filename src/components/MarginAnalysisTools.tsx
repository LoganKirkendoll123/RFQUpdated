import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Building2, 
  BarChart3,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader,
  Target,
  Percent,
  Calendar,
  Search,
  Filter,
  Info
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface CustomerCarrierMargin {
  MarkupId: number;
  CarrierId?: number;
  CustomerID?: number;
  InternalName?: string;
  P44CarrierCode?: string;
  MinDollar?: number;
  MaxDollar?: string;
  Percentage?: string;
}

interface Shipment {
  "Invoice #": number;
  "Customer"?: string;
  "Branch"?: string;
  "Scheduled Pickup Date"?: string;
  "Actual Pickup Date"?: string;
  "Scheduled Delivery Date"?: string;
  "Actual Delivery Date"?: string;
  "Origin City"?: string;
  "State"?: string;
  "Zip"?: string;
  "Destination City"?: string;
  "State_1"?: string;
  "Zip_1"?: string;
  "Sales Rep"?: string;
  "Account Rep"?: string;
  "Dispatch Rep"?: string;
  "Quote Created By"?: string;
  "Line Items"?: number;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Max Freight Class"?: string;
  "Max Length"?: string;
  "Max Width"?: string;
  "Max Height"?: string;
  "Tot Linear Ft"?: string;
  "Is VLTL"?: string;
  "Commodities"?: string;
  "Accessorials"?: string;
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Service Level"?: string;
  "Revenue"?: string;
  "Carrier Quote"?: string;
  "Carrier Expense"?: string;
  "Other Expense"?: string;
  "Profit"?: string;
  "Revenue w/o Accessorials"?: string;
  "Expense w/o Accessorials"?: string;
}

interface MarginAnalysis {
  targetRate: number;
  competitorCosts: number[];
  validCompetitorCosts: number[];
  filteredCompetitorCosts: number[];
  markedUpRate: number;
  averageCompetitorCost: number;
  shipmentId: string;
  customerName: string;
  carrierCode: string;
}

interface CustomerAnalysis {
  customerName: string;
  totalTargetRates: number;
  totalAverageCompetitorCosts: number;
  recommendedMargin: number;
  shipmentCount: number;
  analyses: MarginAnalysis[];
}

export const MarginAnalysisTools: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Data state
  const [customerCarrierMargins, setCustomerCarrierMargins] = useState<CustomerCarrierMargin[]>([]);
  const [shipmentData, setShipmentData] = useState<Shipment[]>([]);
  const [marginAnalyses, setMarginAnalyses] = useState<MarginAnalysis[]>([]);
  const [customerAnalyses, setCustomerAnalyses] = useState<CustomerAnalysis[]>([]);
  
  // Filter state
  const [startDate, setStartDate] = useState('2025-07-03');
  const [endDate, setEndDate] = useState('2025-07-04');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerList, setCustomerList] = useState<string[]>([]);
  
  // Analysis parameters
  const [targetMargin, setTargetMargin] = useState(0.15); // 15%
  const [outlierThreshold, setOutlierThreshold] = useState(2.0); // 2 standard deviations
  const [minCompetitors, setMinCompetitors] = useState(3); // Minimum competitors needed
  
  // UI state
  const [activeTab, setActiveTab] = useState<'setup' | 'shipment-analysis' | 'customer-analysis'>('setup');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Loading initial data for margin analysis...');
      
      // Load customer-carrier margin configurations - REMOVED LIMIT
      console.log('📋 Loading customer-carrier margin configurations...');
      const { data: marginData, error: marginError } = await supabase
        .from('CustomerCarriers')
        .select('*')
        .order('"MarkupId"', { ascending: true });
      
      if (marginError) {
        console.error('❌ Error loading customer-carrier margins:', marginError);
        throw marginError;
      }
      
      setCustomerCarrierMargins(marginData || []);
      console.log(`✅ Loaded ${marginData?.length || 0} customer-carrier margin configurations`);
      
      // Load customer list
      console.log('👥 Loading customer list...');
      const { data: customerData, error: customerError } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null);
      
      if (customerError) {
        console.error('❌ Error loading customers:', customerError);
        throw customerError;
      }
      
      const uniqueCustomers = [...new Set(customerData?.map(d => d.Customer).filter(Boolean) || [])];
      setCustomerList(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load initial data';
      setError(errorMsg);
      console.error('❌ Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadShipmentData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📦 Loading shipment data for analysis...');
      
      let query = supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', startDate)
        .lte('"Scheduled Pickup Date"', endDate)
        .order('"Scheduled Pickup Date"', { ascending: false });
      
      if (selectedCustomer) {
        query = query.eq('"Customer"', selectedCustomer);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error loading shipment data:', error);
        throw error;
      }
      
      setShipmentData(data || []);
      console.log(`✅ Loaded ${data?.length || 0} shipments for analysis`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load shipment data';
      setError(errorMsg);
      console.error('❌ Failed to load shipment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const runMarginAnalysis = async () => {
    if (shipmentData.length === 0) {
      setError('No shipment data loaded. Please load shipment data first.');
      return;
    }
    
    if (customerCarrierMargins.length === 0) {
      setError('No customer-carrier margin configurations found.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🧮 Running margin analysis...');
      console.log(`📊 Processing ${shipmentData.length} shipments with ${customerCarrierMargins.length} margin configurations`);
      
      const analyses: MarginAnalysis[] = [];
      
      for (const shipment of shipmentData) {
        const customerName = shipment["Customer"];
        const bookedCarrier = shipment["Booked Carrier"];
        const quotedCarrier = shipment["Quoted Carrier"];
        const revenue = parseFloat(shipment["Revenue"] || '0');
        const carrierExpense = parseFloat(shipment["Carrier Expense"] || '0');
        
        if (!customerName || !revenue || revenue <= 0) {
          console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - missing customer or revenue`);
          continue;
        }
        
        // Step 1: Get Target Rate (current revenue)
        const targetRate = revenue;
        
        // Step 2: Get Competitor Costs
        // Find all margin configurations for this customer
        const customerMargins = customerCarrierMargins.filter(margin => 
          margin.InternalName?.toLowerCase().includes(customerName.toLowerCase()) ||
          customerName.toLowerCase().includes(margin.InternalName?.toLowerCase() || '')
        );
        
        if (customerMargins.length === 0) {
          console.log(`⚠️ No margin configurations found for customer: ${customerName}`);
          continue;
        }
        
        // Calculate competitor costs based on margin configurations
        const competitorCosts: number[] = [];
        
        for (const margin of customerMargins) {
          const marginPercentage = parseFloat(margin.Percentage || '0') / 100;
          const minDollar = margin.MinDollar || 0;
          
          if (marginPercentage > 0) {
            // Calculate what the cost would be with this margin
            // If Revenue = Cost * (1 + Margin), then Cost = Revenue / (1 + Margin)
            const impliedCost = targetRate / (1 + marginPercentage);
            
            // Apply minimum dollar constraint
            const adjustedCost = Math.max(impliedCost, targetRate - minDollar);
            
            competitorCosts.push(adjustedCost);
          }
        }
        
        // Step 3: Remove invalid competitor costs
        const validCompetitorCosts = competitorCosts.filter(cost => 
          cost > 0 && cost < targetRate && isFinite(cost)
        );
        
        if (validCompetitorCosts.length < minCompetitors) {
          console.log(`⚠️ Not enough valid competitors for shipment ${shipment["Invoice #"]} (${validCompetitorCosts.length} < ${minCompetitors})`);
          continue;
        }
        
        // Step 4: Remove outliers
        const mean = validCompetitorCosts.reduce((sum, cost) => sum + cost, 0) / validCompetitorCosts.length;
        const variance = validCompetitorCosts.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / validCompetitorCosts.length;
        const stdDev = Math.sqrt(variance);
        
        const filteredCompetitorCosts = validCompetitorCosts.filter(cost => 
          Math.abs(cost - mean) <= outlierThreshold * stdDev
        );
        
        if (filteredCompetitorCosts.length === 0) {
          console.log(`⚠️ All competitor costs filtered out as outliers for shipment ${shipment["Invoice #"]}`);
          continue;
        }
        
        // Step 5: Markup remaining rate
        const averageCompetitorCost = filteredCompetitorCosts.reduce((sum, cost) => sum + cost, 0) / filteredCompetitorCosts.length;
        const markedUpRate = averageCompetitorCost / (1 - targetMargin);
        
        // Step 6: Store analysis
        const analysis: MarginAnalysis = {
          targetRate,
          competitorCosts,
          validCompetitorCosts,
          filteredCompetitorCosts,
          markedUpRate,
          averageCompetitorCost,
          shipmentId: shipment["Invoice #"].toString(),
          customerName,
          carrierCode: bookedCarrier || quotedCarrier || 'Unknown'
        };
        
        analyses.push(analysis);
      }
      
      setMarginAnalyses(analyses);
      console.log(`✅ Completed margin analysis for ${analyses.length} shipments`);
      
      // Calculate customer-level analyses
      const customerMap = new Map<string, MarginAnalysis[]>();
      analyses.forEach(analysis => {
        if (!customerMap.has(analysis.customerName)) {
          customerMap.set(analysis.customerName, []);
        }
        customerMap.get(analysis.customerName)!.push(analysis);
      });
      
      const customerAnalyses: CustomerAnalysis[] = [];
      customerMap.forEach((customerAnalyses_inner, customerName) => {
        const totalTargetRates = customerAnalyses_inner.reduce((sum, a) => sum + a.targetRate, 0);
        const totalAverageCompetitorCosts = customerAnalyses_inner.reduce((sum, a) => sum + a.averageCompetitorCost, 0);
        const recommendedMargin = totalTargetRates > 0 ? (totalTargetRates - totalAverageCompetitorCosts) / totalTargetRates : 0;
        
        customerAnalyses.push({
          customerName,
          totalTargetRates,
          totalAverageCompetitorCosts,
          recommendedMargin,
          shipmentCount: customerAnalyses_inner.length,
          analyses: customerAnalyses_inner
        });
      });
      
      setCustomerAnalyses(customerAnalyses);
      console.log(`✅ Completed customer analysis for ${customerAnalyses.length} customers`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to run margin analysis';
      setError(errorMsg);
      console.error('❌ Failed to run margin analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalysis = () => {
    if (marginAnalyses.length === 0) {
      setError('No analysis data to export');
      return;
    }
    
    // Create CSV content
    const headers = [
      'Shipment ID',
      'Customer',
      'Carrier',
      'Target Rate',
      'Competitor Count',
      'Valid Competitor Count',
      'Filtered Competitor Count',
      'Average Competitor Cost',
      'Marked Up Rate',
      'Recommended Margin'
    ];
    
    const rows = marginAnalyses.map(analysis => [
      analysis.shipmentId,
      analysis.customerName,
      analysis.carrierCode,
      analysis.targetRate.toFixed(2),
      analysis.competitorCosts.length,
      analysis.validCompetitorCosts.length,
      analysis.filteredCompetitorCosts.length,
      analysis.averageCompetitorCost.toFixed(2),
      analysis.markedUpRate.toFixed(2),
      (((analysis.targetRate - analysis.averageCompetitorCost) / analysis.targetRate) * 100).toFixed(2) + '%'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `margin-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderSetupTab = () => (
    <div className="space-y-6">
      {/* Data Loading Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Configuration</h3>
        
        {/* Shipment Data Filters */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-700 mb-3">Shipment Data Filters</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users className="inline h-4 w-4 mr-1" />
                Customer Filter
              </label>
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
          </div>
          
          <button
            onClick={loadShipmentData}
            disabled={loading}
            className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Load Shipment Data</span>
          </button>
        </div>
        
        {/* Data Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                Loaded {shipmentData.length} shipments from {startDate} to {endDate}
                {selectedCustomer && ` for ${selectedCustomer}`}
              </span>
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                Using {customerCarrierMargins.length} customer-carrier margin configurations with case-insensitive matching
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Analysis Parameters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Percent className="inline h-4 w-4 mr-1" />
              Target Margin
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={targetMargin}
              onChange={(e) => setTargetMargin(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Decimal format (0.15 = 15%)</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline h-4 w-4 mr-1" />
              Outlier Threshold
            </label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="5"
              value={outlierThreshold}
              onChange={(e) => setOutlierThreshold(parseFloat(e.target.value) || 2.0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Standard deviations</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="inline h-4 w-4 mr-1" />
              Min Competitors
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={minCompetitors}
              onChange={(e) => setMinCompetitors(parseInt(e.target.value) || 3)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Required for analysis</p>
          </div>
        </div>
        
        <button
          onClick={runMarginAnalysis}
          disabled={loading || shipmentData.length === 0}
          className="mt-4 flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          <span>Run Margin Analysis</span>
        </button>
      </div>
    </div>
  );

  const renderShipmentAnalysisTab = () => (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Analyzed Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{marginAnalyses.length}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Target Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {marginAnalyses.length > 0 
                  ? formatCurrency(marginAnalyses.reduce((sum, a) => sum + a.targetRate, 0) / marginAnalyses.length)
                  : '$0'
                }
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Competitor Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                {marginAnalyses.length > 0 
                  ? formatCurrency(marginAnalyses.reduce((sum, a) => sum + a.averageCompetitorCost, 0) / marginAnalyses.length)
                  : '$0'
                }
              </p>
            </div>
            <Target className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {marginAnalyses.length > 0 
                  ? `${(marginAnalyses.reduce((sum, a) => sum + ((a.targetRate - a.averageCompetitorCost) / a.targetRate), 0) / marginAnalyses.length * 100).toFixed(1)}%`
                  : '0%'
                }
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>
      
      {/* Shipment Analysis Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Shipment Analysis Results</h3>
          <button
            onClick={exportAnalysis}
            disabled={marginAnalyses.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competitors</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marked Up</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {marginAnalyses.map((analysis, index) => {
                const margin = ((analysis.targetRate - analysis.averageCompetitorCost) / analysis.targetRate) * 100;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {analysis.shipmentId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {analysis.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {analysis.carrierCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(analysis.targetRate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {analysis.filteredCompetitorCosts.length}/{analysis.validCompetitorCosts.length}/{analysis.competitorCosts.length}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(analysis.averageCompetitorCost)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(analysis.markedUpRate)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        margin >= targetMargin * 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {marginAnalyses.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No analysis results yet. Run the margin analysis to see results.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderCustomerAnalysisTab = () => (
    <div className="space-y-6">
      {/* Customer Analysis Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Customer Margin Analysis</h3>
          <p className="text-sm text-gray-600 mt-1">
            Recommended margins calculated as: (Sum of Target Rates - Sum of Average Competitor Costs) / Sum of Target Rates
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Target Rates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Competitor Costs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current vs Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customerAnalyses.map((customer, index) => {
                const marginDiff = customer.recommendedMargin - targetMargin;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{customer.customerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {customer.shipmentCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(customer.totalTargetRates)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(customer.totalAverageCompetitorCosts)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        customer.recommendedMargin >= targetMargin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {(customer.recommendedMargin * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        marginDiff >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {marginDiff >= 0 ? '+' : ''}{(marginDiff * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {customerAnalyses.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No customer analysis results yet. Run the margin analysis to see results.</p>
          </div>
        )}
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
              Analyze customer-carrier margins and calculate recommended pricing strategies
            </p>
          </div>
        </div>
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'setup', label: 'Setup & Configuration', icon: Calculator },
            { id: 'shipment-analysis', label: 'Shipment Analysis', icon: BarChart3 },
            { id: 'customer-analysis', label: 'Customer Analysis', icon: Users }
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
      {activeTab === 'setup' && renderSetupTab()}
      {activeTab === 'shipment-analysis' && renderShipmentAnalysisTab()}
      {activeTab === 'customer-analysis' && renderCustomerAnalysisTab()}
    </div>
  );
};