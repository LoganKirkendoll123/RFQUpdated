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

interface MarginAnalysisToolsProps {}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = () => {
  const [activeTab, setActiveTab] = useState<'negotiated-rates' | 'historical-comparison'>('negotiated-rates');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Carrier data
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  // Analysis results
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  
  // Historical data
  const [historicalShipments, setHistoricalShipments] = useState<any[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carrier groups');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  // Handle carrier selection
  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  // Handle select all carriers in group
  const handleSelectAllInGroup = (selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === selectedGroup);
    if (!group) return;
    
    const newSelection = { ...selectedCarriers };
    group.carriers.forEach(carrier => {
      newSelection[carrier.id] = selected;
    });
    setSelectedCarriers(newSelection);
  };

  // Run negotiated rates analysis
  const runNegotiatedRatesAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier to analyze');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Simulate analysis results for now
      // In a real implementation, this would call the Project44 API to get rates
      // for the selected carriers and compare them
      
      // Get the selected group
      const group = carrierGroups.find(g => g.groupCode === selectedGroup);
      if (!group) {
        throw new Error('Selected carrier group not found');
      }
      
      // Get the selected carriers from the group
      const carriers = group.carriers.filter(c => selectedCarriers[c.id]);
      
      // Generate mock analysis results
      const mockResults = {
        groupName: group.groupName,
        carriers: carriers.map(carrier => ({
          id: carrier.id,
          name: carrier.name,
          scac: carrier.scac || 'N/A',
          currentRate: Math.random() * 1000 + 500,
          marketRate: Math.random() * 900 + 400,
          potentialSavings: Math.random() * 200 + 50,
          savingsPercentage: Math.random() * 15 + 5,
          recommendedAction: Math.random() > 0.5 ? 'RENEGOTIATE' : 'MAINTAIN'
        })),
        totalPotentialSavings: 0,
        averageSavingsPercentage: 0
      };
      
      // Calculate totals
      mockResults.totalPotentialSavings = mockResults.carriers.reduce(
        (sum, c) => sum + c.potentialSavings, 0
      );
      
      mockResults.averageSavingsPercentage = mockResults.carriers.reduce(
        (sum, c) => sum + c.savingsPercentage, 0
      ) / mockResults.carriers.length;
      
      // Set the results
      setAnalysisResults(mockResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Run historical comparison analysis
  const runHistoricalComparison = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    setIsLoadingHistorical(true);
    setError('');
    
    try {
      // In a real implementation, this would:
      // 1. Load historical shipments from the database
      // 2. Convert them to RFQ format
      // 3. Get current rates from Project44 API
      // 4. Compare historical rates to current rates
      
      // For now, just simulate loading historical shipments
      const mockHistoricalShipments = [
        {
          id: 1,
          date: '2023-05-15',
          origin: '60607',
          destination: '30033',
          weight: 2500,
          pallets: 3,
          carrier: 'Old Dominion',
          historicalRate: 850,
          currentRate: 795,
          savings: 55,
          savingsPercentage: 6.5
        },
        {
          id: 2,
          date: '2023-06-22',
          origin: '90210',
          destination: '10001',
          weight: 5000,
          pallets: 5,
          carrier: 'FedEx Freight',
          historicalRate: 1250,
          currentRate: 1350,
          savings: -100,
          savingsPercentage: -8.0
        },
        {
          id: 3,
          date: '2023-07-10',
          origin: '33101',
          destination: '75201',
          weight: 1800,
          pallets: 2,
          carrier: 'Saia',
          historicalRate: 720,
          currentRate: 680,
          savings: 40,
          savingsPercentage: 5.6
        }
      ];
      
      setHistoricalShipments(mockHistoricalShipments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run historical comparison');
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  // Render the negotiated rates analysis tab
  const renderNegotiatedRatesAnalysis = () => (
    <div className="space-y-6">
      {/* Carrier Group Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
              <p className="text-sm text-gray-600">
                Select carrier group and carriers to analyze for potential savings
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
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {carrierGroups.map(group => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Carrier Selection */}
            {selectedGroup && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Carriers to Analyze
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSelectAllInGroup(true)}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleSelectAllInGroup(false)}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {carrierGroups
                    .find(g => g.groupCode === selectedGroup)
                    ?.carriers.map(carrier => (
                      <div
                        key={carrier.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                          selectedCarriers[carrier.id]
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleCarrierToggle(carrier.id, !selectedCarriers[carrier.id])}
                      >
                        <div className="flex items-start space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedCarriers[carrier.id] || false}
                            onChange={(e) => handleCarrierToggle(carrier.id, e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <div className="font-medium text-gray-900">{carrier.name}</div>
                            <div className="text-xs text-gray-500">
                              {carrier.scac && <span className="mr-2">SCAC: {carrier.scac}</span>}
                              {carrier.mcNumber && <span>MC: {carrier.mcNumber}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {/* Run Analysis Button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={runNegotiatedRatesAnalysis}
                disabled={isLoading || Object.values(selectedCarriers).filter(Boolean).length === 0}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5" />
                )}
                <span>Run Negotiated Rates Analysis</span>
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
                <h3 className="text-lg font-semibold text-gray-900">Analysis Summary</h3>
                <p className="text-sm text-gray-600">
                  {analysisResults.groupName} - {analysisResults.carriers.length} carriers analyzed
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Total Potential Savings</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(analysisResults.totalPotentialSavings)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Across {analysisResults.carriers.length} carriers
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Average Savings</div>
                <div className="text-2xl font-bold text-blue-800">
                  {analysisResults.averageSavingsPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Average potential rate reduction
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Carriers to Renegotiate</div>
                <div className="text-2xl font-bold text-purple-800">
                  {analysisResults.carriers.filter(c => c.recommendedAction === 'RENEGOTIATE').length}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  Out of {analysisResults.carriers.length} analyzed
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Analysis Methodology</p>
                  <p className="mt-1">
                    This analysis compares your current negotiated rates with market benchmarks to identify potential savings opportunities. 
                    Carriers with rates significantly above market averages are flagged for renegotiation.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Carrier Results Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Carrier-by-Carrier Analysis</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Carrier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Market Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Potential Savings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Savings %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recommendation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysisResults.carriers.map((carrier) => (
                    <tr key={carrier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <Truck className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">{carrier.name}</div>
                            <div className="text-xs text-gray-500">SCAC: {carrier.scac}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(carrier.currentRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(carrier.marketRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(carrier.potentialSavings)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {carrier.savingsPercentage.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          carrier.recommendedAction === 'RENEGOTIATE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {carrier.recommendedAction === 'RENEGOTIATE' ? 'Renegotiate' : 'Maintain'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Action Plan */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-600 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Recommended Action Plan</h3>
                <p className="text-sm text-gray-600">
                  Next steps to capture identified savings opportunities
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-purple-100 text-purple-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Prioritize High-Impact Carriers</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Focus on the {analysisResults.carriers.filter(c => c.recommendedAction === 'RENEGOTIATE').length} carriers 
                    flagged for renegotiation, starting with those offering the highest potential savings.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="bg-purple-100 text-purple-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Prepare Negotiation Strategy</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Use the market rate benchmarks as leverage in your negotiations. 
                    Target an average reduction of {analysisResults.averageSavingsPercentage.toFixed(1)}% 
                    across all renegotiated carriers.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="bg-purple-100 text-purple-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Implement and Track</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    After negotiations, update your rates in the system and track actual savings 
                    against the projected {formatCurrency(analysisResults.totalPotentialSavings)} opportunity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render the historical comparison tab
  const renderHistoricalComparison = () => (
    <div className="space-y-6">
      {/* Historical Data Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Historical Shipment Analysis</h3>
              <p className="text-sm text-gray-600">
                Compare historical shipment rates with current market rates
              </p>
            </div>
          </div>
          
          <button
            onClick={runHistoricalComparison}
            disabled={isLoadingHistorical || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingHistorical ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Run Historical Comparison</span>
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
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">How Historical Comparison Works</p>
              <p className="mt-1">
                This tool takes your historical shipments from the database, converts them to RFQs, 
                and gets current rates from Project44. It then compares your historical rates with 
                current market rates to identify potential savings or cost increases.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Comparison Results */}
      {historicalShipments.length > 0 && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Historical Comparison Summary</h3>
                <p className="text-sm text-gray-600">
                  {historicalShipments.length} historical shipments analyzed
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Total Potential Savings</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(
                    historicalShipments
                      .filter(s => s.savings > 0)
                      .reduce((sum, s) => sum + s.savings, 0)
                  )}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  From {historicalShipments.filter(s => s.savings > 0).length} shipments with savings
                </div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="text-sm text-red-700 mb-1">Total Cost Increases</div>
                <div className="text-2xl font-bold text-red-800">
                  {formatCurrency(
                    Math.abs(
                      historicalShipments
                        .filter(s => s.savings < 0)
                        .reduce((sum, s) => sum + s.savings, 0)
                    )
                  )}
                </div>
                <div className="text-xs text-red-600 mt-1">
                  From {historicalShipments.filter(s => s.savings < 0).length} shipments with increases
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Net Impact</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(
                    historicalShipments.reduce((sum, s) => sum + s.savings, 0)
                  )}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Overall financial impact
                </div>
              </div>
            </div>
          </div>
          
          {/* Shipments Table */}
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
                      Historical Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historicalShipments.map((shipment) => (
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
                        {formatCurrency(shipment.historicalRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.currentRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center space-x-1 text-sm font-medium ${
                          shipment.savings > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {shipment.savings > 0 ? (
                            <>
                              <ArrowRight className="h-4 w-4" />
                              <span>Save {formatCurrency(shipment.savings)}</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-4 w-4" />
                              <span>Add {formatCurrency(Math.abs(shipment.savings))}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.abs(shipment.savingsPercentage).toFixed(1)}% {shipment.savings > 0 ? 'savings' : 'increase'}
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
              Analyze carrier rates and identify savings opportunities
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'negotiated-rates', label: 'Negotiated Rates Analysis', icon: TrendingUp },
            { id: 'historical-comparison', label: 'Historical Comparison', icon: BarChart3 }
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
      {activeTab === 'negotiated-rates' && renderNegotiatedRatesAnalysis()}
      {activeTab === 'historical-comparison' && renderHistoricalComparison()}
    </div>
  );
};