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
  Info,
  Filter,
  Calendar,
  Loader,
  MapPin
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { RFQRow } from '../types';

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
  "Price"?: number;
  "Cost"?: number;
  "Profit"?: number;
  "Margin"?: number;
  "Origin Postal Code": string;
  "Destination Postal Code": string;
  "Total Weight": string;
  "Pickup Date": string;
  "Origin City"?: string;
  "Origin State"?: string;
  "Destination City"?: string;
  "Destination State"?: string;
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

interface MarginDiscoveryResult {
  customerName: string;
  shipmentCount: number;
  avgCompetitorPrice: number;
  avgNewCarrierCost: number;
  recommendedMargin: number;
  competitorMargins: {
    carrierCode: string;
    avgMargin: number;
    shipmentCount: number;
  }[];
}

interface ShipmentWithRates {
  originalShipment: Shipment;
  newCarrierRate: number;
  competitorRates: {
    carrierCode: string;
    rate: number;
    customerPrice: number;
    margin: number;
  }[];
  recommendedMargin: number;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new-carrier-margin' | 'rate-negotiation' | 'carrier-comparison'>('new-carrier-margin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Data state
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  
  // New Carrier Margin Discovery
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('');
  const [newCarrierCode, setNewCarrierCode] = useState<string>('');
  const [competitorGroup, setCompetitorGroup] = useState<string>('');
  const [marginDiscoveryResults, setMarginDiscoveryResults] = useState<MarginDiscoveryResult[]>([]);
  const [processedShipments, setProcessedShipments] = useState<ShipmentWithRates[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  
  // Rate Negotiation Calculator
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [newNegotiatedRate, setNewNegotiatedRate] = useState<number>(0);
  const [marginCalculation, setMarginCalculation] = useState<MarginCalculation | null>(null);
  
  // Carrier Comparison
  const [carrierComparisons, setCarrierComparisons] = useState<CarrierComparison[]>([]);
  const [comparisonPeriod, setComparisonPeriod] = useState<'30' | '90' | '365'>('90');

  useEffect(() => {
    // Add COEP header to prevent iframe blocking
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cross-Origin-Embedder-Policy';
    meta.content = 'credentialless';
    document.head.appendChild(meta);
    
    loadInitialData();
    
    return () => {
      // Clean up the meta tag when component unmounts
      document.head.removeChild(meta);
    };
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
          "Origin City",
          "Origin State",
          "Destination City",
          "Destination State",
          "Total Weight",
          "Pickup Date"
        `)
        .order('Pickup Date', { ascending: false })
        .limit(500);
      
      if (shipmentError) throw shipmentError;
      setShipments(shipmentData || []);
      
      // Extract unique customers and carriers
      const uniqueCustomers = [...new Set((ccData || []).map(cc => cc.InternalName).filter(Boolean))];
      setCustomers(uniqueCustomers);
      
      // Set default dates for the last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      
      // Load carrier groups from Project44
      await loadCarrierGroups();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCarrierGroups = async () => {
    try {
      // Initialize Project44 client
      const p44Config = loadProject44Config();
      if (!p44Config) {
        throw new Error('Project44 configuration not found');
      }
      
      const p44Client = new Project44APIClient(p44Config);
      
      // Load carrier groups
      const groups = await p44Client.getAvailableCarriersByGroup();
      setCarrierGroups(groups);
      
      // Extract unique carriers
      const allCarriers: string[] = [];
      groups.forEach(group => {
        group.carriers.forEach(carrier => {
          if (carrier.id && !allCarriers.includes(carrier.id)) {
            allCarriers.push(carrier.id);
          }
        });
      });
      
      setCarriers(allCarriers);
      
    } catch (err) {
      console.error('Error loading carrier groups:', err);
      setError('Failed to load carrier groups from Project44. Please check your API configuration.');
    }
  };

  const runMarginDiscovery = async () => {
    if (!newCarrierCode || !competitorGroup) {
      setError('Please select a new carrier and competitor group');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    setProcessedShipments([]);
    setMarginDiscoveryResults([]);
    
    try {
      // 1. Get shipments within the date range
      let query = supabase
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
          "Origin City",
          "Origin State",
          "Destination City",
          "Destination State",
          "Total Weight",
          "Pickup Date"
        `);
      
      if (startDate) {
        query = query.gte('Pickup Date', startDate);
      }
      
      if (endDate) {
        query = query.lte('Pickup Date', endDate);
      }
      
      if (selectedCustomerFilter) {
        query = query.eq('Customer', selectedCustomerFilter);
      }
      
      const { data: filteredShipments, error: shipmentError } = await query;
      
      if (shipmentError) throw shipmentError;
      
      if (!filteredShipments || filteredShipments.length === 0) {
        setError('No shipments found matching the criteria');
        setIsProcessing(false);
        return;
      }
      
      // 2. Get competitor carriers in the selected group
      const selectedGroup = carrierGroups.find(group => group.groupCode === competitorGroup);
      if (!selectedGroup) {
        setError('Selected competitor group not found');
        setIsProcessing(false);
        return;
      }
      
      const competitorCarriers = selectedGroup.carriers.map(c => c.id).filter(id => id !== newCarrierCode);
      if (competitorCarriers.length === 0) {
        setError('No competitor carriers found in the selected group');
        setIsProcessing(false);
        return;
      }
      
      // 3. Get customer-carrier margins
      const { data: margins, error: marginsError } = await supabase
        .from('CustomerCarriers')
        .select('*');
      
      if (marginsError) throw marginsError;
      
      // 4. Process each shipment
      const totalShipments = Math.min(filteredShipments.length, 20); // Limit to 20 shipments for performance
      setTotalSteps(totalShipments);
      
      const processedResults: ShipmentWithRates[] = [];
      
      // Initialize Project44 client
      const p44Config = loadProject44Config();
      if (!p44Config) {
        throw new Error('Project44 configuration not found');
      }
      
      const p44Client = new Project44APIClient(p44Config);
      
      // Process shipments
      for (let i = 0; i < totalShipments; i++) {
        setCurrentStep(i + 1);
        const shipment = filteredShipments[i];
        
        // Create RFQ from shipment
        const rfq: RFQRow = {
          fromDate: shipment["Pickup Date"] || new Date().toISOString().split('T')[0],
          fromZip: shipment["Origin Postal Code"] || '',
          toZip: shipment["Destination Postal Code"] || '',
          pallets: 1, // Default value
          grossWeight: parseFloat(shipment["Total Weight"] || '0'),
          isStackable: false,
          accessorial: [],
          originCity: shipment["Origin City"] || '',
          originState: shipment["Origin State"] || '',
          destinationCity: shipment["Destination City"] || '',
          destinationState: shipment["Destination State"] || ''
        };
        
        // Get rate from new carrier
        let newCarrierRate = 0;
        try {
          const newCarrierQuotes = await p44Client.getQuotes(rfq, [newCarrierCode]);
          if (newCarrierQuotes.length > 0) {
            newCarrierRate = newCarrierQuotes[0].baseRate + newCarrierQuotes[0].fuelSurcharge + newCarrierQuotes[0].premiumsAndDiscounts;
          }
        } catch (err) {
          console.error('Error getting new carrier rate:', err);
        }
        
        // Get rates from competitor carriers
        const competitorRates: {
          carrierCode: string;
          rate: number;
          customerPrice: number;
          margin: number;
        }[] = [];
        
        for (const competitorCode of competitorCarriers) {
          try {
            const competitorQuotes = await p44Client.getQuotes(rfq, [competitorCode]);
            if (competitorQuotes.length > 0) {
              const rate = competitorQuotes[0].baseRate + competitorQuotes[0].fuelSurcharge + competitorQuotes[0].premiumsAndDiscounts;
              
              // Find margin for this customer-carrier combination
              const customerName = shipment.Customer;
              const margin = (margins || []).find(m => 
                m.InternalName === customerName && m.P44CarrierCode === competitorCode
              );
              
              const marginPercentage = margin ? parseFloat(margin.Percentage || '0') : 0;
              const customerPrice = marginPercentage > 0 ? 
                rate / (1 - (marginPercentage / 100)) : 
                rate;
              
              competitorRates.push({
                carrierCode: competitorCode,
                rate,
                customerPrice,
                margin: marginPercentage
              });
            }
          } catch (err) {
            console.error(`Error getting competitor rate for ${competitorCode}:`, err);
          }
        }
        
        // Calculate recommended margin
        let recommendedMargin = 0;
        if (newCarrierRate > 0 && competitorRates.length > 0) {
          // Find average competitor price
          const avgCompetitorPrice = competitorRates.reduce((sum, cr) => sum + cr.customerPrice, 0) / competitorRates.length;
          
          // Calculate margin needed to match average competitor price
          if (avgCompetitorPrice > newCarrierRate) {
            recommendedMargin = ((avgCompetitorPrice - newCarrierRate) / avgCompetitorPrice) * 100;
          }
        }
        
        processedResults.push({
          originalShipment: shipment,
          newCarrierRate,
          competitorRates,
          recommendedMargin
        });
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setProcessedShipments(processedResults);
      
      // 5. Aggregate results by customer
      const customerResults = new Map<string, {
        shipmentCount: number;
        totalCompetitorPrice: number;
        totalNewCarrierCost: number;
        totalRecommendedMargin: number;
        competitorMargins: Map<string, {total: number; count: number}>;
      }>();
      
      for (const result of processedResults) {
        const customerName = result.originalShipment.Customer || 'Unknown';
        
        if (!customerResults.has(customerName)) {
          customerResults.set(customerName, {
            shipmentCount: 0,
            totalCompetitorPrice: 0,
            totalNewCarrierCost: 0,
            totalRecommendedMargin: 0,
            competitorMargins: new Map()
          });
        }
        
        const customerData = customerResults.get(customerName)!;
        customerData.shipmentCount++;
        
        // Calculate average competitor price for this shipment
        const avgCompetitorPrice = result.competitorRates.reduce((sum, cr) => sum + cr.customerPrice, 0) / 
                                  (result.competitorRates.length || 1);
        
        customerData.totalCompetitorPrice += avgCompetitorPrice;
        customerData.totalNewCarrierCost += result.newCarrierRate;
        customerData.totalRecommendedMargin += result.recommendedMargin;
        
        // Track competitor margins
        for (const compRate of result.competitorRates) {
          if (!customerData.competitorMargins.has(compRate.carrierCode)) {
            customerData.competitorMargins.set(compRate.carrierCode, {total: 0, count: 0});
          }
          
          const marginData = customerData.competitorMargins.get(compRate.carrierCode)!;
          marginData.total += compRate.margin;
          marginData.count++;
        }
      }
      
      // Convert to final results format
      const finalResults: MarginDiscoveryResult[] = [];
      
      for (const [customerName, data] of customerResults.entries()) {
        const avgCompetitorPrice = data.totalCompetitorPrice / data.shipmentCount;
        const avgNewCarrierCost = data.totalNewCarrierCost / data.shipmentCount;
        const avgRecommendedMargin = data.totalRecommendedMargin / data.shipmentCount;
        
        const competitorMarginsList = Array.from(data.competitorMargins.entries()).map(([carrierCode, marginData]) => ({
          carrierCode,
          avgMargin: marginData.total / marginData.count,
          shipmentCount: marginData.count
        }));
        
        finalResults.push({
          customerName,
          shipmentCount: data.shipmentCount,
          avgCompetitorPrice,
          avgNewCarrierCost,
          recommendedMargin: avgRecommendedMargin,
          competitorMargins: competitorMarginsList
        });
      }
      
      setMarginDiscoveryResults(finalResults);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run margin discovery');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateRateNegotiationImpact = async () => {
    if (!selectedShipmentId || !newNegotiatedRate) return;
    
    const shipment = shipments.find(s => s["Shipment ID"] === selectedShipmentId);
    if (!shipment) return;
    
    const currentCost = shipment.Cost || 0;
    const targetPrice = shipment.Price || 0;
    const requiredMargin = ((targetPrice - newNegotiatedRate) / targetPrice) * 100;
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

  const renderNewCarrierMarginTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Carrier Margin Discovery</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <span className="flex items-center">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Filter (Optional)</label>
            <select
              value={selectedCustomerFilter}
              onChange={(e) => setSelectedCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Carrier</label>
            <select
              value={newCarrierCode}
              onChange={(e) => setNewCarrierCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select New Carrier</option>
              {carriers.map(carrier => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Competitor Group</label>
            <select
              value={competitorGroup}
              onChange={(e) => setCompetitorGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Competitor Group</option>
              {carrierGroups.map(group => (
                <option key={group.groupCode} value={group.groupCode}>
                  {group.groupName} ({group.carriers.length} carriers)
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={runMarginDiscovery}
          disabled={!newCarrierCode || !competitorGroup || isProcessing}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          {isProcessing ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              <span>Processing {currentStep} of {totalSteps}...</span>
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4" />
              <span>Run Margin Discovery</span>
            </>
          )}
        </button>
      </div>
      
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-blue-900">Processing Shipments</h4>
            <div className="text-sm text-blue-700">
              {currentStep} of {totalSteps} shipments
            </div>
          </div>
          
          <div className="w-full bg-blue-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
          
          <p className="text-sm text-blue-700">
            Requoting shipments across all carriers to determine optimal margins...
          </p>
        </div>
      )}
      
      {marginDiscoveryResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Margin Discovery Results</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Competitor Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Carrier Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competitor Avg Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {marginDiscoveryResults.map((result) => (
                  <tr key={result.customerName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{result.customerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{result.shipmentCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(result.avgCompetitorPrice)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(result.avgNewCarrierCost)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`font-medium ${result.recommendedMargin > 15 ? 'text-green-600' : result.recommendedMargin > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {result.recommendedMargin.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {result.competitorMargins.length > 0 ? (
                        <span className="text-gray-700">
                          {(result.competitorMargins.reduce((sum, cm) => sum + cm.avgMargin, 0) / result.competitorMargins.length).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">No data</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-green-800 mb-1">How to Use These Results</h5>
                <p className="text-sm text-green-700">
                  The recommended margin for each customer is calculated by comparing the new carrier's cost with the average price 
                  customers are currently paying to competitors. This ensures your pricing remains competitive while maximizing profitability.
                </p>
                <p className="text-sm text-green-700 mt-2">
                  To implement these margins, update the "Percentage" field in the CustomerCarriers table for each customer-carrier combination.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {processedShipments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Detailed Shipment Analysis</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Carrier Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Competitor Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedShipments.map((shipment) => {
                  const avgCompetitorPrice = shipment.competitorRates.length > 0 
                    ? shipment.competitorRates.reduce((sum, cr) => sum + cr.customerPrice, 0) / shipment.competitorRates.length
                    : 0;
                    
                  return (
                    <tr key={shipment.originalShipment["Shipment ID"]} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {shipment.originalShipment["Shipment ID"]}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{shipment.originalShipment.Customer}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>
                            {shipment.originalShipment["Origin Postal Code"]} → {shipment.originalShipment["Destination Postal Code"]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(shipment.newCarrierRate)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(avgCompetitorPrice)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className={`font-medium ${shipment.recommendedMargin > 15 ? 'text-green-600' : shipment.recommendedMargin > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {shipment.recommendedMargin.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              {shipments.filter(s => s.Price && s.Cost).slice(0, 100).map(shipment => (
                <option key={shipment["Shipment ID"]} value={shipment["Shipment ID"]}>
                  {shipment["Shipment ID"]} - {shipment.Customer} - {formatCurrency(shipment.Price || 0)}
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
              Calculate optimal margins for new carriers, analyze rate negotiations, and compare carrier performance
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'new-carrier-margin', label: 'New Carrier Margin Discovery', icon: Target },
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
      {activeTab === 'new-carrier-margin' && renderNewCarrierMarginTab()}
      {activeTab === 'rate-negotiation' && renderRateNegotiationTab()}
      {activeTab === 'carrier-comparison' && renderCarrierComparisonTab()}
    </div>
  );
};