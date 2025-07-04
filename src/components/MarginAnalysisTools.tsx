import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingDown, 
  TrendingUp, 
  Users, 
  Truck, 
  Calendar,
  DollarSign,
  BarChart3,
  RefreshCw,
  Play,
  Loader,
  AlertCircle,
  CheckCircle,
  Target,
  Package,
  MapPin,
  Clock,
  Download
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { RFQRow, QuoteWithPricing, PricingSettings } from '../types';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import * as XLSX from 'xlsx';

interface HistoricalShipment {
  "Invoice #": number;
  "Customer"?: string;
  "Scheduled Pickup Date"?: string;
  "Origin City"?: string;
  "State"?: string;
  "Zip"?: string;
  "Destination City"?: string;
  "State_1"?: string;
  "Zip_1"?: string;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Max Freight Class"?: string;
  "Accessorials"?: string;
  "Booked Carrier"?: string;
  "Revenue"?: string;
  "Carrier Expense"?: string;
  "Profit"?: string;
}

interface MarginAnalysisResult {
  customer: string;
  shipmentCount: number;
  totalHistoricalRevenue: number;
  totalHistoricalCost: number;
  totalNewCost: number;
  currentMargin: number;
  recommendedMargin: number;
  potentialSavings: number;
  avgShipmentValue: number;
  shipments: {
    historical: HistoricalShipment;
    newQuote?: QuoteWithPricing;
    savings?: number;
  }[];
}

interface CarrierOption {
  name: string;
  count: number;
}

export const MarginAnalysisTools: React.FC = () => {
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [availableCarriers, setAvailableCarriers] = useState<CarrierOption[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    end: new Date().toISOString().split('T')[0]
  });
  
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<MarginAnalysisResult[]>([]);
  const [error, setError] = useState<string>('');
  
  // Project44 client for re-quoting
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  
  // Pricing settings for margin calculations
  const [pricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: false
  });

  useEffect(() => {
    loadAvailableCarriers();
    initializeProject44Client();
  }, []);

  const initializeProject44Client = () => {
    // Try to load saved Project44 config
    const savedConfig = localStorage.getItem('project44_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        const client = new Project44APIClient(config);
        setProject44Client(client);
        console.log('✅ Project44 client initialized for margin analysis');
      } catch (error) {
        console.error('❌ Failed to initialize Project44 client:', error);
      }
    }
  };

  const loadAvailableCarriers = async () => {
    setIsLoadingCarriers(true);
    try {
      console.log('🚛 Loading available carriers from shipment history...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Booked Carrier"')
        .not('"Booked Carrier"', 'is', null)
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);
      
      if (error) {
        throw error;
      }
      
      // Count shipments per carrier
      const carrierCounts = (data || []).reduce((acc, shipment) => {
        const carrier = shipment["Booked Carrier"];
        if (carrier) {
          acc[carrier] = (acc[carrier] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      // Convert to sorted array
      const carriers = Object.entries(carrierCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      
      setAvailableCarriers(carriers);
      console.log(`✅ Loaded ${carriers.length} carriers with shipment history`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load carriers';
      setError(errorMsg);
      console.error('❌ Failed to load carriers:', err);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const runMarginAnalysis = async () => {
    if (!selectedCarrier) {
      setError('Please select a carrier to analyze');
      return;
    }
    
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setResults([]);
    setAnalysisProgress({ current: 0, total: 0 });

    try {
      console.log(`🔍 Starting margin analysis for carrier: ${selectedCarrier}`);
      
      // Step 1: Load historical shipments for the selected carrier
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .eq('"Booked Carrier"', selectedCarrier)
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .not('"Customer"', 'is', null)
        .not('"Zip"', 'is', null)
        .not('"Zip_1"', 'is', null);
      
      if (shipmentsError) {
        throw shipmentsError;
      }
      
      if (!shipments || shipments.length === 0) {
        setError(`No shipments found for carrier "${selectedCarrier}" in the selected date range`);
        return;
      }
      
      console.log(`📦 Found ${shipments.length} historical shipments for ${selectedCarrier}`);
      setAnalysisProgress({ current: 0, total: shipments.length });
      
      // Step 2: Group shipments by customer
      const customerGroups = shipments.reduce((groups, shipment) => {
        const customer = shipment["Customer"];
        if (!customer) return groups;
        
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(shipment);
        return groups;
      }, {} as Record<string, HistoricalShipment[]>);
      
      console.log(`👥 Analyzing ${Object.keys(customerGroups).length} customers`);
      
      // Step 3: Process each customer's shipments
      const customerResults: MarginAnalysisResult[] = [];
      
      for (const [customer, customerShipments] of Object.entries(customerGroups)) {
        console.log(`🔄 Processing ${customerShipments.length} shipments for customer: ${customer}`);
        
        const customerResult: MarginAnalysisResult = {
          customer,
          shipmentCount: customerShipments.length,
          totalHistoricalRevenue: 0,
          totalHistoricalCost: 0,
          totalNewCost: 0,
          currentMargin: 0,
          recommendedMargin: 0,
          potentialSavings: 0,
          avgShipmentValue: 0,
          shipments: []
        };
        
        // Process each shipment for this customer
        for (const shipment of customerShipments) {
          setAnalysisProgress(prev => ({ ...prev, current: prev.current + 1 }));
          
          try {
            // Parse historical data
            const historicalRevenue = parseFloat(shipment["Revenue"] || '0') || 0;
            const historicalCost = parseFloat(shipment["Carrier Expense"] || '0') || 0;
            
            customerResult.totalHistoricalRevenue += historicalRevenue;
            customerResult.totalHistoricalCost += historicalCost;
            
            // Convert shipment to RFQ format for re-quoting
            const rfq = convertShipmentToRFQ(shipment);
            
            if (rfq) {
              // Get new quote from Project44
              const newQuotes = await project44Client.getQuotes(rfq, [], false, false, false);
              
              if (newQuotes.length > 0) {
                // Use the best (cheapest) quote
                const bestQuote = newQuotes.reduce((best, current) => 
                  (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts) < 
                  (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts) ? current : best
                );
                
                // Apply pricing calculations
                const quoteWithPricing = await calculatePricingWithCustomerMargins(
                  bestQuote, 
                  pricingSettings, 
                  customer
                );
                
                const newCost = quoteWithPricing.carrierTotalRate;
                const savings = historicalCost - newCost;
                
                customerResult.totalNewCost += newCost;
                
                customerResult.shipments.push({
                  historical: shipment,
                  newQuote: quoteWithPricing,
                  savings
                });
                
                console.log(`💰 Shipment ${shipment["Invoice #"]}: Historical cost $${historicalCost} → New cost $${newCost} (${savings > 0 ? 'saves' : 'costs'} $${Math.abs(savings)})`);
              } else {
                // No new quote available
                customerResult.shipments.push({
                  historical: shipment
                });
                console.log(`⚠️ No new quote available for shipment ${shipment["Invoice #"]}`);
              }
            } else {
              // Invalid shipment data
              customerResult.shipments.push({
                historical: shipment
              });
              console.log(`⚠️ Invalid shipment data for ${shipment["Invoice #"]}`);
            }
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`❌ Error processing shipment ${shipment["Invoice #"]}:`, error);
            customerResult.shipments.push({
              historical: shipment
            });
          }
        }
        
        // Calculate margins and recommendations
        if (customerResult.totalHistoricalRevenue > 0) {
          customerResult.currentMargin = ((customerResult.totalHistoricalRevenue - customerResult.totalHistoricalCost) / customerResult.totalHistoricalRevenue) * 100;
          customerResult.avgShipmentValue = customerResult.totalHistoricalRevenue / customerResult.shipmentCount;
          
          if (customerResult.totalNewCost > 0) {
            // Calculate recommended margin to maintain same profit dollar amount
            const historicalProfit = customerResult.totalHistoricalRevenue - customerResult.totalHistoricalCost;
            const recommendedRevenue = customerResult.totalNewCost + historicalProfit;
            customerResult.recommendedMargin = ((recommendedRevenue - customerResult.totalNewCost) / recommendedRevenue) * 100;
            customerResult.potentialSavings = customerResult.totalHistoricalCost - customerResult.totalNewCost;
          }
        }
        
        customerResults.push(customerResult);
        console.log(`✅ Completed analysis for ${customer}: ${customerResult.currentMargin.toFixed(1)}% → ${customerResult.recommendedMargin.toFixed(1)}% margin`);
      }
      
      // Sort by potential savings (highest first)
      customerResults.sort((a, b) => b.potentialSavings - a.potentialSavings);
      setResults(customerResults);
      
      console.log(`🎯 Margin analysis completed for ${customerResults.length} customers`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to run margin analysis';
      setError(errorMsg);
      console.error('❌ Margin analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress({ current: 0, total: 0 });
    }
  };

  const convertShipmentToRFQ = (shipment: HistoricalShipment): RFQRow | null => {
    try {
      const fromZip = shipment["Zip"];
      const toZip = shipment["Zip_1"];
      const pickupDate = shipment["Scheduled Pickup Date"];
      const pallets = shipment["Tot Packages"] || 1;
      const weightStr = shipment["Tot Weight"] || '0';
      const grossWeight = parseInt(weightStr.replace(/[^\d]/g, '')) || 1000;
      const freightClass = shipment["Max Freight Class"] || '70';
      
      if (!fromZip || !toZip || !pickupDate) {
        return null;
      }
      
      // Parse accessorials
      const accessorialStr = shipment["Accessorials"] || '';
      const accessorial = accessorialStr ? accessorialStr.split(';').map(s => s.trim()).filter(Boolean) : [];
      
      const rfq: RFQRow = {
        fromDate: pickupDate,
        fromZip,
        toZip,
        pallets,
        grossWeight,
        isStackable: false,
        accessorial,
        freightClass,
        originCity: shipment["Origin City"],
        originState: shipment["State"],
        destinationCity: shipment["Destination City"],
        destinationState: shipment["State_1"],
        isReefer: false // Assume non-reefer for margin analysis
      };
      
      return rfq;
    } catch (error) {
      console.error('Error converting shipment to RFQ:', error);
      return null;
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    // Create summary sheet
    const summaryData = results.map(result => ({
      'Customer': result.customer,
      'Shipment Count': result.shipmentCount,
      'Historical Revenue': result.totalHistoricalRevenue,
      'Historical Cost': result.totalHistoricalCost,
      'New Cost': result.totalNewCost,
      'Current Margin %': result.currentMargin.toFixed(2),
      'Recommended Margin %': result.recommendedMargin.toFixed(2),
      'Potential Savings': result.potentialSavings,
      'Avg Shipment Value': result.avgShipmentValue
    }));
    
    // Create detailed sheet
    const detailedData = results.flatMap(result => 
      result.shipments.map(shipment => ({
        'Customer': result.customer,
        'Invoice #': shipment.historical["Invoice #"],
        'Date': shipment.historical["Scheduled Pickup Date"],
        'Route': `${shipment.historical["Zip"]} → ${shipment.historical["Zip_1"]}`,
        'Weight': shipment.historical["Tot Weight"],
        'Historical Revenue': parseFloat(shipment.historical["Revenue"] || '0'),
        'Historical Cost': parseFloat(shipment.historical["Carrier Expense"] || '0'),
        'New Cost': shipment.newQuote?.carrierTotalRate || 0,
        'Savings': shipment.savings || 0,
        'New Carrier': shipment.newQuote?.carrier.name || 'No Quote',
        'Service Level': shipment.newQuote?.serviceLevel?.description || ''
      }))
    );
    
    const workbook = XLSX.utils.book_new();
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    
    XLSX.utils.book_append_sheet(workbook, summaryWs, 'Customer Summary');
    XLSX.utils.book_append_sheet(workbook, detailedWs, 'Shipment Details');
    
    const fileName = `margin-analysis-${selectedCarrier.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
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
              Analyze historical shipments and determine optimal customer margins based on current market rates
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Truck className="inline h-4 w-4 mr-1" />
              Select Carrier
            </label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              disabled={isLoadingCarriers}
            >
              <option value="">Choose a carrier...</option>
              {availableCarriers.map(carrier => (
                <option key={carrier.name} value={carrier.name}>
                  {carrier.name} ({carrier.count} shipments)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4 mt-6">
          <button
            onClick={loadAvailableCarriers}
            disabled={isLoadingCarriers}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
          >
            {isLoadingCarriers ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Refresh Carriers</span>
          </button>
          
          <button
            onClick={runMarginAnalysis}
            disabled={!selectedCarrier || isAnalyzing || !project44Client}
            className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isAnalyzing ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>Run Analysis</span>
          </button>
          
          {results.length > 0 && (
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

      {/* Progress */}
      {isAnalyzing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="h-5 w-5 text-purple-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900">Analyzing Shipments</h3>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-purple-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${analysisProgress.total > 0 ? (analysisProgress.current / analysisProgress.total) * 100 : 0}%` }}
            />
          </div>
          
          <div className="text-sm text-gray-600">
            Processing shipment {analysisProgress.current} of {analysisProgress.total}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{results.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {results.reduce((sum, r) => sum + r.shipmentCount, 0)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Potential Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(results.reduce((sum, r) => sum + r.potentialSavings, 0))}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Current Margin</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(results.reduce((sum, r) => sum + r.currentMargin, 0) / results.length).toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Customer Results */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Customer Margin Analysis Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recommended margins maintain the same profit dollars with current market rates
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Historical Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential Savings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((result) => (
                    <tr key={result.customer} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {result.customer}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {result.shipmentCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(result.totalHistoricalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          result.currentMargin >= 20 ? 'bg-green-100 text-green-800' :
                          result.currentMargin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.currentMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          result.recommendedMargin >= 20 ? 'bg-green-100 text-green-800' :
                          result.recommendedMargin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.recommendedMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600">
                        {formatCurrency(result.potentialSavings)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          {result.potentialSavings > 0 ? (
                            <>
                              <TrendingDown className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 font-medium">
                                {((result.potentialSavings / result.totalHistoricalCost) * 100).toFixed(1)}% cost reduction
                              </span>
                            </>
                          ) : result.potentialSavings < 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-red-500" />
                              <span className="text-red-600 font-medium">
                                {((Math.abs(result.potentialSavings) / result.totalHistoricalCost) * 100).toFixed(1)}% cost increase
                              </span>
                            </>
                          ) : (
                            <>
                              <Target className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-600">No change</span>
                            </>
                          )}
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

      {/* Instructions */}
      {results.length === 0 && !isAnalyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">How Margin Analysis Works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select a carrier to analyze from your shipment history</li>
                <li>Choose a date range (default: last 12 months)</li>
                <li>System loads all historical shipments for that carrier</li>
                <li>Each shipment is re-quoted using current Project44 rates</li>
                <li>Compares old vs new costs to determine optimal customer margins</li>
                <li>Maintains same profit dollars while reflecting current market rates</li>
                <li>Export results to Excel for customer pricing updates</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};