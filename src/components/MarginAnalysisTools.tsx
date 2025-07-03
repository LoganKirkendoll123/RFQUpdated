import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Truck, 
  DollarSign,
  Search,
  RefreshCw,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Percent,
  Plus,
  Minus,
  Equal,
  Info
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface CustomerCarrier {
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
  "Shipment ID": string;
  "Customer": string;
  "Carrier": string;
  "SCAC": string;
  "Price": number;
  "Cost": number;
  "Profit": number;
  "Margin": number;
  "Origin Postal Code": string;
  "Destination Postal Code": string;
  "Total Weight": string;
  "Pickup Date": string;
}

interface MarginCalculation {
  currentCost: number;
  targetPrice: number;
  requiredMargin: number;
  currentMargin: number;
  marginDifference: number;
  profitDifference: number;
}

interface CarrierComparison {
  carrierCode: string;
  carrierName: string;
  avgMargin: number;
  avgCost: number;
  avgPrice: number;
  shipmentCount: number;
  totalVolume: number;
  profitability: number;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new-customer' | 'rate-negotiation' | 'carrier-comparison'>('new-customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Data state
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  
  // New Customer Margin Calculator
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [benchmarkShipments, setBenchmarkShipments] = useState<Shipment[]>([]);
  const [proposedMargin, setProposedMargin] = useState<number>(15);
  
  // Rate Negotiation Calculator
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [newNegotiatedRate, setNewNegotiatedRate] = useState<number>(0);
  const [marginCalculation, setMarginCalculation] = useState<MarginCalculation | null>(null);
  
  // Carrier Comparison
  const [carrierComparisons, setCarrierComparisons] = useState<CarrierComparison[]>([]);
  const [comparisonPeriod, setComparisonPeriod] = useState<'30' | '90' | '365'>('90');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load customer carriers
      const { data: ccData, error: ccError } = await supabase
        .from('CustomerCarriers')
        .select('*');
      
      if (ccError) throw ccError;
      setCustomerCarriers(ccData || []);
      
      // Load shipments
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('Shipments')
        .select(`
          "Shipment ID",
          "Customer",
          "Carrier",
          "SCAC",
          "Price",
          "Cost",
          "Profit",
          "Margin",
          "Origin Postal Code",
          "Destination Postal Code",
          "Total Weight",
          "Pickup Date"
        `)
        .not('Price', 'is', null)
        .not('Cost', 'is', null);
      
      if (shipmentError) throw shipmentError;
      setShipments(shipmentData || []);
      
      // Extract unique customers and carriers
      const uniqueCustomers = [...new Set(ccData?.map(cc => cc.InternalName).filter(Boolean))];
      const uniqueCarriers = [...new Set(ccData?.map(cc => cc.P44CarrierCode).filter(Boolean))];
      
      setCustomers(uniqueCustomers);
      setCarriers(uniqueCarriers);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateNewCustomerMargin = async () => {
    if (!selectedCustomer || !selectedCarrier) return;
    
    setLoading(true);
    try {
      // Find similar shipments for benchmarking
      const { data: similarShipments, error } = await supabase
        .from('Shipments')
        .select('*')
        .eq('SCAC', selectedCarrier)
        .not('Price', 'is', null)
        .not('Cost', 'is', null)
        .limit(50);
      
      if (error) throw error;
      setBenchmarkShipments(similarShipments || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate margin');
    } finally {
      setLoading(false);
    }
  };

  const calculateRateNegotiationImpact = async () => {
    if (!selectedShipmentId || !newNegotiatedRate) return;
    
    const shipment = shipments.find(s => s["Shipment ID"] === selectedShipmentId);
    if (!shipment) return;
    
    const currentCost = shipment.Cost;
    const targetPrice = shipment.Price;
    const requiredMargin = ((targetPrice - newNegotiatedRate) / newNegotiatedRate) * 100;
    const currentMargin = shipment.Margin || 0;
    const marginDifference = requiredMargin - currentMargin;
    const profitDifference = (targetPrice - newNegotiatedRate) - (targetPrice - currentCost);
    
    setMarginCalculation({
      currentCost,
      targetPrice,
      requiredMargin,
      currentMargin,
      marginDifference,
      profitDifference
    });
  };

  const loadCarrierComparison = async () => {
    setLoading(true);
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(comparisonPeriod));
      
      const { data: recentShipments, error } = await supabase
        .from('Shipments')
        .select('*')
        .gte('Pickup Date', daysAgo.toISOString().split('T')[0])
        .not('Price', 'is', null)
        .not('Cost', 'is', null);
      
      if (error) throw error;
      
      // Group by carrier and calculate metrics
      const carrierMetrics = new Map<string, {
        costs: number[];
        prices: number[];
        margins: number[];
        weights: number[];
        shipmentCount: number;
      }>();
      
      recentShipments?.forEach(shipment => {
        const carrierCode = shipment.SCAC || shipment.Carrier;
        if (!carrierCode) return;
        
        if (!carrierMetrics.has(carrierCode)) {
          carrierMetrics.set(carrierCode, {
            costs: [],
            prices: [],
            margins: [],
            weights: [],
            shipmentCount: 0
          });
        }
        
        const metrics = carrierMetrics.get(carrierCode)!;
        metrics.costs.push(shipment.Cost);
        metrics.prices.push(shipment.Price);
        metrics.margins.push(shipment.Margin || 0);
        metrics.weights.push(parseFloat(shipment["Total Weight"] || '0'));
        metrics.shipmentCount++;
      });
      
      // Calculate comparison data
      const comparisons: CarrierComparison[] = Array.from(carrierMetrics.entries()).map(([carrierCode, metrics]) => {
        const avgCost = metrics.costs.reduce((sum, cost) => sum + cost, 0) / metrics.costs.length;
        const avgPrice = metrics.prices.reduce((sum, price) => sum + price, 0) / metrics.prices.length;
        const avgMargin = metrics.margins.reduce((sum, margin) => sum + margin, 0) / metrics.margins.length;
        const totalVolume = metrics.weights.reduce((sum, weight) => sum + weight, 0);
        const profitability = avgPrice - avgCost;
        
        return {
          carrierCode,
          carrierName: carrierCode, // Could be enhanced with carrier name lookup
          avgMargin,
          avgCost,
          avgPrice,
          shipmentCount: metrics.shipmentCount,
          totalVolume,
          profitability
        };
      });
      
      // Sort by profitability
      comparisons.sort((a, b) => b.profitability - a.profitability);
      setCarrierComparisons(comparisons);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carrier comparison');
    } finally {
      setLoading(false);
    }
  };

  const renderNewCustomerTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Customer Margin Calculator</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Customer</option>
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier</label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Carrier</option>
              {carriers.map(carrier => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proposed Margin %</label>
            <input
              type="number"
              value={proposedMargin}
              onChange={(e) => setProposedMargin(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              step="0.1"
            />
          </div>
        </div>
        
        <button
          onClick={calculateNewCustomerMargin}
          disabled={!selectedCustomer || !selectedCarrier || loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          <Calculator className="h-4 w-4" />
          <span>Calculate Benchmark</span>
        </button>
      </div>
      
      {benchmarkShipments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Benchmark Analysis</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {benchmarkShipments.length}
              </div>
              <div className="text-sm text-blue-800">Similar Shipments</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {(benchmarkShipments.reduce((sum, s) => sum + (s.Margin || 0), 0) / benchmarkShipments.length).toFixed(1)}%
              </div>
              <div className="text-sm text-green-800">Avg Current Margin</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(benchmarkShipments.reduce((sum, s) => sum + s.Cost, 0) / benchmarkShipments.length)}
              </div>
              <div className="text-sm text-purple-800">Avg Cost</div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {proposedMargin.toFixed(1)}%
              </div>
              <div className="text-sm text-orange-800">Proposed Margin</div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 mb-2">Margin Recommendation</h5>
            <p className="text-sm text-gray-700">
              Based on {benchmarkShipments.length} similar shipments with {selectedCarrier}, 
              the average margin is {(benchmarkShipments.reduce((sum, s) => sum + (s.Margin || 0), 0) / benchmarkShipments.length).toFixed(1)}%. 
              Your proposed {proposedMargin}% margin is {proposedMargin > (benchmarkShipments.reduce((sum, s) => sum + (s.Margin || 0), 0) / benchmarkShipments.length) ? 'above' : 'below'} market average.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderRateNegotiationTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Negotiation Impact Calculator</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Shipment</label>
            <select
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Shipment</option>
              {shipments.slice(0, 100).map(shipment => (
                <option key={shipment["Shipment ID"]} value={shipment["Shipment ID"]}>
                  {shipment["Shipment ID"]} - {shipment.Customer} - {formatCurrency(shipment.Price)}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Negotiated Rate</label>
            <input
              type="number"
              value={newNegotiatedRate}
              onChange={(e) => setNewNegotiatedRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new carrier rate"
              step="0.01"
            />
          </div>
        </div>
        
        <button
          onClick={calculateRateNegotiationImpact}
          disabled={!selectedShipmentId || !newNegotiatedRate || loading}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          <Calculator className="h-4 w-4" />
          <span>Calculate Impact</span>
        </button>
      </div>
      
      {marginCalculation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Margin Impact Analysis</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h5 className="font-medium text-gray-900">Current Situation</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Cost:</span>
                  <span className="font-medium">{formatCurrency(marginCalculation.currentCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Target Price:</span>
                  <span className="font-medium">{formatCurrency(marginCalculation.targetPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Margin:</span>
                  <span className="font-medium">{marginCalculation.currentMargin.toFixed(2)}%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h5 className="font-medium text-gray-900">After Negotiation</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">New Cost:</span>
                  <span className="font-medium">{formatCurrency(newNegotiatedRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Required Margin:</span>
                  <span className={`font-medium ${marginCalculation.requiredMargin > marginCalculation.currentMargin ? 'text-green-600' : 'text-red-600'}`}>
                    {marginCalculation.requiredMargin.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Margin Change:</span>
                  <span className={`font-medium ${marginCalculation.marginDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marginCalculation.marginDifference > 0 ? '+' : ''}{marginCalculation.marginDifference.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Profit Impact:</span>
                  <span className={`font-medium ${marginCalculation.profitDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marginCalculation.profitDifference > 0 ? '+' : ''}{formatCurrency(marginCalculation.profitDifference)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className={`mt-6 p-4 rounded-lg ${marginCalculation.marginDifference > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center space-x-2">
              {marginCalculation.marginDifference > 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <span className={`font-medium ${marginCalculation.marginDifference > 0 ? 'text-green-800' : 'text-red-800'}`}>
                {marginCalculation.marginDifference > 0 
                  ? `Margin improvement of ${marginCalculation.marginDifference.toFixed(2)}% - Favorable negotiation!`
                  : `Margin reduction of ${Math.abs(marginCalculation.marginDifference).toFixed(2)}% - Consider price adjustment.`
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCarrierComparisonTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Carrier Performance Comparison</h3>
          <div className="flex items-center space-x-4">
            <select
              value={comparisonPeriod}
              onChange={(e) => setComparisonPeriod(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last Year</option>
            </select>
            <button
              onClick={loadCarrierComparison}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Analyze</span>
            </button>
          </div>
        </div>
      </div>
      
      {carrierComparisons.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profitability</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {carrierComparisons.map((carrier, index) => (
                  <tr key={carrier.carrierCode} className={index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Truck className="h-4 w-4 text-gray-400" />
                        <span>{carrier.carrierCode}</span>
                        {index === 0 && <Target className="h-4 w-4 text-green-600" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{carrier.shipmentCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`font-medium ${carrier.avgMargin > 15 ? 'text-green-600' : carrier.avgMargin > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {carrier.avgMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(carrier.avgCost)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(carrier.avgPrice)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`font-medium ${carrier.profitability > 200 ? 'text-green-600' : carrier.profitability > 100 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatCurrency(carrier.profitability)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {(carrier.totalVolume / 1000).toFixed(1)}k lbs
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Calculate margins for new customers, analyze rate negotiations, and compare carrier performance
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'new-customer', label: 'New Customer Margins', icon: Users },
            { id: 'rate-negotiation', label: 'Rate Negotiation', icon: TrendingUp },
            { id: 'carrier-comparison', label: 'Carrier Comparison', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
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
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'new-customer' && renderNewCustomerTab()}
      {activeTab === 'rate-negotiation' && renderRateNegotiationTab()}
      {activeTab === 'carrier-comparison' && renderCarrierComparisonTab()}
    </div>
  );
};