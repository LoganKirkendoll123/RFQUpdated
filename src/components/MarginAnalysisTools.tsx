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
  ArrowRight,
  Loader
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { RFQRow } from '../types';

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new-carrier' | 'negotiated'>('new-carrier');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  
  // New carrier analysis state
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierScac, setNewCarrierScac] = useState('');
  const [selectedCarrierGroup, setSelectedCarrierGroup] = useState('');
  const [carrierGroups, setCarrierGroups] = useState<string[]>([]);
  const [p44Client, setP44Client] = useState<Project44APIClient | null>(null);
  const [p44Loading, setP44Loading] = useState(false);
  const [newCarrierResults, setNewCarrierResults] = useState<any | null>(null);
  const [shipmentSamples, setShipmentSamples] = useState<RFQRow[]>([]);
  
  // Negotiated rates state
  const [negotiatedCarrier, setNegotiatedCarrier] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(5);
  const [negotiatedResults, setNegotiatedResults] = useState<any | null>(null);
  const [loadingNegotiated, setLoadingNegotiated] = useState(false);
  const [carriers, setCarriers] = useState<string[]>([]);

  useEffect(() => {
    loadCarriers();
    
    // Initialize Project44 client
    const config = loadProject44Config();
    if (config) {
      setP44Client(new Project44APIClient(config));
    }
    
    // Load sample shipments for testing
    loadSampleShipments();
  }, []);

  const loadCarriers = async () => {
    try {
      // Load unique carriers from shipment history
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
      
      // Set some sample carrier groups
      setCarrierGroups([
        'National LTL Carriers',
        'Regional LTL Carriers',
        'Volume LTL Specialists',
        'Premium Service Carriers',
        'Economy Carriers'
      ]);
    } catch (error) {
      console.error('Failed to load carriers:', error);
    }
  };

  const loadSampleShipments = async () => {
    try {
      // Get real shipment data from database to use as samples
      const { data } = await supabase
        .from('Shipments')
        .select('*')
        .limit(10);
      
      if (data && data.length > 0) {
        // Convert shipment data to RFQRow format
        const samples: RFQRow[] = data.map(shipment => ({
          fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
          fromZip: shipment["Zip"] || '60607',
          toZip: shipment["Zip_1"] || '30033',
          pallets: shipment["Tot Packages"] || 3,
          grossWeight: parseInt(shipment["Tot Weight"]?.toString() || '2000'),
          isStackable: false,
          accessorial: [],
          isReefer: shipment["Is VLTL"] === 'TRUE' ? false : true
        }));
        
        setShipmentSamples(samples);
      } else {
        // Fallback to default samples if no data
        setShipmentSamples([
          {
            fromDate: new Date().toISOString().split('T')[0],
            fromZip: '60607',
            toZip: '30033',
            pallets: 3,
            grossWeight: 2500,
            isStackable: false,
            accessorial: []
          },
          {
            fromDate: new Date().toISOString().split('T')[0],
            fromZip: '90210',
            toZip: '10001',
            pallets: 5,
            grossWeight: 4000,
            isStackable: true,
            accessorial: []
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load sample shipments:', error);
    }
  };

  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const analyzeNewCarrier = async () => {
    if (!p44Client) {
      alert('Project44 client not available. Please check your API configuration.');
      return;
    }
    
    if (!newCarrierName || !selectedCarrierGroup) {
      alert('Please enter carrier name and select a comparison group');
      return;
    }
    
    setP44Loading(true);
    try {
      // 1. Get quotes from the new carrier for sample shipments
      const newCarrierQuotes = [];
      
      for (const sample of shipmentSamples) {
        try {
          // This would be a real API call in production
          // For demo, we'll simulate the response
          const simulatedQuote = {
            carrierName: newCarrierName,
            carrierScac: newCarrierScac,
            baseRate: Math.random() * 500 + 500,
            fuelSurcharge: Math.random() * 100 + 50,
            accessorials: Math.random() * 50,
            totalRate: 0,
            transitDays: Math.floor(Math.random() * 4) + 2
          };
          
          simulatedQuote.totalRate = simulatedQuote.baseRate + simulatedQuote.fuelSurcharge + simulatedQuote.accessorials;
          
          newCarrierQuotes.push({
            shipment: sample,
            quote: simulatedQuote
          });
        } catch (error) {
          console.error('Error getting quote for sample shipment:', error);
        }
      }
      
      // 2. Get quotes from comparison group carriers for the same shipments
      const comparisonQuotes = [];
      
      for (const sample of shipmentSamples) {
        // In production, this would call the actual API
        // For demo, we'll simulate responses from multiple carriers
        const groupCarriers = ['Carrier A', 'Carrier B', 'Carrier C', 'Carrier D'];
        
        for (const carrier of groupCarriers) {
          const simulatedQuote = {
            carrierName: carrier,
            carrierScac: carrier.substring(0, 4).toUpperCase(),
            baseRate: Math.random() * 500 + 500,
            fuelSurcharge: Math.random() * 100 + 50,
            accessorials: Math.random() * 50,
            totalRate: 0,
            transitDays: Math.floor(Math.random() * 4) + 2
          };
          
          simulatedQuote.totalRate = simulatedQuote.baseRate + simulatedQuote.fuelSurcharge + simulatedQuote.accessorials;
          
          comparisonQuotes.push({
            shipment: sample,
            quote: simulatedQuote
          });
        }
      }
      
      // 3. Calculate comparative metrics
      const shipmentComparisons = [];
      
      for (const sample of shipmentSamples) {
        const newCarrierQuote = newCarrierQuotes.find(q => 
          q.shipment.fromZip === sample.fromZip && 
          q.shipment.toZip === sample.toZip
        );
        
        const comparisonGroupQuotes = comparisonQuotes.filter(q => 
          q.shipment.fromZip === sample.fromZip && 
          q.shipment.toZip === sample.toZip
        );
        
        if (newCarrierQuote && comparisonGroupQuotes.length > 0) {
          // Calculate average and best rates from comparison group
          const comparisonRates = comparisonGroupQuotes.map(q => q.quote.totalRate);
          const avgComparisonRate = comparisonRates.reduce((sum, rate) => sum + rate, 0) / comparisonRates.length;
          const bestComparisonRate = Math.min(...comparisonRates);
          const bestComparisonCarrier = comparisonGroupQuotes.find(q => q.quote.totalRate === bestComparisonRate)?.quote.carrierName;
          
          // Calculate savings vs average and best
          const savingsVsAvg = avgComparisonRate - newCarrierQuote.quote.totalRate;
          const savingsVsBest = bestComparisonRate - newCarrierQuote.quote.totalRate;
          const savingsPercentVsAvg = (savingsVsAvg / avgComparisonRate) * 100;
          const savingsPercentVsBest = (savingsVsBest / bestComparisonRate) * 100;
          
          shipmentComparisons.push({
            route: `${sample.fromZip} → ${sample.toZip}`,
            pallets: sample.pallets,
            weight: sample.grossWeight,
            newCarrierRate: newCarrierQuote.quote.totalRate,
            avgComparisonRate,
            bestComparisonRate,
            bestComparisonCarrier,
            savingsVsAvg,
            savingsVsBest,
            savingsPercentVsAvg,
            savingsPercentVsBest,
            transitDays: newCarrierQuote.quote.transitDays
          });
        }
      }
      
      // 4. Calculate overall metrics
      const totalNewCarrierRate = shipmentComparisons.reduce((sum, comp) => sum + comp.newCarrierRate, 0);
      const totalAvgComparisonRate = shipmentComparisons.reduce((sum, comp) => sum + comp.avgComparisonRate, 0);
      const totalBestComparisonRate = shipmentComparisons.reduce((sum, comp) => sum + comp.bestComparisonRate, 0);
      
      const overallSavingsVsAvg = totalAvgComparisonRate - totalNewCarrierRate;
      const overallSavingsVsBest = totalBestComparisonRate - totalNewCarrierRate;
      const overallSavingsPercentVsAvg = (overallSavingsVsAvg / totalAvgComparisonRate) * 100;
      const overallSavingsPercentVsBest = (overallSavingsVsBest / totalBestComparisonRate) * 100;
      
      // 5. Calculate recommended margins
      const recommendedMargins = {
        standard: 15, // Default margin
        aggressive: 20, // Higher margin if significantly better than competition
        conservative: 12 // Lower margin if not competitive
      };
      
      if (overallSavingsPercentVsAvg > 10) {
        recommendedMargins.standard = 18;
        recommendedMargins.aggressive = 23;
        recommendedMargins.conservative = 15;
      } else if (overallSavingsPercentVsAvg < 0) {
        recommendedMargins.standard = 12;
        recommendedMargins.aggressive = 15;
        recommendedMargins.conservative = 10;
      }
      
      // 6. Set results
      setNewCarrierResults({
        carrier: newCarrierName,
        scac: newCarrierScac,
        comparisonGroup: selectedCarrierGroup,
        shipmentComparisons,
        overallMetrics: {
          totalNewCarrierRate,
          totalAvgComparisonRate,
          totalBestComparisonRate,
          overallSavingsVsAvg,
          overallSavingsVsBest,
          overallSavingsPercentVsAvg,
          overallSavingsPercentVsBest
        },
        recommendedMargins
      });
      
    } catch (error) {
      console.error('Failed to analyze new carrier:', error);
      alert('Error analyzing new carrier');
    } finally {
      setP44Loading(false);
    }
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

      // 2. Convert historical shipments to RFQs for P44 API
      const historicalRFQs: RFQRow[] = shipments.map(shipment => ({
        fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
        fromZip: shipment["Zip"] || '',
        toZip: shipment["Zip_1"] || '',
        pallets: shipment["Tot Packages"] || 1,
        grossWeight: parseNumeric(shipment["Tot Weight"]) || 1000,
        isStackable: false,
        accessorial: [],
        isReefer: shipment["Is VLTL"] === 'TRUE'
      }));

      // 3. Get current rates from P44 API (simulated for demo)
      const currentRates: {[key: string]: number} = {};
      
      for (let i = 0; i < historicalRFQs.length; i++) {
        const rfq = historicalRFQs[i];
        const shipment = shipments[i];
        
        // In production, this would call the actual P44 API
        // For demo, we'll simulate a rate that's close to the historical rate
        const historicalRate = parseNumeric(shipment["Carrier Expense"]);
        const simulatedCurrentRate = historicalRate * (1 + (Math.random() * 0.1 - 0.05)); // +/- 5% from historical
        
        currentRates[`${rfq.fromZip}-${rfq.toZip}-${rfq.pallets}-${rfq.grossWeight}`] = simulatedCurrentRate;
      }

      // 4. Calculate current and new rates
      const customerResults = new Map();
      let totalOldCost = 0;
      let totalNewCost = 0;
      let totalRevenue = 0;
      let totalCurrentCost = 0;

      shipments.forEach((shipment, index) => {
        const customer = shipment["Customer"] || 'Unknown';
        const revenue = parseNumeric(shipment["Revenue"]);
        const oldCost = parseNumeric(shipment["Carrier Expense"]);
        
        // Get current rate from P44 API results (or simulated)
        const rfq = historicalRFQs[index];
        const currentCost = currentRates[`${rfq.fromZip}-${rfq.toZip}-${rfq.pallets}-${rfq.grossWeight}`] || oldCost;
        
        // Apply negotiated discount to current rate
        const newCost = currentCost * (1 - (discountPercentage / 100));
        
        totalOldCost += oldCost;
        totalCurrentCost += currentCost;
        totalNewCost += newCost;
        totalRevenue += revenue;

        if (!customerResults.has(customer)) {
          customerResults.set(customer, {
            shipments: 0,
            oldCost: 0,
            currentCost: 0,
            newCost: 0,
            revenue: 0
          });
        }

        const customerData = customerResults.get(customer);
        customerData.shipments += 1;
        customerData.oldCost += oldCost;
        customerData.currentCost += currentCost;
        customerData.newCost += newCost;
        customerData.revenue += revenue;
      });

      // 5. Calculate recommended margins
      const results = {
        carrier: negotiatedCarrier,
        discountPercentage,
        totalShipments: shipments.length,
        totalOldCost,
        totalCurrentCost,
        totalNewCost,
        totalSavingsVsOld: totalOldCost - totalNewCost,
        totalSavingsVsCurrent: totalCurrentCost - totalNewCost,
        totalRevenue,
        oldMargin: totalRevenue > 0 ? ((totalRevenue - totalOldCost) / totalRevenue) * 100 : 0,
        currentMargin: totalRevenue > 0 ? ((totalRevenue - totalCurrentCost) / totalRevenue) * 100 : 0,
        newMargin: totalRevenue > 0 ? ((totalRevenue - totalNewCost) / totalRevenue) * 100 : 0,
        customers: Array.from(customerResults.entries()).map(([customer, data]) => {
          const oldProfit = data.revenue - data.oldCost;
          const currentProfit = data.revenue - data.currentCost;
          const newProfit = data.revenue - data.newCost;
          
          const oldMargin = data.revenue > 0 ? (oldProfit / data.revenue) * 100 : 0;
          const currentMargin = data.revenue > 0 ? (currentProfit / data.revenue) * 100 : 0;
          const newMargin = data.revenue > 0 ? (newProfit / data.revenue) * 100 : 0;
          
          return {
            customer,
            shipments: data.shipments,
            oldCost: data.oldCost,
            currentCost: data.currentCost,
            newCost: data.newCost,
            savingsVsOld: data.oldCost - data.newCost,
            savingsVsCurrent: data.currentCost - data.newCost,
            revenue: data.revenue,
            oldProfit,
            currentProfit,
            newProfit,
            oldMargin,
            currentMargin,
            newMargin,
            marginImprovementVsOld: newMargin - oldMargin,
            marginImprovementVsCurrent: newMargin - currentMargin
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

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('new-carrier')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'new-carrier'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>New Carrier Analysis</span>
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

      {activeTab === 'new-carrier' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">New Carrier Analysis</h2>
              <p className="text-sm text-gray-600">Compare a new carrier's rates against existing carrier groups</p>
            </div>
          </div>

          {/* New Carrier Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Carrier Name</label>
                <input
                  type="text"
                  value={newCarrierName}
                  onChange={(e) => setNewCarrierName(e.target.value)}
                  placeholder="Enter carrier name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SCAC Code (Optional)</label>
                <input
                  type="text"
                  value={newCarrierScac}
                  onChange={(e) => setNewCarrierScac(e.target.value)}
                  placeholder="Enter SCAC code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compare Against</label>
                <select
                  value={selectedCarrierGroup}
                  onChange={(e) => setSelectedCarrierGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select carrier group</option>
                  {carrierGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={analyzeNewCarrier}
                disabled={p44Loading || !newCarrierName || !selectedCarrierGroup}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {p44Loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                <span>Analyze Carrier Rates</span>
              </button>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How this works:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Enter the new carrier's name and SCAC code (if available)</li>
                    <li>Select a carrier group to compare against</li>
                    <li>We'll use Project44 API to get quotes from the new carrier</li>
                    <li>Compare rates against the selected carrier group</li>
                    <li>Calculate recommended margins based on competitive position</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* New Carrier Results */}
          {newCarrierResults && (
            <>
              {/* Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Competitive Analysis: {newCarrierResults.carrier} vs. {newCarrierResults.comparisonGroup}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Sample Shipments</p>
                    <p className="text-xl font-bold text-gray-900">{newCarrierResults.shipmentComparisons.length}</p>
                  </div>
                  
                  <div className={`rounded-lg p-4 ${
                    newCarrierResults.overallMetrics.overallSavingsVsAvg > 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <p className="text-sm text-gray-600">vs. Average Rates</p>
                    <p className={`text-xl font-bold ${
                      newCarrierResults.overallMetrics.overallSavingsVsAvg > 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {newCarrierResults.overallMetrics.overallSavingsVsAvg > 0 ? 'Saves ' : 'Costs '}
                      {formatCurrency(Math.abs(newCarrierResults.overallMetrics.overallSavingsVsAvg))}
                    </p>
                    <p className="text-xs text-gray-600">
                      {Math.abs(newCarrierResults.overallMetrics.overallSavingsPercentVsAvg).toFixed(1)}% 
                      {newCarrierResults.overallMetrics.overallSavingsVsAvg > 0 ? ' cheaper' : ' more expensive'}
                    </p>
                  </div>
                  
                  <div className={`rounded-lg p-4 ${
                    newCarrierResults.overallMetrics.overallSavingsVsBest > 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <p className="text-sm text-gray-600">vs. Best Rates</p>
                    <p className={`text-xl font-bold ${
                      newCarrierResults.overallMetrics.overallSavingsVsBest > 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {newCarrierResults.overallMetrics.overallSavingsVsBest > 0 ? 'Saves ' : 'Costs '}
                      {formatCurrency(Math.abs(newCarrierResults.overallMetrics.overallSavingsVsBest))}
                    </p>
                    <p className="text-xs text-gray-600">
                      {Math.abs(newCarrierResults.overallMetrics.overallSavingsPercentVsBest).toFixed(1)}% 
                      {newCarrierResults.overallMetrics.overallSavingsVsBest > 0 ? ' cheaper' : ' more expensive'}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Recommended Margin</p>
                    <p className="text-xl font-bold text-blue-700">
                      {newCarrierResults.recommendedMargins.standard}%
                    </p>
                    <p className="text-xs text-blue-600">
                      Range: {newCarrierResults.recommendedMargins.conservative}% - {newCarrierResults.recommendedMargins.aggressive}%
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Margin Recommendation Factors:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Standard ({newCarrierResults.recommendedMargins.standard}%):</strong> Balanced margin based on competitive position</li>
                        <li><strong>Aggressive ({newCarrierResults.recommendedMargins.aggressive}%):</strong> Higher margin for maximum profit</li>
                        <li><strong>Conservative ({newCarrierResults.recommendedMargins.conservative}%):</strong> Lower margin to ensure competitiveness</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Shipment Comparisons */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Lane-by-Lane Comparison
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-sm font-medium text-gray-600">Route</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Details</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">{newCarrierResults.carrier} Rate</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Avg Group Rate</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Best Group Rate</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">vs. Average</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">vs. Best</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Transit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newCarrierResults.shipmentComparisons.map((comparison, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3 text-sm font-medium text-gray-900">
                            {comparison.route}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {comparison.pallets} plts, {comparison.weight.toLocaleString()} lbs
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(comparison.newCarrierRate)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(comparison.avgComparisonRate)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            <div>
                              {formatCurrency(comparison.bestComparisonRate)}
                              <div className="text-xs text-gray-500">{comparison.bestComparisonCarrier}</div>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              comparison.savingsVsAvg > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {comparison.savingsVsAvg > 0 ? '+' : ''}
                              {formatCurrency(comparison.savingsVsAvg)}
                              <span className="ml-1">
                                ({comparison.savingsPercentVsAvg > 0 ? '+' : ''}
                                {comparison.savingsPercentVsAvg.toFixed(1)}%)
                              </span>
                            </span>
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              comparison.savingsVsBest > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {comparison.savingsVsBest > 0 ? '+' : ''}
                              {formatCurrency(comparison.savingsVsBest)}
                              <span className="ml-1">
                                ({comparison.savingsPercentVsBest > 0 ? '+' : ''}
                                {comparison.savingsPercentVsBest.toFixed(1)}%)
                              </span>
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {comparison.transitDays} days
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
                  Margin Recommendations
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-md font-medium text-blue-800">Standard Margin: {newCarrierResults.recommendedMargins.standard}%</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          This balanced margin is recommended for most customers. It provides good profitability
                          while maintaining competitive rates based on the carrier's position in the market.
                        </p>
                        <div className="mt-2 text-sm">
                          <strong>Example:</strong> On a $1,000 shipment, your cost would be ${formatCurrency(1000)} and 
                          customer price would be ${formatCurrency(1000 / (1 - newCarrierResults.recommendedMargins.standard/100))},
                          generating ${formatCurrency((1000 / (1 - newCarrierResults.recommendedMargins.standard/100)) - 1000)} profit.
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-md font-medium text-green-800">Aggressive Margin: {newCarrierResults.recommendedMargins.aggressive}%</h4>
                        <p className="text-sm text-green-700 mt-1">
                          This higher margin is recommended for customers with less price sensitivity or for lanes where
                          this carrier has a significant advantage over competitors.
                        </p>
                        <div className="mt-2 text-sm">
                          <strong>Example:</strong> On a $1,000 shipment, your cost would be ${formatCurrency(1000)} and 
                          customer price would be ${formatCurrency(1000 / (1 - newCarrierResults.recommendedMargins.aggressive/100))},
                          generating ${formatCurrency((1000 / (1 - newCarrierResults.recommendedMargins.aggressive/100)) - 1000)} profit.
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <TrendingDown className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-md font-medium text-yellow-800">Conservative Margin: {newCarrierResults.recommendedMargins.conservative}%</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          This lower margin is recommended for highly competitive lanes or price-sensitive customers
                          where maintaining volume is more important than maximizing per-shipment profit.
                        </p>
                        <div className="mt-2 text-sm">
                          <strong>Example:</strong> On a $1,000 shipment, your cost would be ${formatCurrency(1000)} and 
                          customer price would be ${formatCurrency(1000 / (1 - newCarrierResults.recommendedMargins.conservative/100))},
                          generating ${formatCurrency((1000 / (1 - newCarrierResults.recommendedMargins.conservative/100)) - 1000)} profit.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {!newCarrierResults && !p44Loading && (
            <div className="text-center py-8 text-gray-500">
              <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Enter carrier details and select a comparison group to analyze</p>
            </div>
          )}

          {p44Loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
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
                    <Loader className="h-4 w-4 animate-spin" />
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
                    <li>Convert historical shipments to RFQs and get current rates via Project44 API</li>
                    <li>Apply your negotiated discount to the current rates</li>
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
                      {formatCurrency(negotiatedResults.totalSavingsVsCurrent)}
                    </p>
                    <p className="text-xs text-green-600">
                      {discountPercentage}% discount from current rates
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Current Margin</p>
                    <p className="text-xl font-bold text-blue-700">
                      {negotiatedResults.currentMargin.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">New Margin</p>
                    <p className="text-xl font-bold text-indigo-700">
                      {negotiatedResults.newMargin.toFixed(1)}%
                    </p>
                    <p className="text-xs text-indigo-600">
                      +{(negotiatedResults.newMargin - negotiatedResults.currentMargin).toFixed(1)}%
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
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Current Cost</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">New Cost</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Savings</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Revenue</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-600">Current Margin</th>
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
                            {formatCurrency(customer.currentCost)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.newCost)}
                          </td>
                          <td className="py-3 text-sm text-green-600 text-right font-medium">
                            {formatCurrency(customer.savingsVsCurrent)}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(customer.revenue)}
                          </td>
                          <td className="py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              customer.currentMargin >= 15 ? 'bg-green-100 text-green-800' :
                              customer.currentMargin >= 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {customer.currentMargin.toFixed(1)}%
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
                              +{customer.marginImprovementVsCurrent.toFixed(1)}%
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
                          Maintain current customer pricing and increase your margin by {(negotiatedResults.newMargin - negotiatedResults.currentMargin).toFixed(1)}%.
                          This would increase your profit by {formatCurrency(negotiatedResults.totalSavingsVsCurrent)} across {negotiatedResults.totalShipments} shipments.
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
                          You'll still increase your margin by {((negotiatedResults.newMargin - negotiatedResults.currentMargin) / 2).toFixed(1)}%
                          and profit by {formatCurrency(negotiatedResults.totalSavingsVsCurrent / 2)}.
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
                          <li>For customers with <10% margin: Keep full savings</li>
                          <li>For customers with 10-15% margin: Share 50% of savings</li>
                          <li>For customers with >15% margin: Pass through most savings to maintain competitiveness</li>
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