import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Percent,
  BarChart3,
  Users,
  Truck,
  Package,
  AlertTriangle,
  Info,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Target,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';

interface MarginMetrics {
  totalRevenue: number;
  totalProfit: number;
  averageMargin: number;
  shipmentCount: number;
  topCustomers: Array<{
    customer: string;
    revenue: number;
    profit: number;
    margin: number;
    shipments: number;
  }>;
  topCarriers: Array<{
    carrier: string;
    revenue: number;
    profit: number;
    margin: number;
    shipments: number;
  }>;
  marginDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'current' | 'negotiated'>('current');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MarginMetrics | null>(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  
  // Negotiated rates state
  const [negotiatedCarrier, setNegotiatedCarrier] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(5);
  const [negotiatedResults, setNegotiatedResults] = useState<any | null>(null);
  const [loadingNegotiated, setLoadingNegotiated] = useState(false);
  const [p44Rates, setP44Rates] = useState<{[key: string]: number}>({});
  const [p44Loading, setP44Loading] = useState(false);
  const [p44Client, setP44Client] = useState<Project44APIClient | null>(null);

  useEffect(() => {
    loadFilterOptions();
    if (activeTab === 'current') {
      loadMarginAnalysis();
    }
    
    // Initialize Project44 client
    const config = loadProject44Config();
    if (config) {
      setP44Client(new Project44APIClient(config));
    }
  }, [dateRange, selectedCustomer, selectedCarrier, activeTab]);

  const loadFilterOptions = async () => {
    try {
      // Load unique customers
      const { data: customerData } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null);
      
      if (customerData) {
        const uniqueCustomers = [...new Set(customerData.map(s => s.Customer).filter(Boolean))];
        setCustomers(uniqueCustomers);
      }

      // Load unique carriers
      const { data: carrierData } = await supabase
        .from('Shipments')
        .select('"Booked Carrier", "Quoted Carrier"')
        .limit(1000);
      
      if (carrierData) {
        const carrierSet = new Set<string>();
        carrierData.forEach(s => {
          if (s["Booked Carrier"]) carrierSet.add(s["Booked Carrier"]);
          if (s["Quoted Carrier"]) carrierSet.add(s["Quoted Carrier"]);
        });
        setCarriers(Array.from(carrierSet));
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const loadMarginAnalysis = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('Shipments')
        .select('*')
        .not('"Revenue"', 'is', null)
        .not('"Profit"', 'is', null);

      // Apply filters
      if (dateRange.start) {
        query = query.gte('"Scheduled Pickup Date"', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('"Scheduled Pickup Date"', dateRange.end);
      }
      if (selectedCustomer) {
        query = query.eq('"Customer"', selectedCustomer);
      }
      if (selectedCarrier) {
        query = query.or(`"Booked Carrier".eq.${selectedCarrier},"Quoted Carrier".eq.${selectedCarrier}`);
      }

      const { data: shipments, error } = await query;

      if (error) throw error;

      if (shipments) {
        const analysis = analyzeMargins(shipments);
        setMetrics(analysis);
      }
    } catch (error) {
      console.error('Failed to load margin analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeMargins = (shipments: any[]): MarginMetrics => {
    let totalRevenue = 0;
    let totalProfit = 0;
    const customerMap = new Map();
    const carrierMap = new Map();
    const marginRanges = {
      'Negative': 0,
      '0-5%': 0,
      '5-10%': 0,
      '10-15%': 0,
      '15-20%': 0,
      '20%+': 0
    };

    shipments.forEach(shipment => {
      const revenue = parseNumeric(shipment["Revenue"]);
      const profit = parseNumeric(shipment["Profit"]);
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      totalRevenue += revenue;
      totalProfit += profit;

      // Customer analysis
      const customer = shipment["Customer"] || 'Unknown';
      if (!customerMap.has(customer)) {
        customerMap.set(customer, { revenue: 0, profit: 0, shipments: 0 });
      }
      const customerData = customerMap.get(customer);
      customerData.revenue += revenue;
      customerData.profit += profit;
      customerData.shipments += 1;

      // Carrier analysis
      const carrier = shipment["Booked Carrier"] || shipment["Quoted Carrier"] || 'Unknown';
      if (!carrierMap.has(carrier)) {
        carrierMap.set(carrier, { revenue: 0, profit: 0, shipments: 0 });
      }
      const carrierData = carrierMap.get(carrier);
      carrierData.revenue += revenue;
      carrierData.profit += profit;
      carrierData.shipments += 1;

      // Margin distribution
      if (margin < 0) marginRanges['Negative']++;
      else if (margin < 5) marginRanges['0-5%']++;
      else if (margin < 10) marginRanges['5-10%']++;
      else if (margin < 15) marginRanges['10-15%']++;
      else if (margin < 20) marginRanges['15-20%']++;
      else marginRanges['20%+']++;
    });

    // Top customers
    const topCustomers = Array.from(customerMap.entries())
      .map(([customer, data]) => ({
        customer,
        revenue: data.revenue,
        profit: data.profit,
        margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        shipments: data.shipments
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top carriers
    const topCarriers = Array.from(carrierMap.entries())
      .map(([carrier, data]) => ({
        carrier,
        revenue: data.revenue,
        profit: data.profit,
        margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        shipments: data.shipments
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Margin distribution
    const marginDistribution = Object.entries(marginRanges).map(([range, count]) => ({
      range,
      count,
      percentage: shipments.length > 0 ? (count / shipments.length) * 100 : 0
    }));

    return {
      totalRevenue,
      totalProfit,
      averageMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      shipmentCount: shipments.length,
      topCustomers,
      topCarriers,
      marginDistribution
    };
  };

  const calculateNegotiatedRates = async () => {
    if (!negotiatedCarrier) {
      alert('Please select a carrier');
      return;
    }

    setLoadingNegotiated(true);
    try {
      // 1. Get historical shipments for this carrier
      const { data: shipments, error } = await supabase
        .from('Shipments')
        .select('*')
        .or(`"Booked Carrier".eq.${negotiatedCarrier},"Quoted Carrier".eq.${negotiatedCarrier}`)
        .not('"Revenue"', 'is', null)
        .not('"Carrier Expense"', 'is', null);

      if (error) throw error;

      if (!shipments || shipments.length === 0) {
        alert('No shipment data found for this carrier');
        setLoadingNegotiated(false);
        return;
      }

      // 2. Calculate current and new rates
      const customerResults = new Map();
      let totalOldCost = 0;
      let totalNewCost = 0;
      let totalRevenue = 0;

      shipments.forEach(shipment => {
        const customer = shipment["Customer"] || 'Unknown';
        const revenue = parseNumeric(shipment["Revenue"]);
        const oldCost = parseNumeric(shipment["Carrier Expense"]);
        const newCost = oldCost * (1 - (discountPercentage / 100));
        
        totalOldCost += oldCost;
        totalNewCost += newCost;
        totalRevenue += revenue;

        if (!customerResults.has(customer)) {
          customerResults.set(customer, {
            shipments: 0,
            oldCost: 0,
            newCost: 0,
            revenue: 0
          });
        }

        const customerData = customerResults.get(customer);
        customerData.shipments += 1;
        customerData.oldCost += oldCost;
        customerData.newCost += newCost;
        customerData.revenue += revenue;
      });

      // 3. Calculate recommended margins
      const results = {
        carrier: negotiatedCarrier,
        discountPercentage,
        totalShipments: shipments.length,
        totalOldCost,
        totalNewCost,
        totalSavings: totalOldCost - totalNewCost,
        totalRevenue,
        oldMargin: totalRevenue > 0 ? ((totalRevenue - totalOldCost) / totalRevenue) * 100 : 0,
        newMargin: totalRevenue > 0 ? ((totalRevenue - totalNewCost) / totalRevenue) * 100 : 0,
        customers: Array.from(customerResults.entries()).map(([customer, data]) => {
          const oldProfit = data.revenue - data.oldCost;
          const newProfit = data.revenue - data.newCost;
          const oldMargin = data.revenue > 0 ? (oldProfit / data.revenue) * 100 : 0;
          const newMargin = data.revenue > 0 ? (newProfit / data.revenue) * 100 : 0;
          
          return {
            customer,
            shipments: data.shipments,
            oldCost: data.oldCost,
            newCost: data.newCost,
            savings: data.oldCost - data.newCost,
            revenue: data.revenue,
            oldProfit,
            newProfit,
            oldMargin,
            newMargin,
            marginImprovement: newMargin - oldMargin
          };
        }).sort((a, b) => b.revenue - a.revenue)
      };

      setNegotiatedResults(results);
    } catch (error) {
      console.error('Failed to calculate negotiated rates:', error);
      alert('Error calculating negotiated rates');
    } finally {
      setLoadingNegotiated(false);
    }
  };

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedCustomer('');
    setSelectedCarrier('');
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'current'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calculator className="h-4 w-4" />
              <span>Current Margin Analysis</span>
            </button>
            <button
              onClick={() => setActiveTab('negotiated')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'negotiated'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              <span>Negotiated Rate Analysis</span>
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'current' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Current Margin Analysis</h2>
              <p className="text-sm text-gray-600">Analyze profit margins across customers, carriers, and time periods</p>
            </div>
            <button
              onClick={loadMarginAnalysis}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Customers</option>
                  {customers.map(customer => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Carriers</option>
                  {carriers.map(carrier => (
                    <option key={carrier} value={carrier}>{carrier}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}

          {metrics && !loading && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Profit</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalProfit)}</p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Average Margin</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.averageMargin.toFixed(1)}%</p>
                    </div>
                    <div className={`p-3 rounded-full ${
                      metrics.averageMargin >= 15 ? 'bg-green-100' : 
                      metrics.averageMargin >= 10 ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <Percent className={`h-6 w-6 ${
                        metrics.averageMargin >= 15 ? 'text-green-600' : 
                        metrics.averageMargin >= 10 ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Shipments</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.shipmentCount.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-full">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Margin Distribution */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Margin Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {metrics.marginDistribution.map((item) => (
                    <div key={item.range} className="text-center">
                      <div className={`p-4 rounded-lg ${
                        item.range === 'Negative' ? 'bg-red-100' :
                        item.range === '0-5%' ? 'bg-orange-100' :
                        item.range === '5-10%' ? 'bg-yellow-100' :
                        item.range === '10-15%' ? 'bg-blue-100' :
                        item.range === '15-20%' ? 'bg-green-100' : 'bg-emerald-100'
                      }`}>
                        <p className="text-lg font-bold text-gray-900">{item.count}</p>
                        <p className="text-sm text-gray-600">{item.percentage.toFixed(1)}%</p>
                      </div>
                      <p className="text-xs font-medium text-gray-700 mt-2">{item.range}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Customers */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers by Revenue</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-sm font-medium text-gray-600">Customer</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Revenue</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Profit</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Margin</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Shipments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topCustomers.map((customer, index) => (
                        <tr key={customer.customer} className="border-b border-gray-100">
                          <td className="py-3 text-sm font-medium text-gray-900">
                            <div className="flex items-center space-x-2">
                              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <span>{customer.customer}</span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.revenue)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.profit)}
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              customer.margin >= 15 ? 'bg-green-100 text-green-800' :
                              customer.margin >= 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {customer.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {customer.shipments}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Carriers */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Carriers by Revenue</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-sm font-medium text-gray-600">Carrier</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Revenue</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Profit</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Margin</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Shipments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topCarriers.map((carrier, index) => (
                        <tr key={carrier.carrier} className="border-b border-gray-100">
                          <td className="py-3 text-sm font-medium text-gray-900">
                            <div className="flex items-center space-x-2">
                              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <span>{carrier.carrier}</span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(carrier.revenue)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(carrier.profit)}
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              carrier.margin >= 15 ? 'bg-green-100 text-green-800' :
                              carrier.margin >= 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {carrier.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {carrier.shipments}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!metrics && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No data available for analysis</p>
              <p className="text-sm">Try adjusting your filters or check your data connection</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'negotiated' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Negotiated Rate Analysis</h2>
              <p className="text-sm text-gray-600">Calculate new margins after negotiating better rates with carriers</p>
            </div>
          </div>

          {/* Negotiation Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Carrier</label>
                <select
                  value={negotiatedCarrier}
                  onChange={(e) => setNegotiatedCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a carrier</option>
                  {carriers.map(carrier => (
                    <option key={carrier} value={carrier}>{carrier}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Negotiated Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={calculateNegotiatedRates}
                  disabled={loadingNegotiated || !negotiatedCarrier}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loadingNegotiated ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  <span>Calculate New Margins</span>
                </button>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How this works:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Select a carrier you've negotiated a better rate with</li>
                    <li>Enter the percentage discount you've negotiated</li>
                    <li>We'll analyze your historical shipments with this carrier</li>
                    <li>Calculate new margins based on the negotiated rates</li>
                    <li>Show recommended margin adjustments per customer</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Negotiated Results */}
          {negotiatedResults && (
            <>
              {/* Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Negotiated Rate Summary for {negotiatedResults.carrier}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Shipments</p>
                    <p className="text-xl font-bold text-gray-900">{negotiatedResults.totalShipments}</p>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Savings</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(negotiatedResults.totalSavings)}
                    </p>
                    <p className="text-xs text-green-600">
                      {discountPercentage}% discount
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Old Margin</p>
                    <p className="text-xl font-bold text-blue-700">
                      {negotiatedResults.oldMargin.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">New Margin</p>
                    <p className="text-xl font-bold text-indigo-700">
                      {negotiatedResults.newMargin.toFixed(1)}%
                    </p>
                    <p className="text-xs text-indigo-600">
                      +{(negotiatedResults.newMargin - negotiatedResults.oldMargin).toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Margin Strategy Options:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Pass savings to customers:</strong> Maintain current margin percentage</li>
                        <li><strong>Split the difference:</strong> Share some savings with customers</li>
                        <li><strong>Keep all savings:</strong> Increase margin percentage</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Customer Breakdown */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Customer-Specific Margin Analysis
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-sm font-medium text-gray-600">Customer</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Shipments</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Old Cost</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">New Cost</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Savings</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Revenue</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Old Margin</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">New Margin</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {negotiatedResults.customers.map((customer) => (
                        <tr key={customer.customer} className="border-b border-gray-100">
                          <td className="py-3 text-sm font-medium text-gray-900">
                            {customer.customer}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {customer.shipments}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.oldCost)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.newCost)}
                          </td>
                          <td className="py-3 text-sm text-green-600 text-right font-medium">
                            {formatCurrency(customer.savings)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.revenue)}
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              customer.oldMargin >= 15 ? 'bg-green-100 text-green-800' :
                              customer.oldMargin >= 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {customer.oldMargin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              customer.newMargin >= 15 ? 'bg-green-100 text-green-800' :
                              customer.newMargin >= 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {customer.newMargin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className="text-green-600">
                              +{customer.marginImprovement.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Recommendations */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Recommended Actions
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Target className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-md font-medium text-green-800">Option 1: Keep Full Savings</h4>
                        <p className="text-sm text-green-700 mt-1">
                          Maintain current customer pricing and increase your margin by {(negotiatedResults.newMargin - negotiatedResults.oldMargin).toFixed(1)}%.
                          This would increase your profit by {formatCurrency(negotiatedResults.totalSavings)} across {negotiatedResults.totalShipments} shipments.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <ArrowRight className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-md font-medium text-blue-800">Option 2: Split the Difference</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Share half of the savings with customers by reducing prices by {(discountPercentage / 2).toFixed(1)}%.
                          You'll still increase your margin by {((negotiatedResults.newMargin - negotiatedResults.oldMargin) / 2).toFixed(1)}%
                          and profit by {formatCurrency(negotiatedResults.totalSavings / 2)}.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Users className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-md font-medium text-purple-800">Option 3: Customer-Specific Strategy</h4>
                        <p className="text-sm text-purple-700 mt-1">
                          Apply different strategies based on customer margin:
                        </p>
                        <ul className="list-disc list-inside text-sm text-purple-700 mt-2 space-y-1">
                          <li>For customers with &lt;10% margin: Keep full savings</li>
                          <li>For customers with 10-15% margin: Share 50% of savings</li>
                          <li>For customers with &gt;15% margin: Pass through most savings to maintain competitiveness</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {!negotiatedResults && !loadingNegotiated && (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select a carrier and discount percentage to calculate new margins</p>
            </div>
          )}

          {loadingNegotiated && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}
        </>
      )}
    </div>
  );
};