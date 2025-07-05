import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Truck, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Loader, 
  AlertCircle,
  Download,
  CheckCircle,
  Users,
  Building2,
  Clock,
  Package,
  Search
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'carrier-vs-group' | 'margin-simulator'>('carrier-vs-group');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Carrier vs Group Analysis state
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [carrierList, setCarrierList] = useState<{name: string, scac: string}[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Project44 client for real-time rate lookups
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  
  useEffect(() => {
    loadCarrierList();
    initializeProject44Client();
  }, []);
  
  const initializeProject44Client = () => {
    const savedConfig = loadProject44Config();
    if (savedConfig) {
      const client = new Project44APIClient(savedConfig);
      setProject44Client(client);
    }
  };
  
  const loadCarrierList = async () => {
    try {
      setLoading(true);
      
      // Get unique carriers with SCAC codes from Shipments table
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Booked Carrier", "SCAC"')
        .not('SCAC', 'is', null)
        .order('Booked Carrier');
      
      if (error) throw error;
      
      // Create a unique list of carriers with their SCAC codes
      const uniqueCarriers = new Map<string, string>();
      
      data?.forEach(row => {
        if (row["Booked Carrier"] && row["SCAC"]) {
          uniqueCarriers.set(row["SCAC"], row["Booked Carrier"]);
        }
      });
      
      const carriers = Array.from(uniqueCarriers.entries()).map(([scac, name]) => ({
        name,
        scac
      }));
      
      setCarrierList(carriers);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carrier list');
      setLoading(false);
    }
  };
  
  const runCarrierVsGroupAnalysis = async () => {
    if (!selectedCarrier || !project44Client) {
      setError('Please select a carrier and ensure Project44 is configured');
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setError('');
      setSuccess('');
      
      // Find the selected carrier's SCAC
      const carrier = carrierList.find(c => c.scac === selectedCarrier);
      if (!carrier) {
        throw new Error('Selected carrier not found');
      }
      
      // Step 1: Get historical shipments for this carrier by SCAC
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .eq('SCAC', selectedCarrier)
        .order('"Scheduled Pickup Date"', { ascending: false })
        .limit(100);
      
      if (shipmentsError) throw shipmentsError;
      
      if (!shipments || shipments.length === 0) {
        setError(`No historical shipments found for carrier ${carrier.name} (${selectedCarrier})`);
        setIsAnalyzing(false);
        return;
      }
      
      // Step 2: Group shipments by customer
      const customerShipments = shipments.reduce((acc, shipment) => {
        const customer = shipment["Customer"] || 'Unknown';
        if (!acc[customer]) {
          acc[customer] = [];
        }
        acc[customer].push(shipment);
        return acc;
      }, {} as Record<string, any[]>);
      
      // Step 3: For each shipment, get current rates from Project44
      const customerResults: Record<string, any> = {};
      let totalHistoricalRevenue = 0;
      let totalCurrentRevenue = 0;
      let totalShipments = 0;
      
      for (const [customer, customerShipmentList] of Object.entries(customerShipments)) {
        const customerResult = {
          shipments: customerShipmentList.length,
          historicalRevenue: 0,
          currentRevenue: 0,
          difference: 0,
          percentChange: 0,
          details: [] as any[]
        };
        
        for (const shipment of customerShipmentList) {
          // Parse historical revenue
          const historicalRevenue = parseFloat(shipment["Revenue"]?.replace(/[^0-9.-]+/g, '') || '0');
          
          // Create RFQ from historical shipment
          const rfq = {
            fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
            fromZip: shipment["Zip"] || '',
            toZip: shipment["Zip_1"] || '',
            pallets: shipment["Tot Packages"] || 1,
            grossWeight: parseInt(shipment["Tot Weight"]?.replace(/[^0-9.-]+/g, '') || '1000'),
            isStackable: false,
            isReefer: shipment["Is VLTL"] === 'TRUE',
            accessorial: []
          };
          
          // Skip invalid shipments
          if (!rfq.fromZip || !rfq.toZip) {
            continue;
          }
          
          try {
            // Get current rates from Project44 for this exact shipment
            const quotes = await project44Client.getQuotes(
              rfq, 
              [selectedCarrier], // Only get quotes from this specific carrier
              shipment["Is VLTL"] === 'TRUE', // Use VLTL if the original shipment was VLTL
              false,
              false
            );
            
            // Find the best quote
            let bestQuote = null;
            if (quotes.length > 0) {
              bestQuote = quotes.reduce((best, current) => {
                const bestTotal = best.rateQuoteDetail?.total || 
                                 (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
                const currentTotal = current.rateQuoteDetail?.total || 
                                    (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
                return currentTotal < bestTotal ? current : best;
              });
            }
            
            const currentRate = bestQuote ? 
              (bestQuote.rateQuoteDetail?.total || 
               (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts)) : 0;
            
            // Add to customer totals
            customerResult.historicalRevenue += historicalRevenue;
            customerResult.currentRevenue += currentRate;
            
            // Add shipment detail
            customerResult.details.push({
              invoiceNumber: shipment["Invoice #"],
              date: shipment["Scheduled Pickup Date"],
              route: `${shipment["Zip"]} → ${shipment["Zip_1"]}`,
              weight: shipment["Tot Weight"],
              pallets: shipment["Tot Packages"],
              historicalRevenue,
              currentRate,
              difference: currentRate - historicalRevenue,
              percentChange: historicalRevenue > 0 ? 
                ((currentRate - historicalRevenue) / historicalRevenue) * 100 : 0
            });
          } catch (err) {
            console.error(`Error getting rates for shipment ${shipment["Invoice #"]}:`, err);
            // Continue with next shipment
          }
        }
        
        // Calculate customer totals
        customerResult.difference = customerResult.currentRevenue - customerResult.historicalRevenue;
        customerResult.percentChange = customerResult.historicalRevenue > 0 ? 
          (customerResult.difference / customerResult.historicalRevenue) * 100 : 0;
        
        // Add to overall totals
        totalHistoricalRevenue += customerResult.historicalRevenue;
        totalCurrentRevenue += customerResult.currentRevenue;
        totalShipments += customerResult.shipments;
        
        // Add to results
        customerResults[customer] = customerResult;
      }
      
      // Calculate overall results
      const overallDifference = totalCurrentRevenue - totalHistoricalRevenue;
      const overallPercentChange = totalHistoricalRevenue > 0 ? 
        (overallDifference / totalHistoricalRevenue) * 100 : 0;
      
      setAnalysisResults({
        carrier: carrier.name,
        scac: selectedCarrier,
        totalShipments,
        totalHistoricalRevenue,
        totalCurrentRevenue,
        overallDifference,
        overallPercentChange,
        customerResults
      });
      
      setSuccess(`Analysis completed for ${carrier.name} (${selectedCarrier}). Compared ${totalShipments} historical shipments with current rates.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const renderCarrierVsGroupTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Carrier vs Group Analysis</h2>
          <p className="text-sm text-gray-600">
            Compare historical shipment rates with current Project44 rates for a specific carrier
          </p>
        </div>
      </div>
      
      {/* Carrier Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Carrier to Analyze</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Carrier (with SCAC)
            </label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a carrier --</option>
              {carrierList.map((carrier) => (
                <option key={carrier.scac} value={carrier.scac}>
                  {carrier.name} ({carrier.scac})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={runCarrierVsGroupAnalysis}
              disabled={isAnalyzing || !selectedCarrier || !project44Client}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  <span>Run Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {!project44Client && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Project44 API client not configured. Please set up your Project44 credentials in the API Setup tab.
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Analysis Results */}
      {analysisResults && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Analysis Summary</h3>
                <p className="text-sm text-gray-600">
                  {analysisResults.carrier} ({analysisResults.scac}) - {analysisResults.totalShipments} shipments analyzed
                </p>
              </div>
              <button
                onClick={() => {
                  // Export functionality would go here
                }}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Historical Revenue</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(analysisResults.totalHistoricalRevenue)}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Current Revenue</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(analysisResults.totalCurrentRevenue)}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Difference</div>
                <div className={`text-xl font-bold ${
                  analysisResults.overallDifference > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analysisResults.overallDifference > 0 ? '+' : ''}
                  {formatCurrency(analysisResults.overallDifference)}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Percent Change</div>
                <div className={`text-xl font-bold ${
                  analysisResults.overallPercentChange > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analysisResults.overallPercentChange > 0 ? '+' : ''}
                  {analysisResults.overallPercentChange.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
          
          {/* Customer Breakdown */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Customer Breakdown</h3>
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
                      Historical Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Difference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % Change
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(analysisResults.customerResults).map(([customer, result]: [string, any]) => (
                    <tr key={customer} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.shipments}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(result.historicalRevenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(result.currentRevenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`${
                          result.difference > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.difference > 0 ? '+' : ''}
                          {formatCurrency(result.difference)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`${
                          result.percentChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.percentChange > 0 ? '+' : ''}
                          {result.percentChange.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Shipment Details */}
          {Object.entries(analysisResults.customerResults).map(([customer, result]: [string, any]) => (
            <div key={`details-${customer}`} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {customer} - Shipment Details
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Historical Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Difference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.details.map((detail: any) => (
                      <tr key={detail.invoiceNumber} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {detail.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {detail.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {detail.route}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {detail.weight}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(detail.historicalRevenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(detail.currentRate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`${
                            detail.difference > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {detail.difference > 0 ? '+' : ''}
                            {formatCurrency(detail.difference)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  const renderMarginSimulatorTab = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Margin Simulator</h3>
      <p className="text-gray-600">
        This feature will be available in a future update.
      </p>
    </div>
  );
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Analyze carrier performance and optimize pricing strategies
            </p>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'carrier-vs-group', label: 'Carrier vs Group Analysis', icon: Truck },
            { id: 'margin-simulator', label: 'Margin Simulator', icon: DollarSign }
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
      
      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{success}</span>
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
          {activeTab === 'carrier-vs-group' && renderCarrierVsGroupTab()}
          {activeTab === 'margin-simulator' && renderMarginSimulatorTab()}
        </>
      )}
    </div>
  );
};