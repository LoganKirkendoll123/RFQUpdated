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
  Download,
  Layers,
  Repeat,
  ArrowRight,
  Percent,
  History
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/project44Client';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import * as XLSX from 'xlsx';

// Types for historical shipment data
interface HistoricalShipment {
  "Invoice #": number;
  "Customer"?: string;
  "Branch"?: string;
  "Scheduled Pickup Date"?: string;
  "Actual Pickup Date"?: string;
  "Scheduled Delivery Date"?: string;
  "Actual Delivery Date"?: string;
  "Origin City"?: string;
  "State"?: string;
  "Zip"?: string;
  "Destination City"?: string;
  "State_1"?: string;
  "Zip_1"?: string;
  "Sales Rep"?: string;
  "Account Rep"?: string;
  "Dispatch Rep"?: string;
  "Quote Created By"?: string;
  "Line Items"?: number;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Max Freight Class"?: string;
  "Max Length"?: string;
  "Max Width"?: string;
  "Max Height"?: string;
  "Tot Linear Ft"?: string;
  "Is VLTL"?: string;
  "Commodities"?: string;
  "Accessorials"?: string;
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Service Level"?: string;
  "Revenue"?: string;
  "Carrier Quote"?: string;
  "Carrier Expense"?: string;
  "Other Expense"?: string;
  "Profit"?: string;
  "Revenue w/o Accessorials"?: string;
  "Expense w/o Accessorials"?: string;
}

// Types for RFQ conversion
interface RFQRow {
  fromZip: string;
  toZip: string;
  weight: number;
  freightClass: string;
  length?: number;
  width?: number;
  height?: number;
  pieces: number;
  isVLTL?: boolean;
  commodities?: string;
  accessorials?: string[];
}

// Types for pricing calculations
interface PricingSettings {
  markupPercentage: number;
  minimumProfit: number;
  markupType: 'percentage' | 'fixed';
  usesCustomerMargins: boolean;
}

interface QuoteWithPricing {
  carrier: {
    name: string;
    scac: string;
  };
  serviceLevel: {
    code: string;
    description: string;
  };
  baseRate: number;
  fuelSurcharge: number;
  premiumsAndDiscounts: number;
  carrierTotalRate: number;
  customerRate: number;
  profit: number;
  marginPercentage: number;
}

// Analysis result types
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

interface PriceReductionAnalysisResult {
  customer: string;
  shipmentCount: number;
  totalHistoricalRevenue: number;
  totalHistoricalCost: number;
  totalNewCost: number;
  currentMargin: number;
  newMargin: number;
  marginDifference: number;
  costReduction: number;
  costReductionPercent: number;
  shipments: {
    historical: HistoricalShipment;
    newQuote?: QuoteWithPricing;
    oldCost: number;
    newCost: number;
    reduction: number;
  }[];
}

interface CarrierOption {
  name: string;
  count: number;
}

export const MarginAnalysisTools: React.FC = () => {
  const [analysisMode, setAnalysisMode] = useState<'margin-optimization' | 'price-reduction'>('margin-optimization');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [availableCarriers, setAvailableCarriers] = useState<CarrierOption[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    end: new Date().toISOString().split('T')[0] // today
  });
  
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<MarginAnalysisResult[]>([]);
  const [priceReductionResults, setPriceReductionResults] = useState<PriceReductionAnalysisResult[]>([]);
  const [error, setError] = useState<string>('');
  
  // Project44 client for re-quoting
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  
  // Pricing settings for margin calculations
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: false
  });
  
  // Price reduction parameters
  const [priceReduction, setPriceReduction] = useState<number>(10);

  useEffect(() => {
    loadAvailableCarriers();
    initializeProject44Client();
  }, []);

  const initializeProject44Client = async () => {
    try {
      const client = new Project44APIClient();
      setProject44Client(client);
      console.log('✅ Project44 client initialized');
    } catch (err) {
      console.error('❌ Failed to initialize Project44 client:', err);
      setError('Failed to initialize Project44 client. Please check your API configuration.');
    }
  };

  const loadAvailableCarriers = async () => {
    setIsLoadingCarriers(true);
    setError('');
    
    try {
      console.log('🔍 Loading available carriers from shipment history...');
      
      const { data: carrierData, error: carrierError } = await supabase
        .from('Shipments')
        .select('"Booked Carrier", "Quoted Carrier"')
        .not('"Booked Carrier"', 'is', null)
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);
      
      if (carrierError) {
        throw carrierError;
      }
      
      // Count occurrences of each carrier
      const carrierCounts = new Map<string, number>();
      
      carrierData?.forEach(row => {
        const bookedCarrier = row["Booked Carrier"];
        const quotedCarrier = row["Quoted Carrier"];
        
        if (bookedCarrier) {
          carrierCounts.set(bookedCarrier, (carrierCounts.get(bookedCarrier) || 0) + 1);
        }
        if (quotedCarrier && quotedCarrier !== bookedCarrier) {
          carrierCounts.set(quotedCarrier, (carrierCounts.get(quotedCarrier) || 0) + 1);
        }
      });
      
      // Convert to array and sort by count
      const carriers = Array.from(carrierCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      
      setAvailableCarriers(carriers);
      console.log(`✅ Found ${carriers.length} carriers in date range`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load carriers';
      setError(errorMsg);
      console.error('❌ Failed to load carriers:', err);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const runAnalysis = async () => {
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
    setPriceReductionResults([]);
    setAnalysisProgress({ current: 0, total: 0 });

    try {
      console.log(`🔍 Starting ${analysisMode} analysis for carrier: ${selectedCarrier}`);
      
      // Step 1: Load historical shipments for the selected carrier
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .or(`"Booked Carrier".eq.${selectedCarrier},"Quoted Carrier".eq.${selectedCarrier}`)
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .not('"Customer"', 'is', null)
        .not('"Zip"', 'is', null)
        .not('"Zip_1"', 'is', null);
      
      if (shipmentsError) {
        throw shipmentsError;
      }
      
      if (!shipments || shipments.length === 0) {
        setError('No shipments found for the selected carrier and date range');
        return;
      }
      
      console.log(`📦 Found ${shipments.length} shipments for analysis`);
      setAnalysisProgress({ current: 0, total: shipments.length });
      
      // Step 2: Group shipments by customer
      const customerGroups = shipments.reduce((groups, shipment) => {
        const customer = shipment["Customer"] || 'Unknown';
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(shipment);
        return groups;
      }, {} as Record<string, HistoricalShipment[]>);
      
      console.log(`👥 Analyzing ${Object.keys(customerGroups).length} customers`);
      
      // Step 3: Process each customer's shipments
      if (analysisMode === 'margin-optimization') {
        await runMarginOptimizationAnalysis(customerGroups);
      } else {
        await runPriceReductionAnalysis(customerGroups);
      }
      
      console.log(`🎯 Analysis completed for ${Object.keys(customerGroups).length} customers`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to run margin analysis';
      setError(errorMsg);
      console.error('❌ Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runMarginOptimizationAnalysis = async (customerGroups: Record<string, HistoricalShipment[]>) => {
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
            const newQuotes = await project44Client!.getQuotes(rfq, [], false, false, false);
            
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
      console.log(`✅ Completed margin optimization for ${customer}: ${customerResult.currentMargin.toFixed(1)}% → ${customerResult.recommendedMargin.toFixed(1)}% margin`);
    }
    
    // Sort by potential savings (highest first)
    customerResults.sort((a, b) => b.potentialSavings - a.potentialSavings);
    setResults(customerResults);
  };

  const runPriceReductionAnalysis = async (customerGroups: Record<string, HistoricalShipment[]>) => {
    const customerResults: PriceReductionAnalysisResult[] = [];
    
    for (const [customer, customerShipments] of Object.entries(customerGroups)) {
      console.log(`🔄 Processing ${customerShipments.length} shipments for customer: ${customer} (Price Reduction Analysis)`);
      
      const customerResult: PriceReductionAnalysisResult = {
        customer,
        shipmentCount: customerShipments.length,
        totalHistoricalRevenue: 0,
        totalHistoricalCost: 0,
        totalNewCost: 0,
        currentMargin: 0,
        newMargin: 0,
        marginDifference: 0,
        costReduction: 0,
        costReductionPercent: 0,
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
            const newQuotes = await project44Client!.getQuotes(rfq, [], false, false, false);
            
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
              
              // Calculate new cost with price reduction
              const oldCost = historicalCost;
              const newCost = quoteWithPricing.carrierTotalRate;
              const reduction = oldCost - newCost;
              
              customerResult.totalNewCost += newCost;
              
              customerResult.shipments.push({
                historical: shipment,
                newQuote: quoteWithPricing,
                oldCost,
                newCost,
                reduction
              });
              
              console.log(`💰 Shipment ${shipment["Invoice #"]}: Old cost $${oldCost} → New cost $${newCost} (${reduction > 0 ? 'reduction' : 'increase'} of $${Math.abs(reduction)})`);
            } else {
              // No new quote available
              customerResult.shipments.push({
                historical: shipment,
                oldCost: historicalCost,
                newCost: historicalCost,
                reduction: 0
              });
              console.log(`⚠️ No new quote available for shipment ${shipment["Invoice #"]}`);
            }
          } else {
            // Invalid shipment data
            customerResult.shipments.push({
              historical: shipment,
              oldCost: historicalCost,
              newCost: historicalCost,
              reduction: 0
            });
            console.log(`⚠️ Invalid shipment data for ${shipment["Invoice #"]}`);
          }
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error processing shipment ${shipment["Invoice #"]}:`, error);
          customerResult.shipments.push({
            historical: shipment,
            oldCost: parseFloat(shipment["Carrier Expense"] || '0') || 0,
            newCost: parseFloat(shipment["Carrier Expense"] || '0') || 0,
            reduction: 0
          });
        }
      }
      
      // Calculate margins and price reduction impact
      if (customerResult.totalHistoricalRevenue > 0 && customerResult.totalHistoricalCost > 0) {
        // Current margin calculation
        customerResult.currentMargin = ((customerResult.totalHistoricalRevenue - customerResult.totalHistoricalCost) / customerResult.totalHistoricalRevenue) * 100;
        
        // Cost reduction calculation
        customerResult.costReduction = customerResult.totalHistoricalCost - customerResult.totalNewCost;
        customerResult.costReductionPercent = (customerResult.costReduction / customerResult.totalHistoricalCost) * 100;
        
        // Calculate new margin if we apply the price reduction percentage to customer prices
        const priceReductionFactor = priceReduction / 100;
        const newRevenue = customerResult.totalHistoricalRevenue * (1 - priceReductionFactor);
        customerResult.newMargin = ((newRevenue - customerResult.totalNewCost) / newRevenue) * 100;
        customerResult.marginDifference = customerResult.newMargin - customerResult.currentMargin;
      }
      
      customerResults.push(customerResult);
      console.log(`✅ Completed price reduction analysis for ${customer}: ${customerResult.currentMargin.toFixed(1)}% → ${customerResult.newMargin.toFixed(1)}% margin with ${priceReduction}% price reduction`);
    }
    
    // Sort by cost reduction percentage (highest first)
    customerResults.sort((a, b) => b.costReductionPercent - a.costReductionPercent);
    setPriceReductionResults(customerResults);
  };

  const convertShipmentToRFQ = (shipment: HistoricalShipment): RFQRow | null => {
    try {
      const fromZip = shipment["Zip"];
      const toZip = shipment["Zip_1"];
      
      if (!fromZip || !toZip) {
        return null;
      }
      
      // Parse weight - handle various formats
      let weight = 0;
      if (shipment["Tot Weight"]) {
        const weightStr = shipment["Tot Weight"].toString().replace(/[^\d.]/g, '');
        weight = parseFloat(weightStr) || 0;
      }
      
      // Parse freight class
      let freightClass = '70'; // default
      if (shipment["Max Freight Class"]) {
        freightClass = shipment["Max Freight Class"].toString();
      }
      
      // Parse dimensions
      const length = shipment["Max Length"] ? parseFloat(shipment["Max Length"].toString()) : undefined;
      const width = shipment["Max Width"] ? parseFloat(shipment["Max Width"].toString()) : undefined;
      const height = shipment["Max Height"] ? parseFloat(shipment["Max Height"].toString()) : undefined;
      
      // Parse pieces
      const pieces = shipment["Tot Packages"] || 1;
      
      // Check if VLTL
      const isVLTL = shipment["Is VLTL"] === "TRUE";
      
      // Parse accessorials
      const accessorials = shipment["Accessorials"] ? 
        shipment["Accessorials"].split(',').map(a => a.trim()) : [];
      
      return {
        fromZip,
        toZip,
        weight,
        freightClass,
        length,
        width,
        height,
        pieces,
        isVLTL,
        commodities: shipment["Commodities"],
        accessorials
      };
    } catch (error) {
      console.error('Error converting shipment to RFQ:', error);
      return null;
    }
  };

  const exportMarginOptimizationResults = () => {
    if (results.length === 0) {
      return;
    }
    
    // Create summary sheet
    const summaryData = results.map(result => ({
      'Customer': result.customer,
      'Shipment Count': result.shipmentCount,
      'Historical Revenue': result.totalHistoricalRevenue,
      'Historical Cost': result.totalHistoricalCost,
      'New Cost': result.totalNewCost,
      'Current Margin %': result.currentMargin.toFixed(2) + '%',
      'Recommended Margin %': result.recommendedMargin.toFixed(2) + '%',
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
  
  const exportPriceReductionResults = () => {
    if (priceReductionResults.length === 0) {
      return;
    }
    
    // Create summary sheet
    const summaryData = priceReductionResults.map(result => ({
      'Customer': result.customer,
      'Shipment Count': result.shipmentCount,
      'Historical Revenue': result.totalHistoricalRevenue,
      'Historical Cost': result.totalHistoricalCost,
      'New Cost': result.totalNewCost,
      'Cost Reduction': result.costReduction,
      'Cost Reduction %': result.costReductionPercent.toFixed(2) + '%',
      'Current Margin %': result.currentMargin.toFixed(2) + '%',
      'New Margin with Price Reduction': result.newMargin.toFixed(2) + '%',
      'Margin Difference': result.marginDifference.toFixed(2) + '%'
    }));
    
    // Create detailed sheet
    const detailedData = priceReductionResults.flatMap(result => 
      result.shipments.map(shipment => ({
        'Customer': result.customer,
        'Invoice #': shipment.historical["Invoice #"],
        'Date': shipment.historical["Scheduled Pickup Date"],
        'Route': `${shipment.historical["Zip"]} → ${shipment.historical["Zip_1"]}`,
        'Weight': shipment.historical["Tot Weight"],
        'Historical Revenue': parseFloat(shipment.historical["Revenue"] || '0'),
        'Old Cost': shipment.oldCost,
        'New Cost': shipment.newCost,
        'Cost Reduction': shipment.reduction,
        'Cost Reduction %': shipment.oldCost > 0 ? ((shipment.reduction / shipment.oldCost) * 100).toFixed(2) + '%' : '0%',
        'New Carrier': shipment.newQuote?.carrier.name || 'No Quote',
        'Service Level': shipment.newQuote?.serviceLevel?.description || ''
      }))
    );
    
    const workbook = XLSX.utils.book_new();
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    
    XLSX.utils.book_append_sheet(workbook, summaryWs, 'Customer Summary');
    XLSX.utils.book_append_sheet(workbook, detailedWs, 'Shipment Details');
    
    const fileName = `price-reduction-analysis-${selectedCarrier.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
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
            <h2 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h2>
            <p className="text-sm text-gray-600">
              Analyze historical shipments to optimize margins or evaluate price reduction strategies
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Configuration</h3>
        </div>
        
        {/* Analysis Mode Selection */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            <Layers className="inline h-4 w-4 mr-1" />
            Analysis Mode
          </label>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setAnalysisMode('margin-optimization')}
              className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                analysisMode === 'margin-optimization'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Target className="h-5 w-5" />
              <div className="text-left">
                <div>Margin Optimization</div>
                <div className="text-xs opacity-80">Maintain profit with new rates</div>
              </div>
            </button>
            <button
              onClick={() => setAnalysisMode('price-reduction')}
              className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                analysisMode === 'price-reduction'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TrendingDown className="h-5 w-5" />
              <div className="text-left">
                <div>Price Reduction Analysis</div>
                <div className="text-xs opacity-80">Impact of reducing customer prices</div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Price Reduction Parameters (only shown for price reduction mode) */}
        {analysisMode === 'price-reduction' && (
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Percent className="inline h-4 w-4 mr-1" />
              Price Reduction Percentage
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="1"
                max="30"
                value={priceReduction}
                onChange={(e) => setPriceReduction(parseInt(e.target.value))}
                className="flex-1 h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="w-16 px-3 py-2 bg-white border border-gray-300 rounded-md text-center font-medium">
                {priceReduction}%
              </div>
            </div>
            <p className="mt-2 text-sm text-green-700">
              Analyze the impact of reducing customer prices by {priceReduction}% while using new carrier rates
            </p>
          </div>
        )}
        
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Truck className="inline h-4 w-4 mr-1" />
              Select Carrier ({availableCarriers.length} available)
            </label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
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
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
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
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center space-x-4">
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
            onClick={runAnalysis}
            disabled={!selectedCarrier || isAnalyzing || !project44Client}
            className={`flex items-center space-x-2 px-6 py-2 text-white rounded-lg disabled:bg-gray-400 ${
              analysisMode === 'margin-optimization' 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isAnalyzing ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>Run {analysisMode === 'margin-optimization' ? 'Margin' : 'Price Reduction'} Analysis</span>
          </button>
          
          {analysisMode === 'margin-optimization' && results.length > 0 && (
            <button
              onClick={exportMarginOptimizationResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          )}
          
          {analysisMode === 'price-reduction' && priceReductionResults.length > 0 && (
            <button
              onClick={exportPriceReductionResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="h-5 w-5 animate-spin text-purple-600" />
            <span className="font-medium text-gray-900">
              Analyzing shipments... ({analysisProgress.current} of {analysisProgress.total})
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${analysisProgress.total > 0 ? (analysisProgress.current / analysisProgress.total) * 100 : 0}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {analysisMode === 'margin-optimization' && results.length > 0 && (
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
                <TrendingUp className="h-8 w-8 text-green-500" />
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
              <h3 className="text-lg font-semibold text-gray-900">Margin Optimization Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recommended margins to maintain current profit levels with new carrier rates
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
                      <td className="px-6 py-4 text-sm">
                        <span className="font-bold text-green-600">
                          {formatCurrency(result.potentialSavings)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Price Reduction Results */}
      {analysisMode === 'price-reduction' && priceReductionResults.length > 0 && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{priceReductionResults.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {priceReductionResults.reduce((sum, r) => sum + r.shipmentCount, 0)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Cost Reduction</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(priceReductionResults.reduce((sum, r) => sum + r.costReduction, 0))}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Margin Impact</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(priceReductionResults.reduce((sum, r) => sum + r.marginDifference, 0) / priceReductionResults.length).toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Customer Results */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Price Reduction Analysis Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                Impact of reducing customer prices by {priceReduction}% with new carrier rates
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Historical Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Reduction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {priceReductionResults.map((result) => (
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
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-green-600">{formatCurrency(result.costReduction)}</span>
                          <span className="text-xs text-gray-500">({result.costReductionPercent.toFixed(1)}%)</span>
                        </div>
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
                          result.newMargin >= 20 ? 'bg-green-100 text-green-800' :
                          result.newMargin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.newMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          {result.marginDifference > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 font-medium">
                                +{result.marginDifference.toFixed(1)}%
                              </span>
                            </>
                          ) : result.marginDifference < 0 ? (
                            <>
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              <span className="text-red-600 font-medium">
                                {result.marginDifference.toFixed(1)}%
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
      {results.length === 0 && priceReductionResults.length === 0 && !isAnalyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Layers className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Two Analysis Modes Available:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-800">Margin Optimization</span>
                  </div>
                  <p className="text-sm text-purple-700 mb-2">
                    Maintains your current profit dollars while adjusting margins based on new carrier rates.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-purple-700">
                    <li>Re-quotes historical shipments with current rates</li>
                    <li>Calculates new margin that maintains same profit</li>
                    <li>Shows potential cost savings with new rates</li>
                    <li>Ideal when carrier rates have changed</li>
                  </ol>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Price Reduction Analysis</span>
                  </div>
                  <p className="text-sm text-green-700 mb-2">
                    Shows the impact of reducing customer prices while using new carrier rates.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-green-700">
                    <li>Re-quotes historical shipments with current rates</li>
                    <li>Applies a price reduction to customer prices</li>
                    <li>Shows impact on margins and profitability</li>
                    <li>Ideal for competitive pricing strategies</li>
                  </ol>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                <p className="font-medium text-blue-800 mb-1">How to use:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                  <li>Select an analysis mode based on your goal</li>
                  <li>Choose a carrier from your shipment history</li>
                  <li>Set the date range (default: last 12 months)</li>
                  <li>For price reduction mode, adjust the reduction percentage</li>
                  <li>Run the analysis to see detailed results by customer</li>
                  <li>Export to Excel for implementation planning</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};