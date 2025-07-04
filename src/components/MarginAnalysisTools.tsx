import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  TrendingUp, 
  BarChart3, 
  Truck,
  Users,
  Building2,
  Search,
  Loader,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

export const MarginAnalysisTools: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  
  const [customerMargins, setCustomerMargins] = useState<any[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  
  const [stats, setStats] = useState<{
    avgMargin: number;
    minMargin: number;
    maxMargin: number;
    totalCustomers: number;
    totalCarriers: number;
    totalRelationships: number;
  }>({
    avgMargin: 0,
    minMargin: 0,
    maxMargin: 0,
    totalCustomers: 0,
    totalCarriers: 0,
    totalRelationships: 0
  });

  useEffect(() => {
    loadData();
  }, [customerFilter, carrierFilter]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Load customer-carrier margins
      let query = supabase
        .from('CustomerCarriers')
        .select(`
          "MarkupId",
          "InternalName",
          "P44CarrierCode",
          "Percentage",
          "MinDollar",
          "MaxDollar",
          customer:customers(id, name)
        `);
      
      if (customerFilter) {
        query = query.ilike('InternalName', `%${customerFilter}%`);
      }
      
      if (carrierFilter) {
        query = query.ilike('P44CarrierCode', `%${carrierFilter}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setCustomerMargins(data || []);
      
      // Calculate statistics
      if (data && data.length > 0) {
        const margins = data.map(d => parseFloat(d.Percentage || '0')).filter(m => !isNaN(m));
        const uniqueCustomers = new Set(data.map(d => d.InternalName).filter(Boolean));
        const uniqueCarriers = new Set(data.map(d => d.P44CarrierCode).filter(Boolean));
        
        setStats({
          avgMargin: margins.reduce((sum, m) => sum + m, 0) / margins.length,
          minMargin: Math.min(...margins),
          maxMargin: Math.max(...margins),
          totalCustomers: uniqueCustomers.size,
          totalCarriers: uniqueCarriers.size,
          totalRelationships: data.length
        });
      }
      
      // Load unique customers and carriers for filters
      await loadFilters();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load margin data';
      setError(errorMsg);
      console.error('❌ Failed to load margin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      // Load unique customers
      const { data: customerData, error: customerError } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null)
        .order('InternalName');
      
      if (customerError) throw customerError;
      
      const uniqueCustomers = [...new Set(customerData?.map(d => d.InternalName).filter(Boolean))];
      setCustomers(uniqueCustomers);
      
      // Load unique carriers
      const { data: carrierData, error: carrierError } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode')
        .not('P44CarrierCode', 'is', null)
        .order('P44CarrierCode');
      
      if (carrierError) throw carrierError;
      
      const uniqueCarriers = [...new Set(carrierData?.map(d => d.P44CarrierCode).filter(Boolean))];
      setCarriers(uniqueCarriers);
    } catch (err) {
      console.error('❌ Failed to load filters:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h2>
            <p className="text-sm text-gray-600">
              Analyze customer-carrier margins and pricing strategies
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="Filter by customer name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                list="customer-list"
              />
              <datalist id="customer-list">
                {customers.map(customer => (
                  <option key={customer} value={customer} />
                ))}
              </datalist>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Carrier
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
                placeholder="Filter by carrier code..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                list="carrier-list"
              />
              <datalist id="carrier-list">
                {carriers.map(carrier => (
                  <option key={carrier} value={carrier} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Margin</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgMargin.toFixed(1)}%</p>
              <p className="text-sm text-gray-500">
                Range: {stats.minMargin.toFixed(1)}% - {stats.maxMargin.toFixed(1)}%
              </p>
            </div>
            <Percent className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
              <p className="text-sm text-gray-500">
                With custom margins
              </p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Carriers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCarriers}</p>
              <p className="text-sm text-gray-500">
                {stats.totalRelationships} total relationships
              </p>
            </div>
            <Truck className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Margin Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Customer-Carrier Margins</h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Dollar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Dollar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer ID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customerMargins.map((margin) => (
                  <tr key={margin.MarkupId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{margin.InternalName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Truck className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{margin.P44CarrierCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        parseFloat(margin.Percentage || '0') > 20 ? 'bg-green-100 text-green-800' :
                        parseFloat(margin.Percentage || '0') > 10 ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {margin.Percentage || '0'}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {margin.MinDollar ? formatCurrency(margin.MinDollar) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {margin.MaxDollar ? formatCurrency(parseFloat(margin.MaxDollar)) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {margin.customer?.id ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-gray-500">{margin.customer.id.substring(0, 8)}...</span>
                        </div>
                      ) : (
                        <span className="text-xs text-red-500">Not linked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {customerMargins.length === 0 && !loading && !error && (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No margin data found</p>
          </div>
        )}
      </div>

      {/* Margin Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Margin Analysis</h3>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Margin Strategy Insights</p>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                  <li>Average margin across all customers: <strong>{stats.avgMargin.toFixed(1)}%</strong></li>
                  <li>Margin range: <strong>{stats.minMargin.toFixed(1)}% - {stats.maxMargin.toFixed(1)}%</strong></li>
                  <li>Total customer-carrier relationships: <strong>{stats.totalRelationships}</strong></li>
                  <li>Customers with custom margins: <strong>{stats.totalCustomers}</strong></li>
                  <li>Carriers with custom pricing: <strong>{stats.totalCarriers}</strong></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <DollarSign className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800 mb-1">Pricing Recommendations</p>
                <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                  <li>Consider setting minimum margin of <strong>15%</strong> for all customers</li>
                  <li>High-volume customers should have margins between <strong>15-20%</strong></li>
                  <li>Premium service customers can support margins of <strong>20-25%</strong></li>
                  <li>Set minimum dollar amount of <strong>$100</strong> for small shipments</li>
                  <li>Review margins quarterly based on carrier performance</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};