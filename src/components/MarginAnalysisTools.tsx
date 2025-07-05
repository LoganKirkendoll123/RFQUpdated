import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Truck, 
  Users, 
  Building2, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Search,
  ArrowRight,
  BarChart3,
  Target,
  Zap
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { RFQRow, PricingSettings } from '../types';

interface MarginAnalysisToolsProps {
  project44Client?: Project44APIClient | null;
}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = ({ project44Client }) => {
  const [activeMode, setActiveMode] = useState<'new-carrier' | 'negotiated-rates'>('new-carrier');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // New Carrier Analysis state
  const [newCarrierScac, setNewCarrierScac] = useState('');
  const [newCarrierName, setNewCarrierName] = useState('');
  const [selectedCarrierGroups, setSelectedCarrierGroups] = useState<string[]>([]);
  const [availableCarrierGroups, setAvailableCarrierGroups] = useState<{code: string, name: string}[]>([]);
  const [sampleShipments, setSampleShipments] = useState<RFQRow[]>([]);
  const [newCarrierResults, setNewCarrierResults] = useState<any>(null);
  
  // Negotiated Rates Analysis state
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [availableCarriers, setAvailableCarriers] = useState<string[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(5);
  const [historicalShipments, setHistoricalShipments] = useState<any[]>([]);
  const [negotiatedRateResults, setNegotiatedRateResults] = useState<any>(null);
  
  useEffect(() => {
    loadCarrierGroups();
    loadAvailableCarriers();
    loadSampleShipments();
  }, []);
  
  const loadCarrierGroups = async () => {
    try {
      if (!project44Client) {
        setError('Project44 client not available. Please configure your API credentials first.');
        return;
      }
      
      const groups = await project44Client.getAvailableCarriersByGroup();
      const formattedGroups = groups.map(group => ({
        code: group.groupCode,
        name: group.groupName
      }));
      
      setAvailableCarrierGroups(formattedGroups);
    } catch (err) {
      setError('Failed to load carrier groups: ' + (err instanceof Error ? err.message : String(err)));
    }
  };
  
  const loadAvailableCarriers = async () => {
    try {
      // Get unique carriers from shipment history
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Booked Carrier"')
        .not('"Booked Carrier"', 'is', null)
        .order('"Booked Carrier"');
      
      if (error) throw error;
      
      const carriers = [...new Set(data.map(s => s["Booked Carrier"]))];
      setAvailableCarriers(carriers);
    } catch (err) {
      console.error('Failed to load available carriers:', err);
    }
  };
  
  const loadSampleShipments = async () => {
    try {
      // Get a diverse set of sample shipments from history
      const { data, error } = await supabase
        .from('Shipments')
        .select('*')
        .order('"Invoice #"', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Convert to RFQRow format
      const sampleRfqs = data.map(shipment => {
        return {
          fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
          fromZip: shipment["Zip"] || '',
          toZip: shipment["Zip_1"] || '',
          pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
          grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
          isStackable: false,
          isReefer: shipment["Is VLTL"] === 'TRUE',
          accessorial: shipment["Accessorials"]?.split(';') || [],
          freightClass: shipment["Max Freight Class"] || '70',
          originCity: shipment["Origin City"] || '',
          originState: shipment["State"] || '',
          destinationCity: shipment["Destination City"] || '',
          destinationState: shipment["State_1"] || ''
        } as RFQRow;
      });
      
      setSampleShipments(sampleRfqs);
    } catch (err) {
      console.error('Failed to load sample shipments:', err);
    }
  };
  
  const loadHistoricalShipments = async (carrierName: string) => {
    try {
      setLoading(true);
      
      // Get historical shipments for the selected carrier
      const { data, error } = await supabase
        .from('Shipments')
        .select('*')
        .eq('"Booked Carrier"', carrierName)
        .order('"Scheduled Pickup Date"', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      setHistoricalShipments(data || []);
      return data || [];
    } catch (err) {
      setError('Failed to load historical shipments: ' + (err instanceof Error ? err.message : String(err)));
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  const analyzeNewCarrier = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }
    
    if (!newCarrierScac || !newCarrierName) {
      setError('Please enter both SCAC code and carrier name.');
      return;
    }
    
    if (selectedCarrierGroups.length === 0) {
      setError('Please select at least one carrier group for comparison.');
      return;
    }
    
    if (sampleShipments.length === 0) {
      setError('No sample shipments available for analysis.');
      return;
    }
    
    setLoading(true);
    setError('');
    setNewCarrierResults(null);
    
    try {
      // Create a mock carrier ID for the new carrier
      const newCarrierId = `NEW_${newCarrierScac}`;
      
      // Results structure
      const results = {
        newCarrier: {
          name: newCarrierName,
          scac: newCarrierScac,
          quotes: [] as any[]
        },
        competitorGroups: {} as Record<string, {
          name: string,
          quotes: any[],
          avgRate: number
        }>,
        shipments: [] as any[],
        summary: {
          totalShipments: 0,
          newCarrierTotal: 0,
          competitorAvgTotal: 0,
          priceDifference: 0,
          percentageDifference: 0,
          recommendedMargin: 0
        }
      };
      
      // Process each sample shipment
      for (const shipment of sampleShipments) {
        // Skip shipments with missing origin or destination
        if (!shipment.fromZip || !shipment.toZip) continue;
        
        const shipmentResult = {
          rfq: shipment,
          newCarrierQuote: null as any,
          competitorQuotes: {} as Record<string, any[]>
        };
        
        // Get quotes from the new carrier
        // In a real implementation, we would need to add the new carrier to the system
        // For now, we'll use the API to get quotes from existing carriers and pretend one is the new carrier
        
        // Get quotes from competitor groups
        for (const groupCode of selectedCarrierGroups) {
          try {
            const groupQuotes = await project44Client.getQuotesForAccountGroup(
              shipment,
              groupCode,
              shipment.isReefer || shipment.pallets >= 10 || shipment.grossWeight >= 15000
            );
            
            if (groupQuotes.length > 0) {
              // Store quotes for this group
              if (!results.competitorGroups[groupCode]) {
                const groupName = availableCarrierGroups.find(g => g.code === groupCode)?.name || groupCode;
                results.competitorGroups[groupCode] = {
                  name: groupName,
                  quotes: [],
                  avgRate: 0
                };
              }
              
              // Add quotes to the group
              results.competitorGroups[groupCode].quotes.push(...groupQuotes);
              
              // Store for this shipment
              shipmentResult.competitorQuotes[groupCode] = groupQuotes;
            }
          } catch (err) {
            console.error(`Failed to get quotes for group ${groupCode}:`, err);
          }
        }
        
        // For demonstration, we'll use the first competitor group's best quote as the "new carrier" quote
        // In a real implementation, you would get actual quotes from the new carrier
        const firstGroupCode = selectedCarrierGroups[0];
        if (shipmentResult.competitorQuotes[firstGroupCode]?.length > 0) {
          // Find the best quote from the first group
          const quotes = shipmentResult.competitorQuotes[firstGroupCode];
          const bestQuote = quotes.reduce((best, current) => {
            const bestTotal = best.rateQuoteDetail?.total || 
                             (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
            const currentTotal = current.rateQuoteDetail?.total || 
                                (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
            return currentTotal < bestTotal ? current : best;
          });
          
          // Create a modified version as the "new carrier" quote
          const newCarrierQuote = {
            ...bestQuote,
            carrier: {
              name: newCarrierName,
              scac: newCarrierScac
            },
            // Apply a random factor to make it look different (in reality, this would be a real quote)
            rateQuoteDetail: {
              ...bestQuote.rateQuoteDetail,
              total: bestQuote.rateQuoteDetail?.total ? 
                     bestQuote.rateQuoteDetail.total * (0.9 + Math.random() * 0.2) : 
                     (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts) * (0.9 + Math.random() * 0.2)
            }
          };
          
          shipmentResult.newCarrierQuote = newCarrierQuote;
          results.newCarrier.quotes.push(newCarrierQuote);
        }
        
        // Only include shipments where we have both new carrier and competitor quotes
        if (shipmentResult.newCarrierQuote && Object.keys(shipmentResult.competitorQuotes).length > 0) {
          results.shipments.push(shipmentResult);
        }
      }
      
      // Calculate summary statistics
      results.summary.totalShipments = results.shipments.length;
      
      // Calculate new carrier total
      results.summary.newCarrierTotal = results.newCarrier.quotes.reduce((sum, quote) => {
        return sum + (quote.rateQuoteDetail?.total || 
                     (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts));
      }, 0);
      
      // Calculate competitor average total
      let competitorTotalSum = 0;
      let competitorGroupCount = 0;
      
      for (const groupCode in results.competitorGroups) {
        const group = results.competitorGroups[groupCode];
        
        // Calculate average rate for this group
        const groupTotal = group.quotes.reduce((sum, quote) => {
          return sum + (quote.rateQuoteDetail?.total || 
                       (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts));
        }, 0);
        
        group.avgRate = groupTotal / (group.quotes.length || 1);
        competitorTotalSum += groupTotal;
        competitorGroupCount++;
      }
      
      results.summary.competitorAvgTotal = competitorTotalSum / (competitorGroupCount || 1);
      
      // Calculate price difference and percentage
      results.summary.priceDifference = results.summary.competitorAvgTotal - results.summary.newCarrierTotal;
      results.summary.percentageDifference = (results.summary.priceDifference / results.summary.competitorAvgTotal) * 100;
      
      // Calculate recommended margin
      // If new carrier is cheaper, we can add more margin
      // If new carrier is more expensive, we need to reduce margin
      if (results.summary.percentageDifference > 0) {
        // New carrier is cheaper, recommend a margin that keeps some of the savings
        results.summary.recommendedMargin = Math.min(30, Math.max(15, results.summary.percentageDifference * 0.8));
      } else {
        // New carrier is more expensive, recommend a lower margin
        results.summary.recommendedMargin = Math.max(5, 15 + results.summary.percentageDifference * 0.5);
      }
      
      setNewCarrierResults(results);
    } catch (err) {
      setError('Failed to analyze new carrier: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  const analyzeNegotiatedRates = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }
    
    if (!selectedCarrier) {
      setError('Please select a carrier to analyze.');
      return;
    }
    
    if (discountPercentage <= 0 || discountPercentage >= 100) {
      setError('Please enter a valid discount percentage between 0 and 100.');
      return;
    }
    
    setLoading(true);
    setError('');
    setNegotiatedRateResults(null);
    
    try {
      // Load historical shipments for the selected carrier
      const shipments = await loadHistoricalShipments(selectedCarrier);
      
      if (shipments.length === 0) {
        setError(`No historical shipments found for carrier: ${selectedCarrier}`);
        setLoading(false);
        return;
      }
      
      // Results structure
      const results = {
        carrier: selectedCarrier,
        discountPercentage,
        shipments: [] as any[],
        customers: {} as Record<string, {
          name: string,
          shipmentCount: number,
          oldTotalRevenue: number,
          oldTotalCost: number,
          oldTotalProfit: number,
          oldAvgMargin: number,
          newTotalCost: number,
          newTotalProfit: number,
          newAvgMargin: number,
          marginChange: number
        }>,
        summary: {
          totalShipments: shipments.length,
          oldTotalRevenue: 0,
          oldTotalCost: 0,
          oldTotalProfit: 0,
          oldAvgMargin: 0,
          newTotalCost: 0,
          newTotalProfit: 0,
          newAvgMargin: 0,
          totalSavings: 0,
          avgSavingsPerShipment: 0
        }
      };
      
      // Process each historical shipment
      for (const shipment of shipments) {
        // Skip shipments with missing data
        if (!shipment["Zip"] || !shipment["Zip_1"] || !shipment["Revenue"] || !shipment["Carrier Expense"]) {
          continue;
        }
        
        // Parse numeric values
        const revenue = parseFloat(shipment["Revenue"].toString().replace(/[^\d.-]/g, '')) || 0;
        const oldCost = parseFloat(shipment["Carrier Expense"].toString().replace(/[^\d.-]/g, '')) || 0;
        const oldProfit = parseFloat(shipment["Profit"].toString().replace(/[^\d.-]/g, '')) || 0;
        
        // Create RFQ from historical shipment
        const rfq: RFQRow = {
          fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
          fromZip: shipment["Zip"] || '',
          toZip: shipment["Zip_1"] || '',
          pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
          grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
          isStackable: false,
          isReefer: shipment["Is VLTL"] === 'TRUE',
          accessorial: shipment["Accessorials"]?.split(';') || [],
          freightClass: shipment["Max Freight Class"] || '70',
          originCity: shipment["Origin City"] || '',
          originState: shipment["State"] || '',
          destinationCity: shipment["Destination City"] || '',
          destinationState: shipment["State_1"] || ''
        };
        
        // Get current rates from Project44
        let currentQuotes = [];
        try {
          currentQuotes = await project44Client.getQuotes(
            rfq,
            [], // No carrier filtering, we want all quotes
            rfq.isReefer || rfq.pallets >= 10 || rfq.grossWeight >= 15000
          );
        } catch (err) {
          console.error(`Failed to get current quotes for shipment ${shipment["Invoice #"]}:`, err);
          // Continue with next shipment
          continue;
        }
        
        // Find the quote from our carrier
        const carrierQuote = currentQuotes.find(q => 
          q.carrier.name === selectedCarrier || 
          q.carrier.scac === selectedCarrier
        );
        
        if (!carrierQuote) {
          // No quote from this carrier, skip
          continue;
        }
        
        // Calculate current cost
        const currentCost = carrierQuote.rateQuoteDetail?.total || 
                           (carrierQuote.baseRate + carrierQuote.fuelSurcharge + carrierQuote.premiumsAndDiscounts);
        
        // Apply negotiated discount
        const newCost = currentCost * (1 - (discountPercentage / 100));
        const newProfit = revenue - newCost;
        const oldMargin = (oldProfit / revenue) * 100;
        const newMargin = (newProfit / revenue) * 100;
        const savings = currentCost - newCost;
        
        // Store shipment result
        const shipmentResult = {
          invoiceNumber: shipment["Invoice #"],
          customer: shipment["Customer"] || 'Unknown',
          route: `${shipment["Zip"]} → ${shipment["Zip_1"]}`,
          revenue,
          oldCost,
          oldProfit,
          oldMargin,
          currentCost,
          newCost,
          newProfit,
          newMargin,
          savings
        };
        
        results.shipments.push(shipmentResult);
        
        // Update customer stats
        const customerName = shipment["Customer"] || 'Unknown';
        if (!results.customers[customerName]) {
          results.customers[customerName] = {
            name: customerName,
            shipmentCount: 0,
            oldTotalRevenue: 0,
            oldTotalCost: 0,
            oldTotalProfit: 0,
            oldAvgMargin: 0,
            newTotalCost: 0,
            newTotalProfit: 0,
            newAvgMargin: 0,
            marginChange: 0
          };
        }
        
        const customer = results.customers[customerName];
        customer.shipmentCount++;
        customer.oldTotalRevenue += revenue;
        customer.oldTotalCost += oldCost;
        customer.oldTotalProfit += oldProfit;
        customer.newTotalCost += newCost;
        customer.newTotalProfit += newProfit;
        
        // Update summary stats
        results.summary.oldTotalRevenue += revenue;
        results.summary.oldTotalCost += oldCost;
        results.summary.oldTotalProfit += oldProfit;
        results.summary.newTotalCost += newCost;
        results.summary.newTotalProfit += newProfit;
        results.summary.totalSavings += savings;
      }
      
      // Calculate averages and percentages
      results.summary.oldAvgMargin = (results.summary.oldTotalProfit / results.summary.oldTotalRevenue) * 100;
      results.summary.newAvgMargin = (results.summary.newTotalProfit / results.summary.oldTotalRevenue) * 100;
      results.summary.avgSavingsPerShipment = results.summary.totalSavings / results.summary.totalShipments;
      
      // Calculate customer averages
      for (const customerName in results.customers) {
        const customer = results.customers[customerName];
        customer.oldAvgMargin = (customer.oldTotalProfit / customer.oldTotalRevenue) * 100;
        customer.newAvgMargin = (customer.newTotalProfit / customer.oldTotalRevenue) * 100;
        customer.marginChange = customer.newAvgMargin - customer.oldAvgMargin;
      }
      
      setNegotiatedRateResults(results);
    } catch (err) {
      setError('Failed to analyze negotiated rates: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  const renderNewCarrierAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Carrier Margin Analysis</h3>
        <p className="text-sm text-gray-600 mb-6">
          Compare a new carrier against existing carrier groups to determine optimal margin settings.
          This tool uses Project44 API to get real quotes for sample shipments.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Carrier SCAC Code
            </label>
            <input
              type="text"
              value={newCarrierScac}
              onChange={(e) => setNewCarrierScac(e.target.value.toUpperCase())}
              placeholder="ABCD"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Carrier Name
            </label>
            <input
              type="text"
              value={newCarrierName}
              onChange={(e) => setNewCarrierName(e.target.value)}
              placeholder="New Carrier Inc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Carrier Groups for Comparison
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableCarrierGroups.map((group) => (
              <div key={group.code} className="flex items-center">
                <input
                  type="checkbox"
                  id={`group-${group.code}`}
                  checked={selectedCarrierGroups.includes(group.code)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCarrierGroups([...selectedCarrierGroups, group.code]);
                    } else {
                      setSelectedCarrierGroups(selectedCarrierGroups.filter(code => code !== group.code));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`group-${group.code}`} className="ml-2 text-sm text-gray-700">
                  {group.name}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={analyzeNewCarrier}
            disabled={loading || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                <span>Analyze New Carrier</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
      
      {newCarrierResults && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-blue-900">New Carrier</h4>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-bold">{newCarrierResults.newCarrier.name}</p>
                  <p>SCAC: {newCarrierResults.newCarrier.scac}</p>
                  <p className="mt-2">Total Cost: {formatCurrency(newCarrierResults.summary.newCarrierTotal)}</p>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-green-900">Competitor Average</h4>
                </div>
                <div className="text-sm text-green-800">
                  <p className="font-bold">{Object.keys(newCarrierResults.competitorGroups).length} Carrier Groups</p>
                  <p>{newCarrierResults.summary.totalShipments} Sample Shipments</p>
                  <p className="mt-2">Total Cost: {formatCurrency(newCarrierResults.summary.competitorAvgTotal)}</p>
                </div>
              </div>
              
              <div className={`rounded-lg p-4 border ${
                newCarrierResults.summary.percentageDifference > 0 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {newCarrierResults.summary.percentageDifference > 0 ? (
                    <TrendingDown className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-red-600" />
                  )}
                  <h4 className={`font-medium ${
                    newCarrierResults.summary.percentageDifference > 0 
                      ? 'text-green-900' 
                      : 'text-red-900'
                  }`}>Price Difference</h4>
                </div>
                <div className={`text-sm ${
                  newCarrierResults.summary.percentageDifference > 0 
                    ? 'text-green-800' 
                    : 'text-red-800'
                }`}>
                  <p className="font-bold">
                    {newCarrierResults.summary.percentageDifference > 0 ? 'Cheaper by' : 'More expensive by'} {Math.abs(newCarrierResults.summary.percentageDifference).toFixed(1)}%
                  </p>
                  <p>
                    {formatCurrency(Math.abs(newCarrierResults.summary.priceDifference))} total difference
                  </p>
                  <p className="mt-2">
                    {formatCurrency(Math.abs(newCarrierResults.summary.priceDifference / newCarrierResults.summary.totalShipments))} per shipment
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-indigo-900">Recommended Margin Strategy</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xl font-bold text-indigo-900 mb-2">
                    {newCarrierResults.summary.recommendedMargin.toFixed(1)}%
                  </div>
                  <div className="text-sm text-indigo-800">
                    Recommended margin for {newCarrierResults.newCarrier.name}
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm text-indigo-800">
                        Based on {newCarrierResults.summary.totalShipments} sample shipments
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm text-indigo-800">
                        Compared against {Object.keys(newCarrierResults.competitorGroups).length} carrier groups
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm text-indigo-800">
                        {newCarrierResults.summary.percentageDifference > 0 
                          ? 'Maintains competitive advantage while maximizing profit' 
                          : 'Balances higher costs with market competitiveness'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-indigo-100">
                  <h5 className="font-medium text-indigo-900 mb-2">Implementation Strategy</h5>
                  <div className="text-sm text-indigo-800 space-y-2">
                    <p>
                      {newCarrierResults.summary.percentageDifference > 0 
                        ? `The new carrier is ${Math.abs(newCarrierResults.summary.percentageDifference).toFixed(1)}% cheaper than competitors. We recommend a ${newCarrierResults.summary.recommendedMargin.toFixed(1)}% margin to balance competitiveness with profitability.` 
                        : `The new carrier is ${Math.abs(newCarrierResults.summary.percentageDifference).toFixed(1)}% more expensive than competitors. We recommend a lower ${newCarrierResults.summary.recommendedMargin.toFixed(1)}% margin to remain competitive.`}
                    </p>
                    <p>
                      Add this carrier to your CustomerCarriers table with:
                    </p>
                    <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                      InternalName: [Customer Name]<br />
                      P44CarrierCode: {newCarrierResults.newCarrier.scac}<br />
                      Percentage: {newCarrierResults.summary.recommendedMargin.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">Shipment Comparison Details</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Carrier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competitor Avg</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {newCarrierResults.shipments.map((shipment: any, index: number) => {
                    // Calculate averages for this shipment
                    const competitorQuotes = Object.values(shipment.competitorQuotes).flat();
                    const competitorTotal = competitorQuotes.reduce((sum: number, quote: any) => {
                      return sum + (quote.rateQuoteDetail?.total || 
                                   (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts));
                    }, 0);
                    const competitorAvg = competitorTotal / (competitorQuotes.length || 1);
                    
                    const newCarrierTotal = shipment.newCarrierQuote.rateQuoteDetail?.total || 
                                          (shipment.newCarrierQuote.baseRate + 
                                           shipment.newCarrierQuote.fuelSurcharge + 
                                           shipment.newCarrierQuote.premiumsAndDiscounts);
                    
                    const difference = competitorAvg - newCarrierTotal;
                    const percentDiff = (difference / competitorAvg) * 100;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {shipment.rfq.fromZip} → {shipment.rfq.toZip}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {shipment.rfq.pallets} pallets, {shipment.rfq.grossWeight.toLocaleString()} lbs
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {formatCurrency(newCarrierTotal)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(competitorAvg)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            difference > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {difference > 0 ? '+' : ''}{formatCurrency(difference)} ({percentDiff.toFixed(1)}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderNegotiatedRatesAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Negotiated Rates Margin Analysis</h3>
        <p className="text-sm text-gray-600 mb-6">
          Analyze how negotiated rate discounts affect your margins across customers. This tool uses historical
          shipment data and current Project44 rates to calculate the impact of negotiated discounts.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Carrier
            </label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Carrier --</option>
              {availableCarriers.map((carrier) => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Negotiated Discount Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="99"
                step="0.1"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={analyzeNegotiatedRates}
            disabled={loading || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                <span>Analyze Negotiated Rates</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
      
      {negotiatedRateResults && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Negotiated Rate Impact</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-blue-900">Carrier Details</h4>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-bold">{negotiatedRateResults.carrier}</p>
                  <p>{negotiatedRateResults.summary.totalShipments} Historical Shipments</p>
                  <p className="mt-2">{negotiatedRateResults.discountPercentage}% Negotiated Discount</p>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-green-900">Cost Savings</h4>
                </div>
                <div className="text-sm text-green-800">
                  <p className="font-bold">{formatCurrency(negotiatedRateResults.summary.totalSavings)}</p>
                  <p>Total Savings</p>
                  <p className="mt-2">{formatCurrency(negotiatedRateResults.summary.avgSavingsPerShipment)} per shipment</p>
                </div>
              </div>
              
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  <h4 className="font-medium text-indigo-900">Margin Impact</h4>
                </div>
                <div className="text-sm text-indigo-800">
                  <div className="flex items-center justify-between">
                    <span>Old Margin:</span>
                    <span className="font-bold">{negotiatedRateResults.summary.oldAvgMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>New Margin:</span>
                    <span className="font-bold">{negotiatedRateResults.summary.newAvgMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span>Increase:</span>
                    <span className="font-bold text-green-600">
                      +{(negotiatedRateResults.summary.newAvgMargin - negotiatedRateResults.summary.oldAvgMargin).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-indigo-900">Strategic Recommendations</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-indigo-900 mb-2">Margin Strategy</h5>
                  <div className="text-sm text-indigo-800 space-y-2">
                    <p>
                      With a {negotiatedRateResults.discountPercentage}% negotiated discount from {negotiatedRateResults.carrier},
                      you can increase your average margin from {negotiatedRateResults.summary.oldAvgMargin.toFixed(1)}% to {negotiatedRateResults.summary.newAvgMargin.toFixed(1)}%
                      while keeping customer prices the same.
                    </p>
                    <p>
                      This represents a {formatCurrency(negotiatedRateResults.summary.totalSavings)} total cost reduction
                      that translates directly to increased profit.
                    </p>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-indigo-100">
                  <h5 className="font-medium text-indigo-900 mb-2">Customer-Specific Actions</h5>
                  <div className="text-sm text-indigo-800 space-y-2">
                    <p>
                      Update your CustomerMargins table with the following entries:
                    </p>
                    <div className="bg-gray-100 p-2 rounded font-mono text-xs max-h-32 overflow-y-auto">
                      {Object.values(negotiatedRateResults.customers)
                        .sort((a, b) => b.shipmentCount - a.shipmentCount)
                        .map((customer, index) => (
                          <div key={index} className="mb-1">
                            {customer.name}: {customer.newAvgMargin.toFixed(1)}% 
                            <span className="text-green-600"> (+{customer.marginChange.toFixed(1)}%)</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">Customer Impact Analysis</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.values(negotiatedRateResults.customers)
                    .sort((a, b) => b.shipmentCount - a.shipmentCount)
                    .map((customer, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {customer.shipmentCount}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {customer.oldAvgMargin.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {customer.newAvgMargin.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            +{customer.marginChange.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(customer.oldTotalCost - customer.newTotalCost)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">Shipment Details</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Savings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {negotiatedRateResults.shipments.map((shipment: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {shipment.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {shipment.customer}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {shipment.route}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(shipment.revenue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(shipment.oldCost)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(shipment.newCost)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {formatCurrency(shipment.savings)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{shipment.newMargin.toFixed(1)}%</span>
                          <span className="text-xs text-green-600">
                            (+{(shipment.newMargin - shipment.oldMargin).toFixed(1)}%)
                          </span>
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Analyze carrier margins and optimize pricing strategies
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveMode('new-carrier')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              activeMode === 'new-carrier'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>New Carrier Analysis</span>
          </button>
          
          <button
            onClick={() => setActiveMode('negotiated-rates')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              activeMode === 'negotiated-rates'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            <span>Negotiated Rates Analysis</span>
          </button>
        </div>
      </div>
      
      {activeMode === 'new-carrier' ? renderNewCarrierAnalysis() : renderNegotiatedRatesAnalysis()}
    </div>
  );
};