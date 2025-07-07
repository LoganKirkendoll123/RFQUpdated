import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  FileText,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Info,
  BarChart3,
  Target,
  Percent
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface ShipmentData {
  shipment_id: string;
  customer_name: string;
  carrier_name: string;
  cost: number;
  shipment_date: string;
}

interface CustomerMarginData {
  [customer_name: string]: number; // margin as decimal (e.g., 0.15 for 15%)
}

interface AnalysisDateRange {
  start_date: string;
  end_date: string;
}

interface Phase1Results {
  [customer_name: string]: number; // total estimated revenue
}

interface Phase2Results {
  [customer_name: string]: {
    initial_estimated_revenue: number;
    total_cost_post_negotiation: number;
    new_required_margin: number;
  };
}

interface CustomerAnalysis {
  customer_name: string;
  initial_estimated_revenue: number;
  total_cost_post_negotiation: number;
  new_required_margin: number;
  margin_change: number;
  revenue_impact: number;
}

export const NegotiationImpactAnalyzer: React.FC = () => {
  const [activePhase, setActivePhase] = useState<1 | 2>(1);
  const [dateRange, setDateRange] = useState<AnalysisDateRange>({
    start_date: '',
    end_date: ''
  });
  
  // Phase 1 state
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [customerMarginData, setCustomerMarginData] = useState<CustomerMarginData>({});
  const [phase1Results, setPhase1Results] = useState<Phase1Results>({});
  const [phase1Loading, setPhase1Loading] = useState(false);
  
  // Phase 2 state
  const [shipmentDataPostNegotiation, setShipmentDataPostNegotiation] = useState<ShipmentData[]>([]);
  const [phase2Results, setPhase2Results] = useState<Phase2Results>({});
  const [phase2Loading, setPhase2Loading] = useState(false);
  
  // UI state
  const [error, setError] = useState<string>('');
  const [defaultMargin, setDefaultMargin] = useState<number>(0.20);

  useEffect(() => {
    loadShipmentDataFromDatabase();
    loadCustomerMarginDataFromDatabase();
  }, []);

  const loadShipmentDataFromDatabase = async () => {
    try {
      console.log('📊 Loading shipment data from database...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select(`
          "Invoice #",
          "Customer",
          "Booked Carrier",
          "Carrier Expense",
          "Scheduled Pickup Date"
        `)
        .not('"Customer"', 'is', null)
        .not('"Carrier Expense"', 'is', null)
        .not('"Scheduled Pickup Date"', 'is', null)
        .limit(1000);

      if (error) {
        console.error('❌ Error loading shipment data:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const transformedData: ShipmentData[] = data.map(row => ({
          shipment_id: row["Invoice #"]?.toString() || '',
          customer_name: row["Customer"] || '',
          carrier_name: row["Booked Carrier"] || '',
          cost: parseFloat(row["Carrier Expense"]?.toString().replace(/[^\d.-]/g, '') || '0'),
          shipment_date: row["Scheduled Pickup Date"] || ''
        })).filter(item => item.cost > 0 && item.customer_name && item.shipment_date);

        setShipmentData(transformedData);
        console.log(`✅ Loaded ${transformedData.length} shipment records`);
      }
    } catch (err) {
      console.error('❌ Failed to load shipment data:', err);
      setError('Failed to load shipment data from database');
    }
  };

  const loadCustomerMarginDataFromDatabase = async () => {
    try {
      console.log('📊 Loading customer margin data from database...');
      
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('"InternalName", "Percentage"')
        .not('"InternalName"', 'is', null)
        .not('"Percentage"', 'is', null);

      if (error) {
        console.error('❌ Error loading customer margin data:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const marginData: CustomerMarginData = {};
        
        data.forEach(row => {
          const customerName = row["InternalName"];
          const percentage = parseFloat(row["Percentage"] || '0');
          
          if (customerName && percentage > 0) {
            // Convert percentage to decimal and take the average if multiple entries exist
            const decimal = percentage / 100;
            if (marginData[customerName]) {
              marginData[customerName] = (marginData[customerName] + decimal) / 2;
            } else {
              marginData[customerName] = decimal;
            }
          }
        });

        setCustomerMarginData(marginData);
        console.log(`✅ Loaded margin data for ${Object.keys(marginData).length} customers`);
      }
    } catch (err) {
      console.error('❌ Failed to load customer margin data:', err);
      setError('Failed to load customer margin data from database');
    }
  };

  const runPhase1Analysis = async () => {
    if (!dateRange.start_date || !dateRange.end_date) {
      setError('Please select both start and end dates for analysis');
      return;
    }

    setPhase1Loading(true);
    setError('');

    try {
      console.log('🔍 Phase 1: Starting initial analysis (pre-negotiation baseline)');
      
      // Step 1.1: Filter Shipments by Date Range
      const filteredShipments = shipmentData.filter(shipment => {
        const shipmentDate = new Date(shipment.shipment_date);
        const startDate = new Date(dateRange.start_date);
        const endDate = new Date(dateRange.end_date);
        return shipmentDate >= startDate && shipmentDate <= endDate;
      });

      console.log(`📅 Filtered ${filteredShipments.length} shipments within date range`);

      // Step 1.2 & 1.3: Calculate and Aggregate "Estimated Revenue After Margin" per Customer
      const customerRevenues: Phase1Results = {};
      let unmatchedCustomers = 0;

      filteredShipments.forEach(shipment => {
        const customerMargin = customerMarginData[shipment.customer_name];
        const margin = customerMargin !== undefined ? customerMargin : defaultMargin;
        
        if (customerMargin === undefined) {
          unmatchedCustomers++;
        }

        // Formula: estimated_revenue_after_margin = cost / (1 - customer_carrier_margin)
        const estimatedRevenue = shipment.cost / (1 - margin);

        if (customerRevenues[shipment.customer_name]) {
          customerRevenues[shipment.customer_name] += estimatedRevenue;
        } else {
          customerRevenues[shipment.customer_name] = estimatedRevenue;
        }
      });

      setPhase1Results(customerRevenues);
      
      console.log('✅ Phase 1 completed successfully');
      console.log(`📊 Analyzed ${Object.keys(customerRevenues).length} customers`);
      console.log(`⚠️ ${unmatchedCustomers} shipments used default margin (${(defaultMargin * 100).toFixed(1)}%)`);

    } catch (err) {
      console.error('❌ Phase 1 analysis failed:', err);
      setError('Phase 1 analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setPhase1Loading(false);
    }
  };

  const runPhase2Analysis = async () => {
    if (Object.keys(phase1Results).length === 0) {
      setError('Please run Phase 1 analysis first');
      return;
    }

    if (shipmentDataPostNegotiation.length === 0) {
      setError('Please provide post-negotiation shipment data');
      return;
    }

    setPhase2Loading(true);
    setError('');

    try {
      console.log('🔍 Phase 2: Starting post-negotiation analysis');

      // Step 2.1: Calculate "Sum of Costs Before Margin" per Customer (Post-Negotiation)
      const filteredPostNegotiationShipments = shipmentDataPostNegotiation.filter(shipment => {
        const shipmentDate = new Date(shipment.shipment_date);
        const startDate = new Date(dateRange.start_date);
        const endDate = new Date(dateRange.end_date);
        return shipmentDate >= startDate && shipmentDate <= endDate;
      });

      const customerCostsPostNegotiation: { [customer_name: string]: number } = {};

      filteredPostNegotiationShipments.forEach(shipment => {
        if (customerCostsPostNegotiation[shipment.customer_name]) {
          customerCostsPostNegotiation[shipment.customer_name] += shipment.cost;
        } else {
          customerCostsPostNegotiation[shipment.customer_name] = shipment.cost;
        }
      });

      // Step 2.2: Determine "New Required Margin" per Customer
      const results: Phase2Results = {};

      Object.keys(phase1Results).forEach(customerName => {
        const initialEstimatedRevenue = phase1Results[customerName];
        const totalCostPostNegotiation = customerCostsPostNegotiation[customerName] || 0;

        let newRequiredMargin: number;

        if (initialEstimatedRevenue <= 0) {
          newRequiredMargin = 1; // 100% margin if no initial revenue
        } else if (totalCostPostNegotiation <= 0) {
          newRequiredMargin = 1; // 100% margin if no post-negotiation cost
        } else {
          // Formula: new_required_margin = 1 - (total_cost_post_negotiation / initial_estimated_revenue)
          newRequiredMargin = 1 - (totalCostPostNegotiation / initialEstimatedRevenue);
        }

        // Ensure margin is between 0 and 1
        newRequiredMargin = Math.max(0, Math.min(1, newRequiredMargin));

        results[customerName] = {
          initial_estimated_revenue: initialEstimatedRevenue,
          total_cost_post_negotiation: totalCostPostNegotiation,
          new_required_margin: newRequiredMargin
        };
      });

      setPhase2Results(results);
      
      console.log('✅ Phase 2 completed successfully');
      console.log(`📊 Calculated new margins for ${Object.keys(results).length} customers`);

    } catch (err) {
      console.error('❌ Phase 2 analysis failed:', err);
      setError('Phase 2 analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setPhase2Loading(false);
    }
  };

  const getCustomerAnalysis = (): CustomerAnalysis[] => {
    return Object.keys(phase2Results).map(customerName => {
      const phase2Data = phase2Results[customerName];
      const originalMargin = customerMarginData[customerName] || defaultMargin;
      const marginChange = phase2Data.new_required_margin - originalMargin;
      const revenueImpact = phase2Data.initial_estimated_revenue - (phase2Data.total_cost_post_negotiation / (1 - originalMargin));

      return {
        customer_name: customerName,
        initial_estimated_revenue: phase2Data.initial_estimated_revenue,
        total_cost_post_negotiation: phase2Data.total_cost_post_negotiation,
        new_required_margin: phase2Data.new_required_margin,
        margin_change: marginChange,
        revenue_impact: revenueImpact
      };
    }).sort((a, b) => Math.abs(b.margin_change) - Math.abs(a.margin_change));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isPostNegotiation: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data: ShipmentData[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length >= headers.length && values[0]) {
            const shipment: ShipmentData = {
              shipment_id: values[0] || '',
              customer_name: values[1] || '',
              carrier_name: values[2] || '',
              cost: parseFloat(values[3]) || 0,
              shipment_date: values[4] || ''
            };
            
            if (shipment.cost > 0 && shipment.customer_name && shipment.shipment_date) {
              data.push(shipment);
            }
          }
        }

        if (isPostNegotiation) {
          setShipmentDataPostNegotiation(data);
          console.log(`✅ Loaded ${data.length} post-negotiation shipment records`);
        } else {
          setShipmentData(data);
          console.log(`✅ Loaded ${data.length} shipment records`);
        }
      } catch (err) {
        setError('Failed to parse CSV file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };
    reader.readAsText(file);
  };

  const exportResults = () => {
    const analysis = getCustomerAnalysis();
    const csvContent = [
      ['Customer Name', 'Initial Estimated Revenue', 'Total Cost Post-Negotiation', 'Original Margin %', 'New Required Margin %', 'Margin Change %', 'Revenue Impact'].join(','),
      ...analysis.map(item => [
        item.customer_name,
        item.initial_estimated_revenue.toFixed(2),
        item.total_cost_post_negotiation.toFixed(2),
        ((customerMarginData[item.customer_name] || defaultMargin) * 100).toFixed(2),
        (item.new_required_margin * 100).toFixed(2),
        (item.margin_change * 100).toFixed(2),
        item.revenue_impact.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `negotiation-impact-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Negotiation Impact Analyzer</h1>
            <p className="text-sm text-gray-600">
              Two-phase analysis to evaluate profitability before and after carrier negotiations
            </p>
          </div>
        </div>
      </div>

      {/* Phase Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Analysis Phase</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setActivePhase(1)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activePhase === 1
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Phase 1: Pre-Negotiation
            </button>
            <button
              onClick={() => setActivePhase(2)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activePhase === 2
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Phase 2: Post-Negotiation
            </button>
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Margin %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={defaultMargin * 100}
              onChange={(e) => setDefaultMargin(parseFloat(e.target.value) / 100 || 0.20)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
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

      {/* Phase 1 Content */}
      {activePhase === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Phase 1: Pre-Negotiation Baseline</h3>
              <button
                onClick={runPhase1Analysis}
                disabled={phase1Loading || !dateRange.start_date || !dateRange.end_date}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {phase1Loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    <span>Run Phase 1 Analysis</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Shipment Records</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">{shipmentData.length}</div>
                <div className="text-xs text-blue-700">Total shipments loaded</div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Customer Margins</span>
                </div>
                <div className="text-2xl font-bold text-green-900">{Object.keys(customerMarginData).length}</div>
                <div className="text-xs text-green-700">Customers with margin data</div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Analysis Results</span>
                </div>
                <div className="text-2xl font-bold text-purple-900">{Object.keys(phase1Results).length}</div>
                <div className="text-xs text-purple-700">Customers analyzed</div>
              </div>
            </div>

            {/* Phase 1 Results */}
            {Object.keys(phase1Results).length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Initial Estimated Revenue per Customer</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Margin %</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estimated Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(phase1Results)
                        .sort(([, a], [, b]) => b - a)
                        .map(([customerName, revenue]) => (
                        <tr key={customerName}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{customerName}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {((customerMarginData[customerName] || defaultMargin) * 100).toFixed(1)}%
                            {!customerMarginData[customerName] && (
                              <span className="ml-1 text-xs text-orange-600">(default)</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase 2 Content */}
      {activePhase === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Phase 2: Post-Negotiation Analysis</h3>
              <div className="flex space-x-2">
                <button
                  onClick={runPhase2Analysis}
                  disabled={phase2Loading || Object.keys(phase1Results).length === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {phase2Loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4" />
                      <span>Run Phase 2 Analysis</span>
                    </>
                  )}
                </button>
                {Object.keys(phase2Results).length > 0 && (
                  <button
                    onClick={exportResults}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Results</span>
                  </button>
                )}
              </div>
            </div>

            {/* File Upload for Post-Negotiation Data */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Post-Negotiation Shipment Data (CSV)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                CSV format: shipment_id, customer_name, carrier_name, cost, shipment_date
              </p>
              {shipmentDataPostNegotiation.length > 0 && (
                <div className="mt-2 text-sm text-green-600">
                  ✅ {shipmentDataPostNegotiation.length} post-negotiation records loaded
                </div>
              )}
            </div>

            {/* Phase 2 Results */}
            {Object.keys(phase2Results).length > 0 && (
              <div className="space-y-6">
                <h4 className="text-md font-semibold text-gray-900">Negotiation Impact Analysis</h4>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(() => {
                    const analysis = getCustomerAnalysis();
                    const avgMarginChange = analysis.reduce((sum, item) => sum + item.margin_change, 0) / analysis.length;
                    const totalRevenueImpact = analysis.reduce((sum, item) => sum + item.revenue_impact, 0);
                    const customersNeedingIncrease = analysis.filter(item => item.margin_change > 0).length;
                    const customersWithDecrease = analysis.filter(item => item.margin_change < 0).length;

                    return (
                      <>
                        <div className="bg-blue-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Percent className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Avg Margin Change</span>
                          </div>
                          <div className="text-2xl font-bold text-blue-900">
                            {(avgMarginChange * 100).toFixed(1)}%
                          </div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-900">Revenue Impact</span>
                          </div>
                          <div className="text-2xl font-bold text-green-900">
                            {formatCurrency(totalRevenueImpact)}
                          </div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-900">Need Increase</span>
                          </div>
                          <div className="text-2xl font-bold text-red-900">{customersNeedingIncrease}</div>
                          <div className="text-xs text-red-700">customers</div>
                        </div>

                        <div className="bg-emerald-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingDown className="h-4 w-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-900">Can Decrease</span>
                          </div>
                          <div className="text-2xl font-bold text-emerald-900">{customersWithDecrease}</div>
                          <div className="text-xs text-emerald-700">customers</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Detailed Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Initial Revenue</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Post-Neg Cost</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Original Margin</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Required Margin</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getCustomerAnalysis().map((item) => (
                        <tr key={item.customer_name}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.customer_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(item.initial_estimated_revenue)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(item.total_cost_post_negotiation)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {((customerMarginData[item.customer_name] || defaultMargin) * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {(item.new_required_margin * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item.margin_change > 0.01 ? 'bg-red-100 text-red-800' :
                              item.margin_change < -0.01 ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {item.margin_change > 0 ? '+' : ''}{(item.margin_change * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={item.revenue_impact >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(item.revenue_impact)}
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
        </div>
      )}
    </div>
  );
};