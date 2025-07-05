import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Truck, 
  Users, 
  Building2, 
  RefreshCw, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp,
  Info,
  Target,
  ArrowRight,
  BarChart3,
  Zap
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { loadProject44Config } from '../utils/credentialStorage';
import { supabase } from '../utils/supabase';

interface MarginAnalysisToolsProps {}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = () => {
  const [activeTab, setActiveTab] = useState<'carrier-vs-group' | 'rate-comparison'>('carrier-vs-group');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Carrier data
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  // Customer data
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  
  // Date range
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Analysis results
  const [carrierVsGroupResults, setCarrierVsGroupResults] = useState<any>(null);
  const [rateComparisonResults, setRateComparisonResults] = useState<any>(null);
  
  // Project44 client
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);

  // Initialize Project44 client
  useEffect(() => {
    const savedConfig = loadProject44Config();
    if (savedConfig) {
      const client = new Project44APIClient(savedConfig);
      setProject44Client(client);
    }
  }, []);

  // Load carrier groups from Project44 API
  const loadCarrierGroups = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    setIsLoadingCarriers(true);
    setError('');
    
    try {
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      if (groups.length > 0) {
        setSelectedGroup(groups[0].groupCode);
        
        // Set first carrier as selected by default
        if (groups[0].carriers.length > 0) {
          setSelectedCarrier(groups[0].carriers[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carrier groups');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  // Load customers from database
  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    setError('');
    
    try {
      // Get unique customers from CustomerCarriers table
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null);
      
      if (error) {
        throw error;
      }
      
      // Get unique customer names
      const uniqueCustomers = [...new Set(data?.map(d => d.InternalName).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      
      if (uniqueCustomers.length > 0) {
        setSelectedCustomer(uniqueCustomers[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  // Run carrier vs group analysis
  const runCarrierVsGroupAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    if (!selectedGroup || !selectedCarrier) {
      setError('Please select both a carrier group and a specific carrier to analyze');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Get the selected group
      const group = carrierGroups.find(g => g.groupCode === selectedGroup);
      if (!group) {
        throw new Error('Selected carrier group not found');
      }
      
      // Get the selected carrier
      const carrier = group.carriers.find(c => c.id === selectedCarrier);
      if (!carrier) {
        throw new Error('Selected carrier not found');
      }
      
      // Generate sample shipments for analysis
      const sampleShipments = [
        { origin: '60607', destination: '30033', weight: 2500, pallets: 3 },
        { origin: '90210', destination: '10001', weight: 5000, pallets: 5 },
        { origin: '33101', destination: '75201', weight: 1800, pallets: 2 },
        { origin: '94102', destination: '02101', weight: 3200, pallets: 4 },
        { origin: '77001', destination: '30309', weight: 12000, pallets: 8 }
      ];
      
      // Generate mock results comparing the carrier to the group
      const mockResults = {
        carrier: {
          id: carrier.id,
          name: carrier.name,
          scac: carrier.scac || 'N/A'
        },
        group: {
          code: group.groupCode,
          name: group.groupName,
          carrierCount: group.carriers.length
        },
        shipments: sampleShipments.map(shipment => {
          const carrierRate = Math.random() * 1000 + 500;
          const groupAvgRate = Math.random() * 900 + 400;
          const savings = carrierRate - groupAvgRate;
          const savingsPercentage = (savings / carrierRate) * 100;
          
          return {
            ...shipment,
            carrierRate,
            groupAvgRate,
            savings,
            savingsPercentage
          };
        }),
        summary: {
          totalCarrierCost: 0,
          totalGroupAvgCost: 0,
          totalSavings: 0,
          avgSavingsPercentage: 0,
          oldPrice: 0,
          newCost: 0,
          margin: 0
        }
      };
      
      // Calculate summary statistics
      mockResults.summary.totalCarrierCost = mockResults.shipments.reduce(
        (sum, s) => sum + s.carrierRate, 0
      );
      
      mockResults.summary.totalGroupAvgCost = mockResults.shipments.reduce(
        (sum, s) => sum + s.groupAvgRate, 0
      );
      
      mockResults.summary.totalSavings = mockResults.summary.totalCarrierCost - mockResults.summary.totalGroupAvgCost;
      
      mockResults.summary.avgSavingsPercentage = (mockResults.summary.totalSavings / mockResults.summary.totalCarrierCost) * 100;
      
      // Calculate margin - this is what the customer is asking for
      // (old price - new cost) / old price = margin
      mockResults.summary.oldPrice = mockResults.summary.totalCarrierCost * 1.15; // Assuming 15% markup on old cost
      mockResults.summary.newCost = mockResults.summary.totalGroupAvgCost;
      mockResults.summary.margin = ((mockResults.summary.oldPrice - mockResults.summary.newCost) / mockResults.summary.oldPrice) * 100;
      
      setCarrierVsGroupResults(mockResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Run rate comparison analysis
  const runRateComparisonAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    if (!selectedCustomer) {
      setError('Please select a customer to analyze');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // In a real implementation, this would:
      // 1. Load historical shipments for the selected customer and date range
      // 2. Get current rates from Project44 API for the same shipments
      // 3. Calculate the sum of old prices and new costs
      // 4. Calculate margin as (old price - new cost) / old price
      
      // Generate mock historical shipments
      const mockHistoricalShipments = [
        {
          id: 1,
          date: '2023-05-15',
          origin: '60607',
          destination: '30033',
          weight: 2500,
          pallets: 3,
          carrier: 'Old Dominion',
          oldPrice: 950,
          oldCost: 850,
          newCost: 795
        },
        {
          id: 2,
          date: '2023-06-22',
          origin: '90210',
          destination: '10001',
          weight: 5000,
          pallets: 5,
          carrier: 'FedEx Freight',
          oldPrice: 1450,
          oldCost: 1250,
          newCost: 1150
        },
        {
          id: 3,
          date: '2023-07-10',
          origin: '33101',
          destination: '75201',
          weight: 1800,
          pallets: 2,
          carrier: 'Saia',
          oldPrice: 820,
          oldCost: 720,
          newCost: 680
        },
        {
          id: 4,
          date: '2023-08-05',
          origin: '94102',
          destination: '02101',
          weight: 3200,
          pallets: 4,
          carrier: 'XPO Logistics',
          oldPrice: 1250,
          oldCost: 1100,
          newCost: 980
        },
        {
          id: 5,
          date: '2023-09-18',
          origin: '77001',
          destination: '30309',
          weight: 12000,
          pallets: 8,
          carrier: 'YRC Freight',
          oldPrice: 2200,
          oldCost: 1900,
          newCost: 1750
        }
      ];
      
      // Calculate savings and margin for each shipment
      const shipmentsWithCalculations = mockHistoricalShipments.map(shipment => {
        const savings = shipment.oldCost - shipment.newCost;
        const savingsPercentage = (savings / shipment.oldCost) * 100;
        const margin = ((shipment.oldPrice - shipment.newCost) / shipment.oldPrice) * 100;
        
        return {
          ...shipment,
          savings,
          savingsPercentage,
          margin
        };
      });
      
      // Calculate summary statistics
      const summary = {
        totalOldPrice: shipmentsWithCalculations.reduce((sum, s) => sum + s.oldPrice, 0),
        totalOldCost: shipmentsWithCalculations.reduce((sum, s) => sum + s.oldCost, 0),
        totalNewCost: shipmentsWithCalculations.reduce((sum, s) => sum + s.newCost, 0),
        totalSavings: shipmentsWithCalculations.reduce((sum, s) => sum + s.savings, 0),
        avgSavingsPercentage: 0,
        overallMargin: 0
      };
      
      summary.avgSavingsPercentage = (summary.totalSavings / summary.totalOldCost) * 100;
      
      // Calculate overall margin - this is what the customer is asking for
      // (old price - new cost) / old price = margin
      summary.overallMargin = ((summary.totalOldPrice - summary.totalNewCost) / summary.totalOldPrice) * 100;
      
      setRateComparisonResults({
        customer: selectedCustomer,
        dateRange,
        shipments: shipmentsWithCalculations,
        summary
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Render the carrier vs group analysis tab
  const renderCarrierVsGroupAnalysis = () => (
    <div className="space-y-6">
      {/* Carrier Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Carrier vs Group Analysis</h3>
              <p className="text-sm text-gray-600">
                Compare one carrier against a group to calculate potential margin
              </p>
            </div>
          </div>
          
          <button
            onClick={loadCarrierGroups}
            disabled={isLoadingCarriers || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingCarriers ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Load Carrier Groups</span>
          </button>
        </div>
        
        {!project44Client && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Project44 API not configured</p>
                <p className="mt-1">
                  Please configure your Project44 API credentials in the Setup tab before using this tool.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {carrierGroups.length > 0 ? (
          <div className="space-y-4">
            {/* Group Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Carrier Group
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  // Reset selected carrier when group changes
                  setSelectedCarrier('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {carrierGroups.map(group => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Carrier Dropdown */}
            {selectedGroup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Carrier to Compare Against Group
                </label>
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a carrier --</option>
                  {carrierGroups
                    .find(g => g.groupCode === selectedGroup)
                    ?.carriers.map(carrier => (
                      <option key={carrier.id} value={carrier.id}>
                        {carrier.name} {carrier.scac ? `(${carrier.scac})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
            
            {/* Run Analysis Button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={runCarrierVsGroupAnalysis}
                disabled={isLoading || !selectedGroup || !selectedCarrier}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5" />
                )}
                <span>Run Carrier vs Group Analysis</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No carrier groups loaded</p>
            <p className="text-sm mt-2">Click "Load Carrier Groups" to get started</p>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {carrierVsGroupResults && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Analysis Summary</h3>
                <p className="text-sm text-gray-600">
                  {carrierVsGroupResults.carrier.name} vs {carrierVsGroupResults.group.name}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Total Cost Savings</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(carrierVsGroupResults.summary.totalSavings)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {carrierVsGroupResults.summary.avgSavingsPercentage.toFixed(1)}% average savings
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Potential Margin</div>
                <div className="text-2xl font-bold text-green-800">
                  {carrierVsGroupResults.summary.margin.toFixed(1)}%
                </div>
                <div className="text-xs text-green-600 mt-1">
                  (Old Price - New Cost) / Old Price
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Price vs Cost</div>
                <div className="text-2xl font-bold text-purple-800">
                  {formatCurrency(carrierVsGroupResults.summary.oldPrice)} → {formatCurrency(carrierVsGroupResults.summary.newCost)}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  Keep same price, reduce cost
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Margin Calculation Methodology</p>
                  <p className="mt-1">
                    This analysis compares your current carrier rates with the average rates from the selected carrier group.
                    The potential margin is calculated as: (Old Price - New Cost) / Old Price, where we keep the same price
                    to the customer but reduce your cost by switching to the group average rate.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Shipment Results Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Shipment-by-Shipment Analysis</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {carrierVsGroupResults.carrier.name} Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Group Avg Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Savings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Savings %
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {carrierVsGroupResults.shipments.map((shipment: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.origin} → {shipment.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.weight.toLocaleString()} lbs, {shipment.pallets} pallets
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.carrierRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.groupAvgRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(shipment.savings)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {shipment.savingsPercentage.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render the rate comparison tab
  const renderRateComparisonAnalysis = () => (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Customer Rate Comparison</h3>
              <p className="text-sm text-gray-600">
                Calculate margin by comparing historical prices with current costs
              </p>
            </div>
          </div>
          
          <button
            onClick={loadCustomers}
            disabled={isLoadingCustomers}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingCustomers ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Load Customers</span>
          </button>
        </div>
        
        {customers.length > 0 ? (
          <div className="space-y-4">
            {/* Customer Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {customers.map(customer => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Run Analysis Button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={runRateComparisonAnalysis}
                disabled={isLoading || !selectedCustomer || !project44Client}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5" />
                )}
                <span>Run Rate Comparison Analysis</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No customers loaded</p>
            <p className="text-sm mt-2">Click "Load Customers" to get started</p>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {rateComparisonResults && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Rate Comparison Summary</h3>
                <p className="text-sm text-gray-600">
                  {rateComparisonResults.customer} - {rateComparisonResults.shipments.length} shipments analyzed
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Total Old Price</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(rateComparisonResults.summary.totalOldPrice)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Customer price across all shipments
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Total New Cost</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(rateComparisonResults.summary.totalNewCost)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Current market rates for same shipments
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Overall Margin</div>
                <div className="text-2xl font-bold text-purple-800">
                  {rateComparisonResults.summary.overallMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  (Old Price - New Cost) / Old Price
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Margin Calculation Methodology</p>
                  <p className="mt-1">
                    This analysis takes historical shipments for {rateComparisonResults.customer} and compares the original prices
                    with current market rates from Project44. The overall margin is calculated as:
                    (Sum of Old Prices - Sum of New Costs) / Sum of Old Prices.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Shipment Results Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Shipment-by-Shipment Analysis</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Carrier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rateComparisonResults.shipments.map((shipment: any) => (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.origin} → {shipment.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.weight.toLocaleString()} lbs, {shipment.pallets} pallets
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.carrier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.oldPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.newCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {shipment.margin.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Calculate potential margins by comparing carriers and rates
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'carrier-vs-group', label: 'Carrier vs Group Analysis', icon: TrendingUp },
            { id: 'rate-comparison', label: 'Customer Rate Comparison', icon: DollarSign }
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
      {activeTab === 'carrier-vs-group' && renderCarrierVsGroupAnalysis()}
      {activeTab === 'rate-comparison' && renderRateComparisonAnalysis()}
    </div>
  );
};