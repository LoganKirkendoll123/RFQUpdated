import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Package, 
  BarChart3,
  Loader,
  AlertCircle,
  Download,
  Filter,
  RefreshCw,
  Target,
  Award,
  Building2,
  Truck,
  MapPin,
  Calendar,
  Percent
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface MarginAnalysis {
  customer: string;
  totalShipments: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  topCarrier: string;
  topLane: string;
  recentShipments: number;
}

interface CarrierMargin {
  carrier: string;
  shipmentCount: number;
  avgMargin: number;
  totalRevenue: number;
  totalProfit: number;
}

interface LaneMargin {
  lane: string;
  shipmentCount: number;
  avgMargin: number;
  totalRevenue: number;
  totalProfit: number;
}

export const MarginAnalysisTools: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [customerAnalysis, setCustomerAnalysis] = useState<MarginAnalysis[]>([]);
  const [carrierAnalysis, setCarrierAnalysis] = useState<CarrierMargin[]>([]);
  const [laneAnalysis, setLaneAnalysis] = useState<LaneMargin[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortBy, setSortBy] = useState<'margin' | 'revenue' | 'shipments'>('margin');
  const [activeTab, setActiveTab] = useState<'customers' | 'carriers' | 'lanes'>('customers');

  useEffect(() => {
    loadCustomers();
    loadAnalysis();
  }, []);

  useEffect(() => {
    loadAnalysis();
  }, [selectedCustomer, dateRange, sortBy]);

  const loadCustomers = async () => {
    try {
      console.log('🔍 Loading all customers for margin analysis...');
      
      // Remove the limit to load ALL customers
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null)
        .order('"Customer"');
      
      if (error) {
        console.error('❌ Error loading customers:', error);
        throw error;
      }
      
      // Get unique customer names
      const uniqueCustomers = [...new Set(data?.map(d => d.Customer) || [])];
      const filteredCustomers = uniqueCustomers.filter(Boolean);
      
      console.log(`✅ Loaded ${filteredCustomers.length} unique customers for margin analysis`);
      setCustomers(filteredCustomers);
    } catch (err) {
      console.error('❌ Failed to load customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    }
  };

  const loadAnalysis = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📊 Loading margin analysis data...');
      
      let query = supabase.from('Shipments').select('*');
      
      // Apply customer filter
      if (selectedCustomer) {
        query = query.eq('"Customer"', selectedCustomer);
      }
      
      // Apply date range filter
      if (dateRange.start) {
        query = query.gte('"Scheduled Pickup Date"', dateRange.start);
      }
      
      if (dateRange.end) {
        query = query.lte('"Scheduled Pickup Date"', dateRange.end);
      }
      
      const { data: shipments, error } = await query;
      
      if (error) {
        console.error('❌ Error loading shipments for analysis:', error);
        throw error;
      }
      
      if (!shipments || shipments.length === 0) {
        console.log('ℹ️ No shipments found for analysis');
        setCustomerAnalysis([]);
        setCarrierAnalysis([]);
        setLaneAnalysis([]);
        return;
      }
      
      console.log(`📦 Analyzing ${shipments.length} shipments for margin data`);
      
      // Process customer analysis
      const customerMap = new Map<string, {
        shipments: any[];
        revenue: number;
        profit: number;
        carriers: Map<string, number>;
        lanes: Map<string, number>;
      }>();
      
      shipments.forEach(shipment => {
        const customer = shipment["Customer"];
        if (!customer) return;
        
        const revenue = parseNumeric(shipment["Revenue"]);
        const profit = parseNumeric(shipment["Profit"]);
        const carrier = shipment["Booked Carrier"] || shipment["Quoted Carrier"] || 'Unknown';
        const lane = `${shipment["Zip"]} → ${shipment["Zip_1"]}`;
        
        if (!customerMap.has(customer)) {
          customerMap.set(customer, {
            shipments: [],
            revenue: 0,
            profit: 0,
            carriers: new Map(),
            lanes: new Map()
          });
        }
        
        const customerData = customerMap.get(customer)!;
        customerData.shipments.push(shipment);
        customerData.revenue += revenue;
        customerData.profit += profit;
        customerData.carriers.set(carrier, (customerData.carriers.get(carrier) || 0) + 1);
        customerData.lanes.set(lane, (customerData.lanes.get(lane) || 0) + 1);
      });
      
      // Convert to customer analysis array
      const customerAnalysisData: MarginAnalysis[] = Array.from(customerMap.entries()).map(([customer, data]) => {
        const avgMargin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;
        const topCarrier = Array.from(data.carriers.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        const topLane = Array.from(data.lanes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        
        // Count recent shipments (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentShipments = data.shipments.filter(s => 
          s["Scheduled Pickup Date"] && new Date(s["Scheduled Pickup Date"]) >= thirtyDaysAgo
        ).length;
        
        return {
          customer,
          totalShipments: data.shipments.length,
          totalRevenue: data.revenue,
          totalProfit: data.profit,
          avgMargin,
          topCarrier,
          topLane,
          recentShipments
        };
      });
      
      // Sort customer analysis
      customerAnalysisData.sort((a, b) => {
        switch (sortBy) {
          case 'margin': return b.avgMargin - a.avgMargin;
          case 'revenue': return b.totalRevenue - a.totalRevenue;
          case 'shipments': return b.totalShipments - a.totalShipments;
          default: return b.avgMargin - a.avgMargin;
        }
      });
      
      setCustomerAnalysis(customerAnalysisData);
      
      // Process carrier analysis
      const carrierMap = new Map<string, { revenue: number; profit: number; shipments: number }>();
      
      shipments.forEach(shipment => {
        const carrier = shipment["Booked Carrier"] || shipment["Quoted Carrier"] || 'Unknown';
        const revenue = parseNumeric(shipment["Revenue"]);
        const profit = parseNumeric(shipment["Profit"]);
        
        if (!carrierMap.has(carrier)) {
          carrierMap.set(carrier, { revenue: 0, profit: 0, shipments: 0 });
        }
        
        const carrierData = carrierMap.get(carrier)!;
        carrierData.revenue += revenue;
        carrierData.profit += profit;
        carrierData.shipments += 1;
      });
      
      const carrierAnalysisData: CarrierMargin[] = Array.from(carrierMap.entries()).map(([carrier, data]) => ({
        carrier,
        shipmentCount: data.shipments,
        avgMargin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        totalRevenue: data.revenue,
        totalProfit: data.profit
      })).sort((a, b) => b.avgMargin - a.avgMargin);
      
      setCarrierAnalysis(carrierAnalysisData);
      
      // Process lane analysis
      const laneMap = new Map<string, { revenue: number; profit: number; shipments: number }>();
      
      shipments.forEach(shipment => {
        const lane = `${shipment["Zip"]} → ${shipment["Zip_1"]}`;
        const revenue = parseNumeric(shipment["Revenue"]);
        const profit = parseNumeric(shipment["Profit"]);
        
        if (!laneMap.has(lane)) {
          laneMap.set(lane, { revenue: 0, profit: 0, shipments: 0 });
        }
        
        const laneData = laneMap.get(lane)!;
        laneData.revenue += revenue;
        laneData.profit += profit;
        laneData.shipments += 1;
      });
      
      const laneAnalysisData: LaneMargin[] = Array.from(laneMap.entries()).map(([lane, data]) => ({
        lane,
        shipmentCount: data.shipments,
        avgMargin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        totalRevenue: data.revenue,
        totalProfit: data.profit
      })).sort((a, b) => b.avgMargin - a.avgMargin);
      
      setLaneAnalysis(laneAnalysisData);
      
      console.log(`✅ Margin analysis complete: ${customerAnalysisData.length} customers, ${carrierAnalysisData.length} carriers, ${laneAnalysisData.length} lanes`);
      
    } catch (err) {
      console.error('❌ Failed to load margin analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load margin analysis');
    } finally {
      setLoading(false);
    }
  };

  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const exportAnalysis = () => {
    console.log('📊 Exporting margin analysis data...');
    // Implementation for exporting analysis data
  };

  const renderCustomerAnalysis = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{customerAnalysis.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {customerAnalysis.length > 0 
                  ? (customerAnalysis.reduce((sum, c) => sum + c.avgMargin, 0) / customerAnalysis.length).toFixed(1)
                  : '0.0'
                }%
              </p>
            </div>
            <Percent className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(customerAnalysis.reduce((sum, c) => sum + c.totalRevenue, 0))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Profit</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(customerAnalysis.reduce((sum, c) => sum + c.totalProfit, 0))}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Customer Analysis Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Top Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Top Lane</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customerAnalysis.map((customer, index) => (
                <tr key={customer.customer} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span>{customer.customer}</span>
                      {index < 3 && (
                        <Award className={`h-4 w-4 ${
                          index === 0 ? 'text-yellow-500' : 
                          index === 1 ? 'text-gray-400' : 'text-orange-500'
                        }`} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{customer.totalShipments}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(customer.totalRevenue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(customer.totalProfit)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      customer.avgMargin >= 20 ? 'bg-green-100 text-green-800' :
                      customer.avgMargin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                      customer.avgMargin >= 10 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {customer.avgMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <Truck className="h-3 w-3 text-gray-400" />
                      <span>{customer.topCarrier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span>{customer.topLane}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span>{customer.recentShipments}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCarrierAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carrierAnalysis.map((carrier, index) => (
                <tr key={carrier.carrier} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span>{carrier.carrier}</span>
                      {index < 3 && (
                        <Award className={`h-4 w-4 ${
                          index === 0 ? 'text-yellow-500' : 
                          index === 1 ? 'text-gray-400' : 'text-orange-500'
                        }`} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.shipmentCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(carrier.totalRevenue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(carrier.totalProfit)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      carrier.avgMargin >= 20 ? 'bg-green-100 text-green-800' :
                      carrier.avgMargin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                      carrier.avgMargin >= 10 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {carrier.avgMargin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderLaneAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lane</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {laneAnalysis.map((lane, index) => (
                <tr key={lane.lane} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{lane.lane}</span>
                      {index < 3 && (
                        <Award className={`h-4 w-4 ${
                          index === 0 ? 'text-yellow-500' : 
                          index === 1 ? 'text-gray-400' : 'text-orange-500'
                        }`} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{lane.shipmentCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(lane.totalRevenue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(lane.totalProfit)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lane.avgMargin >= 20 ? 'bg-green-100 text-green-800' :
                      lane.avgMargin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                      lane.avgMargin >= 10 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {lane.avgMargin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
              <p className="text-sm text-gray-600">
                Analyze profit margins across customers, carriers, and shipping lanes
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => loadAnalysis()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportAnalysis}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Filter</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers ({customers.length})</option>
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="margin">Margin %</option>
              <option value="revenue">Revenue</option>
              <option value="shipments">Shipments</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'customers', label: 'Customer Analysis', icon: Users },
            { id: 'carriers', label: 'Carrier Analysis', icon: Truck },
            { id: 'lanes', label: 'Lane Analysis', icon: MapPin }
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

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Tab Content */}
      {!loading && (
        <>
          {activeTab === 'customers' && renderCustomerAnalysis()}
          {activeTab === 'carriers' && renderCarrierAnalysis()}
          {activeTab === 'lanes' && renderLaneAnalysis()}
        </>
      )}
    </div>
  );
};