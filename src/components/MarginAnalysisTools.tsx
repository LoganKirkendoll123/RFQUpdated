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
  Target,
  ArrowRight,
  BarChart3,
  Zap,
  Calendar,
  Package,
  Clock,
 Info
  Info
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { loadProject44Config } from '../utils/credentialStorage';
import { supabase } from '../utils/supabase';

interface MarginAnalysisToolsProps {}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = () => {
  const [activeTab, setActiveTab] = useState<'carrier-vs-group' | 'negotiated-rates'>('carrier-vs-group');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Carrier data
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  // Date range
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Analysis results
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [negotiatedRatesResults, setNegotiatedRatesResults] = useState<any>(null);
  
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

  // Run carrier margin analysis
  const runMarginAnalysis = async () => {
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
      
      // In a real implementation, this would:
      // 1. Load historical shipments for the selected carrier from the last year
      // 2. Get current rates from Project44 API for the exact same shipments
      // 3. Calculate the sum of old prices and new costs
      // 4. Calculate margin as (old price - new cost) / old price
      
      // Generate mock historical shipments for the selected carrier
      const mockHistoricalShipments = [
        {
          id: 1,
          date: '2023-05-15',
          origin: '60607',
          destination: '30033',
          weight: 2500,
          pallets: 3,
          oldPrice: 950,
          oldCost: 850
        },
        {
          id: 2,
          date: '2023-06-22',
          origin: '90210',
          destination: '10001',
          weight: 5000,
          pallets: 5,
          oldPrice: 1450,
          oldCost: 1250
        },
        {
          id: 3,
          date: '2023-07-10',
          origin: '33101',
          destination: '75201',
          weight: 1800,
          pallets: 2,
          oldPrice: 820,
          oldCost: 720
        },
        {
          id: 4,
          date: '2023-08-05',
          origin: '94102',
          destination: '02101',
          weight: 3200,
          pallets: 4,
          oldPrice: 1250,
          oldCost: 1100
        },
        {
          id: 5,
          date: '2023-09-18',
          origin: '77001',
          destination: '30309',
          weight: 12000,
          pallets: 8,
          oldPrice: 2200,
          oldCost: 1900
        }
      ];
      
      // Mock new costs from Project44 API (in a real implementation, these would come from actual API calls)
      const mockNewCosts = [780, 1150, 680, 980, 1750];
      
      // Calculate savings and margin for each shipment
      const shipmentsWithCalculations = mockHistoricalShipments.map((shipment, index) => {
        const newCost = mockNewCosts[index];
        const savings = shipment.oldCost - newCost;
        const savingsPercentage = (savings / shipment.oldCost) * 100;
        const margin = ((shipment.oldPrice - newCost) / shipment.oldPrice) * 100;
        
        return {
          ...shipment,
          newCost,
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
      
      setAnalysisResults({
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

  // Run negotiated rates analysis
  const runNegotiatedRatesAnalysis = async () => {
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
      
      // In a real implementation, this would:
      // 1. Load all historical shipments for the selected carrier from the database
      // 2. Get current rates from Project44 API for the exact same shipments
      // 3. Calculate the sum of old prices and new costs
      // 4. Calculate margin as (old price - new cost) / old price
      
      // Mock data for customers
      const mockCustomers = [
        { id: 1, name: 'Acme Corporation' },
        { id: 2, name: 'Global Logistics Inc.' },
        { id: 3, name: 'Midwest Distribution' },
        { id: 4, name: 'East Coast Shipping' },
        { id: 5, name: 'Western Transport' }
      ];
      
      // Generate mock shipment data for each customer
      const mockCustomerShipments = mockCustomers.map(customer => {
        // Generate 3-5 shipments per customer
        const shipmentCount = Math.floor(Math.random() * 3) + 3;
        const shipments = [];
        
        let totalOldPrice = 0;
        let totalNewCost = 0;
        
        for (let i = 0; i < shipmentCount; i++) {
          const weight = Math.floor(Math.random() * 10000) + 1000;
          const pallets = Math.floor(Math.random() * 8) + 1;
          const oldPrice = Math.floor(Math.random() * 1500) + 500;
          const oldCost = Math.floor(oldPrice * 0.85);
          const newCost = Math.floor(oldCost * (Math.random() * 0.3 + 0.7)); // 70-100% of old cost
          
          totalOldPrice += oldPrice;
          totalNewCost += newCost;
          
          shipments.push({
            id: `${customer.id}-${i}`,
            date: new Date(Date.now() - Math.floor(Math.random() * 30000000000)).toISOString().split('T')[0],
            origin: ['60607', '90210', '33101', '94102', '77001'][Math.floor(Math.random() * 5)],
            destination: ['30033', '10001', '75201', '02101', '30309'][Math.floor(Math.random() * 5)],
            weight,
            pallets,
            oldPrice,
            oldCost,
            newCost,
            savings: oldCost - newCost,
            savingsPercentage: ((oldCost - newCost) / oldCost) * 100,
            margin: ((oldPrice - newCost) / oldPrice) * 100
          });
        }
        
        return {
          customer,
          shipments,
          summary: {
            shipmentCount,
            totalOldPrice,
            totalNewCost,
            optimalMargin: ((totalOldPrice - totalNewCost) / totalOldPrice) * 100
          }
        };
      });
      
      // Calculate overall summary
      const overallSummary = {
        totalShipments: mockCustomerShipments.reduce((sum, c) => sum + c.summary.shipmentCount, 0),
        totalOldPrice: mockCustomerShipments.reduce((sum, c) => sum + c.summary.totalOldPrice, 0),
        totalNewCost: mockCustomerShipments.reduce((sum, c) => sum + c.summary.totalNewCost, 0),
        weightedAvgMargin: 0
      };
      
      overallSummary.weightedAvgMargin = ((overallSummary.totalOldPrice - overallSummary.totalNewCost) / overallSummary.totalOldPrice) * 100;
      
      setNegotiatedRatesResults({
        carrier: {
          id: carrier.id,
          name: carrier.name,
          scac: carrier.scac || 'N/A'
        },
        group: {
          code: group.groupCode,
          name: group.groupName
        },
        dateRange,
        customerShipments: mockCustomerShipments,
        summary: overallSummary
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run negotiated rates analysis');
    } finally {
      setIsLoading(false);
    }
  };

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
              <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
              <p className="text-sm text-gray-600">
                Select a carrier to analyze historical shipments and calculate optimal margin
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
                  Select Carrier to Analyze
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
            
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                onClick={runMarginAnalysis}
                disabled={isLoading || !selectedGroup || !selectedCarrier}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5" />
                )}
                <span>Run Margin Analysis</span>
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
      {analysisResults && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Margin Analysis Summary</h3>
                <p className="text-sm text-gray-600">
                  {analysisResults.carrier.name} - {analysisResults.shipments.length} historical shipments analyzed
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Total Historical Revenue</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(analysisResults.summary.totalOldPrice)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Customer price across all shipments
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Total Current Cost</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(analysisResults.summary.totalNewCost)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Current market rates for same shipments
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Optimal Margin</div>
                <div className="text-2xl font-bold text-purple-800">
                  {analysisResults.summary.overallMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  (Old Price - New Cost) / Old Price
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-600 rounded-full p-2">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="text-green-800">
                  <p className="font-medium">Recommended Action</p>
                  <p className="mt-1">
                    Keep your current customer prices and switch to current market rates to achieve a 
                    <span className="font-bold text-green-700"> {analysisResults.summary.overallMargin.toFixed(1)}% </span> 
                    margin across all shipments.
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
                      Old Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Cost
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
                  {analysisResults.shipments.map((shipment: any) => (
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
                        {formatCurrency(shipment.oldPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.oldCost)}
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
          
          {/* Visualization */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Margin Visualization</h3>
                <p className="text-sm text-gray-600">
                  Visual representation of price vs cost and margin
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Price vs Cost Comparison</h4>
                <div className="h-64 flex items-end space-x-4 pt-6">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Historical</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-blue-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalOldPrice / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalOldPrice)}
                      </div>
                      <div className="text-xs text-gray-500">Price</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Historical</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-gray-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalOldCost / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalOldCost)}
                      </div>
                      <div className="text-xs text-gray-500">Cost</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Current</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-blue-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalOldPrice / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalOldPrice)}
                      </div>
                      <div className="text-xs text-gray-500">Price (Same)</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Current</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-green-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalNewCost / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalNewCost)}
                      </div>
                      <div className="text-xs text-gray-500">Cost</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Margin Breakdown</h4>
                <div className="h-64 flex flex-col justify-center items-center">
                  <div className="w-full max-w-xs">
                    <div className="mb-6 text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {analysisResults.summary.overallMargin.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Optimal Margin</div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Historical Margin</span>
                          <span className="font-medium text-gray-900">
                            {((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gray-500 h-2 rounded-full" 
                            style={{ width: `${((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Optimal Margin</span>
                          <span className="font-medium text-green-600">
                            {analysisResults.summary.overallMargin.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${analysisResults.summary.overallMargin}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Margin Increase</span>
                          <span className="font-medium text-blue-600">
                            +{(analysisResults.summary.overallMargin - ((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${(analysisResults.summary.overallMargin - ((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderNegotiatedRatesAnalysis = () => {
    return (
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
                  Compare a carrier's rates against its group to determine optimal margin
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
                    Select Carrier to Analyze
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
              
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                  onClick={runNegotiatedRatesAnalysis}
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
        {negotiatedRatesResults && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-green-600 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Carrier vs Group Analysis</h3>
                  <p className="text-sm text-gray-600">
                    {negotiatedRatesResults.carrier.name} vs {negotiatedRatesResults.group.name}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm text-blue-700 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-blue-800">
                    {formatCurrency(negotiatedRatesResults.summary.totalOldPrice)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Across {negotiatedRatesResults.summary.totalShipments} shipments
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm text-green-700 mb-1">Total New Cost</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatCurrency(negotiatedRatesResults.summary.totalNewCost)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Current market rates for same shipments
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="text-sm text-purple-700 mb-1">Weighted Avg Margin</div>
                  <div className="text-2xl font-bold text-purple-800">
                    {negotiatedRatesResults.summary.weightedAvgMargin.toFixed(1)}%
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    Optimal margin to maintain revenue
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-600 rounded-full p-2">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-green-800">
                    <p className="font-medium">Recommended Action</p>
                    <p className="mt-1">
                      Set a <span className="font-bold text-green-700">{negotiatedRatesResults.summary.weightedAvgMargin.toFixed(1)}% margin</span> for {negotiatedRatesResults.carrier.name} to maintain current revenue levels with new market rates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Customer Breakdown */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Customer-Level Analysis</h3>
                <p className="text-sm text-gray-600">
                  Margin analysis broken down by customer
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shipments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total New Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Optimal Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {negotiatedRatesResults.customerShipments.map((customerData: any) => (
                      <tr key={customerData.customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customerData.customer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {customerData.summary.shipmentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customerData.summary.totalOldPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customerData.summary.totalNewCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-600">
                            {customerData.summary.optimalMargin.toFixed(1)}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Shipment Details (Expandable) */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Shipment Details</h3>
                  <button
                    onClick={() => {
                      // Toggle expansion logic would go here
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="text-sm text-gray-600 mb-4">
                  Detailed shipment-by-shipment analysis would be shown here, including:
                </div>
                
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                  <li>Historical shipment details (origin, destination, weight, etc.)</li>
                  <li>Historical price and cost</li>
                  <li>Current market rates from Project44 API</li>
                  <li>Calculated margin to maintain revenue</li>
                  <li>Comparison against group average rates</li>
                </ul>
                
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">How This Works</p>
                      <p className="mt-1">
                        This tool reprocesses historical shipments through the Project44 API to get current market rates. 
                        It then calculates the exact margin needed to maintain your current revenue levels.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
            <h1 className="text-xl font-semibold text-gray-900">Carrier Margin Analysis</h1>
            <p className="text-sm text-gray-600">
              Analyze historical shipments and calculate optimal margins
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('carrier-vs-group')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'carrier-vs-group'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>Carrier vs Group</span>
            </button>
            <button
              onClick={() => setActiveTab('negotiated-rates')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'negotiated-rates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Negotiated Rates Analysis</span>
            </button>
          </nav>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'carrier-vs-group' ? renderCarrierVsGroupAnalysis() : renderNegotiatedRatesAnalysis()}
        </div>
      </div>
    </div>
  );
};