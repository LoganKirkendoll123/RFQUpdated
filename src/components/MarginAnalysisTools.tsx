import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Truck, 
  DollarSign, 
  Users, 
  RefreshCw, 
  Loader, 
  AlertCircle, 
  CheckCircle,
  ArrowRight,
  BarChart3,
  FileText,
  Download,
  Target,
  Zap,
  Building2
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQRow } from '../types';
import * as XLSX from 'xlsx';

// Sample shipment data for analysis
const SAMPLE_SHIPMENTS: RFQRow[] = [
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
    pallets: 12,
    grossWeight: 18000,
    isStackable: true,
    accessorial: []
  },
  {
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '33101',
    toZip: '75201',
    pallets: 1,
    grossWeight: 800,
    isStackable: true,
    accessorial: []
  },
  {
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '94102',
    toZip: '02101',
    pallets: 4,
    grossWeight: 3200,
    isStackable: false,
    accessorial: []
  }
];

interface NewCarrierAnalysisResult {
  shipmentId: number;
  route: string;
  weight: number;
  pallets: number;
  newCarrierRate: number;
  competitorAvgRate: number;
  priceDifference: number;
  percentageDifference: number;
  recommendedMargin: number;
  competitorRates: {
    carrierName: string;
    rate: number;
  }[];
}

interface NegotiatedRatesAnalysisResult {
  customerId: string;
  customerName: string;
  shipmentCount: number;
  oldTotalCost: number;
  newTotalCost: number;
  totalSavings: number;
  savingsPercentage: number;
  currentMargin: number;
  recommendedMargin: number;
  additionalProfit: number;
  shipments: {
    invoiceNumber: number;
    route: string;
    date: string;
    weight: number;
    oldRate: number;
    newRate: number;
    savings: number;
  }[];
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'new-carrier' | 'negotiated-rates'>('new-carrier');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Project44 API client
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  
  // Carrier groups from Project44
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  // New Carrier Analysis state
  const [newCarrierScac, setNewCarrierScac] = useState('');
  const [newCarrierName, setNewCarrierName] = useState('');
  const [selectedCompetitorGroups, setSelectedCompetitorGroups] = useState<{[groupCode: string]: boolean}>({});
  const [newCarrierResults, setNewCarrierResults] = useState<NewCarrierAnalysisResult[]>([]);
  const [newCarrierSummary, setNewCarrierSummary] = useState<{
    avgPriceDifference: number;
    avgPercentageDifference: number;
    recommendedMargin: number;
    totalShipments: number;
  } | null>(null);
  
  // Negotiated Rates Analysis state
  const [existingCarrierScac, setExistingCarrierScac] = useState('');
  const [existingCarrierName, setExistingCarrierName] = useState('');
  const [negotiatedDiscount, setNegotiatedDiscount] = useState(5);
  const [negotiatedRatesResults, setNegotiatedRatesResults] = useState<NegotiatedRatesAnalysisResult[]>([]);
  const [negotiatedRatesSummary, setNegotiatedRatesSummary] = useState<{
    totalShipments: number;
    totalOldCost: number;
    totalNewCost: number;
    totalSavings: number;
    overallSavingsPercentage: number;
    totalAdditionalProfit: number;
    customerCount: number;
  } | null>(null);
  
  // Carrier list from database
  const [carrierList, setCarrierList] = useState<{scac: string; name: string}[]>([]);
  const [customerList, setCustomerList] = useState<string[]>([]);
  
  // Initialize Project44 client from localStorage
  useEffect(() => {
    const initProject44Client = () => {
      try {
        const savedConfig = localStorage.getItem('project44_config');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          const client = new Project44APIClient(config);
          setProject44Client(client);
          console.log('✅ Project44 client initialized from saved config');
        }
      } catch (error) {
        console.error('Failed to initialize Project44 client:', error);
      }
    };
    
    initProject44Client();
    loadCarrierList();
    loadCustomerList();
  }, []);
  
  const loadCarrierGroups = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }
    
    setIsLoadingCarriers(true);
    try {
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      // Initialize all groups as selected
      const initialGroupSelection = groups.reduce((acc, group) => {
        acc[group.groupCode] = true;
        return acc;
      }, {} as {[groupCode: string]: boolean});
      
      setSelectedCompetitorGroups(initialGroupSelection);
      setSuccess('Carrier groups loaded successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load carrier groups');
    } finally {
      setIsLoadingCarriers(false);
    }
  };
  
  const loadCarrierList = async () => {
    try {
      // Get unique carriers from shipment history
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Booked Carrier", "Quoted Carrier"')
        .limit(500);
      
      if (error) throw error;
      
      const carriers = new Set<string>();
      data?.forEach(s => {
        if (s["Booked Carrier"]) carriers.add(s["Booked Carrier"]);
        if (s["Quoted Carrier"]) carriers.add(s["Quoted Carrier"]);
      });
      
      // Also get carriers from CustomerCarriers table
      const { data: ccData, error: ccError } = await supabase
        .from('CustomerCarriers')
        .select('"P44CarrierCode", "InternalName"')
        .limit(500);
      
      if (ccError) throw ccError;
      
      // Map SCAC codes to carrier names
      const carrierMap = new Map<string, string>();
      
      // Add carriers from shipment history
      Array.from(carriers).forEach(name => {
        // Extract SCAC if it's in parentheses
        const scacMatch = name.match(/\(([A-Z]{2,4})\)/);
        const scac = scacMatch ? scacMatch[1] : name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
        carrierMap.set(scac, name);
      });
      
      // Add carriers from CustomerCarriers
      ccData?.forEach(cc => {
        if (cc["P44CarrierCode"] && cc["InternalName"]) {
          carrierMap.set(cc["P44CarrierCode"], cc["InternalName"]);
        }
      });
      
      // Convert to array format
      const carrierArray = Array.from(carrierMap.entries()).map(([scac, name]) => ({
        scac,
        name
      }));
      
      setCarrierList(carrierArray.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to load carrier list:', error);
    }
  };
  
  const loadCustomerList = async () => {
    try {
      // Get unique customers from CustomerCarriers table
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null)
        .limit(500);
      
      if (error) throw error;
      
      const customers = new Set<string>();
      data?.forEach(cc => {
        if (cc.InternalName) customers.add(cc.InternalName);
      });
      
      setCustomerList(Array.from(customers).sort());
    } catch (error) {
      console.error('Failed to load customer list:', error);
    }
  };
  
  const runNewCarrierAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }
    
    if (!newCarrierScac || !newCarrierName) {
      setError('Please enter both SCAC code and name for the new carrier');
      return;
    }
    
    const selectedGroups = Object.entries(selectedCompetitorGroups)
      .filter(([_, selected]) => selected)
      .map(([groupCode, _]) => groupCode);
    
    if (selectedGroups.length === 0) {
      setError('Please select at least one competitor carrier group');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    setNewCarrierResults([]);
    setNewCarrierSummary(null);
    
    try {
      // Create a list of sample shipments to test
      const results: NewCarrierAnalysisResult[] = [];
      
      // Process each sample shipment
      for (let i = 0; i < SAMPLE_SHIPMENTS.length; i++) {
        const shipment = SAMPLE_SHIPMENTS[i];
        
        // Get quote from new carrier
        const newCarrierQuotes = await project44Client.getQuotes(
          shipment,
          [newCarrierScac],
          shipment.pallets >= 10 || shipment.grossWeight >= 15000
        );
        
        if (newCarrierQuotes.length === 0) {
          console.log(`No quotes from new carrier for shipment ${i+1}`);
          continue;
        }
        
        // Get the best quote from the new carrier
        const bestNewCarrierQuote = newCarrierQuotes.reduce((best, current) => {
          const bestTotal = best.rateQuoteDetail?.total || 
            (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
          
          const currentTotal = current.rateQuoteDetail?.total || 
            (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
          
          return currentTotal < bestTotal ? current : best;
        });
        
        const newCarrierRate = bestNewCarrierQuote.rateQuoteDetail?.total || 
          (bestNewCarrierQuote.baseRate + bestNewCarrierQuote.fuelSurcharge + bestNewCarrierQuote.premiumsAndDiscounts);
        
        // Get quotes from competitor groups
        const competitorRates: {carrierName: string; rate: number}[] = [];
        
        for (const groupCode of selectedGroups) {
          const competitorQuotes = await project44Client.getQuotesForAccountGroup(
            shipment,
            groupCode,
            shipment.pallets >= 10 || shipment.grossWeight >= 15000
          );
          
          competitorQuotes.forEach(quote => {
            const rate = quote.rateQuoteDetail?.total || 
              (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts);
            
            competitorRates.push({
              carrierName: quote.carrier.name,
              rate
            });
          });
        }
        
        if (competitorRates.length === 0) {
          console.log(`No competitor quotes for shipment ${i+1}`);
          continue;
        }
        
        // Calculate average competitor rate
        const totalCompetitorRate = competitorRates.reduce((sum, { rate }) => sum + rate, 0);
        const avgCompetitorRate = totalCompetitorRate / competitorRates.length;
        
        // Calculate price difference
        const priceDifference = avgCompetitorRate - newCarrierRate;
        const percentageDifference = (priceDifference / newCarrierRate) * 100;
        
        // Calculate recommended margin
        // If new carrier is cheaper, we can add margin to match competitor prices
        // If new carrier is more expensive, we need to reduce margin to be competitive
        const recommendedMargin = Math.max(0, percentageDifference);
        
        results.push({
          shipmentId: i + 1,
          route: `${shipment.fromZip} → ${shipment.toZip}`,
          weight: shipment.grossWeight,
          pallets: shipment.pallets,
          newCarrierRate,
          competitorAvgRate: avgCompetitorRate,
          priceDifference,
          percentageDifference,
          recommendedMargin,
          competitorRates: competitorRates.sort((a, b) => a.rate - b.rate)
        });
      }
      
      // Calculate summary statistics
      if (results.length > 0) {
        const totalPriceDifference = results.reduce((sum, r) => sum + r.priceDifference, 0);
        const totalPercentageDifference = results.reduce((sum, r) => sum + r.percentageDifference, 0);
        
        const avgPriceDifference = totalPriceDifference / results.length;
        const avgPercentageDifference = totalPercentageDifference / results.length;
        
        // Calculate overall recommended margin
        // We use the average percentage difference if it's positive (new carrier is cheaper)
        // Otherwise, we recommend a minimal margin
        const overallRecommendedMargin = Math.max(5, avgPercentageDifference);
        
        setNewCarrierSummary({
          avgPriceDifference,
          avgPercentageDifference,
          recommendedMargin: overallRecommendedMargin,
          totalShipments: results.length
        });
      }
      
      setNewCarrierResults(results);
      setSuccess(`Analysis completed for ${results.length} sample shipments`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };
  
  const runNegotiatedRatesAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }
    
    if (!existingCarrierScac) {
      setError('Please select an existing carrier');
      return;
    }
    
    if (negotiatedDiscount <= 0 || negotiatedDiscount >= 100) {
      setError('Please enter a valid discount percentage between 0 and 100');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    setNegotiatedRatesResults([]);
    setNegotiatedRatesSummary(null);
    
    try {
      // Get historical shipments for this carrier
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('Shipments')
        .select('*')
        .or(`"Booked Carrier".ilike.%${existingCarrierName}%,"Quoted Carrier".ilike.%${existingCarrierName}%`)
        .order('"Scheduled Pickup Date"', { ascending: false })
        .limit(100);
      
      if (shipmentError) throw shipmentError;
      
      if (!shipmentData || shipmentData.length === 0) {
        setError(`No historical shipments found for carrier: ${existingCarrierName}`);
        setIsLoading(false);
        return;
      }
      
      // Group shipments by customer
      const shipmentsByCustomer = shipmentData.reduce((acc, shipment) => {
        const customer = shipment["Customer"] || 'Unknown';
        if (!acc[customer]) {
          acc[customer] = [];
        }
        acc[customer].push(shipment);
        return acc;
      }, {} as Record<string, any[]>);
      
      // Process each customer's shipments
      const customerResults: NegotiatedRatesAnalysisResult[] = [];
      
      for (const [customerName, shipments] of Object.entries(shipmentsByCustomer)) {
        // Skip if no shipments
        if (shipments.length === 0) continue;
        
        // Get customer margin from CustomerCarriers table
        const { data: marginData } = await supabase
          .from('CustomerCarriers')
          .select('Percentage')
          .eq('InternalName', customerName)
          .ilike('P44CarrierCode', `%${existingCarrierScac}%`)
          .limit(1);
        
        const currentMargin = marginData && marginData.length > 0 
          ? parseFloat(marginData[0].Percentage || '0') 
          : 15; // Default margin if not found
        
        const shipmentResults = [];
        let oldTotalCost = 0;
        let newTotalCost = 0;
        
        // Process each shipment
        for (const shipment of shipments) {
          // Parse historical data
          const invoiceNumber = shipment["Invoice #"];
          const fromZip = shipment["Zip"] || '';
          const toZip = shipment["Zip_1"] || '';
          const date = shipment["Scheduled Pickup Date"] || '';
          const weight = parseNumeric(shipment["Tot Weight"]);
          const pallets = shipment["Tot Packages"] || 1;
          
          // Get historical rate
          const oldRate = parseNumeric(shipment["Carrier Expense"]) || parseNumeric(shipment["Carrier Quote"]);
          if (!oldRate) continue; // Skip if no rate data
          
          // Create RFQ from historical shipment
          const rfq: RFQRow = {
            fromDate: date || new Date().toISOString().split('T')[0],
            fromZip,
            toZip,
            pallets: Number(pallets),
            grossWeight: weight,
            isStackable: false,
            accessorial: []
          };
          
          // Get current rate from Project44
          const quotes = await project44Client.getQuotes(
            rfq,
            [existingCarrierScac],
            Number(pallets) >= 10 || weight >= 15000
          );
          
          if (quotes.length === 0) continue; // Skip if no quotes
          
          // Get the best quote
          const bestQuote = quotes.reduce((best, current) => {
            const bestTotal = best.rateQuoteDetail?.total || 
              (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
            
            const currentTotal = current.rateQuoteDetail?.total || 
              (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
            
            return currentTotal < bestTotal ? current : best;
          });
          
          const currentRate = bestQuote.rateQuoteDetail?.total || 
            (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts);
          
          // Apply negotiated discount to current rate
          const newRate = currentRate * (1 - negotiatedDiscount / 100);
          const savings = oldRate - newRate;
          
          shipmentResults.push({
            invoiceNumber,
            route: `${fromZip} → ${toZip}`,
            date,
            weight,
            oldRate,
            newRate,
            savings
          });
          
          oldTotalCost += oldRate;
          newTotalCost += newRate;
        }
        
        if (shipmentResults.length === 0) continue; // Skip if no valid shipments
        
        // Calculate total savings
        const totalSavings = oldTotalCost - newTotalCost;
        const savingsPercentage = (totalSavings / oldTotalCost) * 100;
        
        // Calculate recommended new margin
        // The goal is to keep the same price to customer while increasing profit margin
        const recommendedMargin = currentMargin + savingsPercentage;
        
        // Calculate additional profit (all savings become profit)
        const additionalProfit = totalSavings;
        
        customerResults.push({
          customerId: customerName.replace(/\s+/g, '_').toLowerCase(),
          customerName,
          shipmentCount: shipmentResults.length,
          oldTotalCost,
          newTotalCost,
          totalSavings,
          savingsPercentage,
          currentMargin,
          recommendedMargin,
          additionalProfit,
          shipments: shipmentResults
        });
      }
      
      // Calculate overall summary
      if (customerResults.length > 0) {
        const totalShipments = customerResults.reduce((sum, r) => sum + r.shipmentCount, 0);
        const totalOldCost = customerResults.reduce((sum, r) => sum + r.oldTotalCost, 0);
        const totalNewCost = customerResults.reduce((sum, r) => sum + r.newTotalCost, 0);
        const totalSavings = customerResults.reduce((sum, r) => sum + r.totalSavings, 0);
        const overallSavingsPercentage = (totalSavings / totalOldCost) * 100;
        const totalAdditionalProfit = customerResults.reduce((sum, r) => sum + r.additionalProfit, 0);
        
        setNegotiatedRatesSummary({
          totalShipments,
          totalOldCost,
          totalNewCost,
          totalSavings,
          overallSavingsPercentage,
          totalAdditionalProfit,
          customerCount: customerResults.length
        });
      }
      
      setNegotiatedRatesResults(customerResults);
      setSuccess(`Analysis completed for ${customerResults.length} customers with ${customerResults.reduce((sum, r) => sum + r.shipmentCount, 0)} total shipments`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };
  
  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };
  
  const exportNewCarrierResults = () => {
    if (newCarrierResults.length === 0) return;
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create summary sheet
    const summaryData = [
      ['New Carrier Analysis Summary'],
      [''],
      ['Carrier SCAC', newCarrierScac],
      ['Carrier Name', newCarrierName],
      ['Total Shipments Analyzed', newCarrierSummary?.totalShipments || 0],
      ['Average Price Difference', formatCurrency(newCarrierSummary?.avgPriceDifference || 0)],
      ['Average Percentage Difference', `${(newCarrierSummary?.avgPercentageDifference || 0).toFixed(2)}%`],
      ['Recommended Margin', `${(newCarrierSummary?.recommendedMargin || 0).toFixed(2)}%`],
      [''],
      ['Analysis Date', new Date().toLocaleDateString()]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Create detailed results sheet
    const detailsHeaders = [
      'Shipment ID', 'Route', 'Weight (lbs)', 'Pallets', 
      'New Carrier Rate', 'Competitor Avg Rate', 'Price Difference', 
      'Percentage Difference', 'Recommended Margin'
    ];
    
    const detailsData = newCarrierResults.map(result => [
      result.shipmentId,
      result.route,
      result.weight,
      result.pallets,
      result.newCarrierRate,
      result.competitorAvgRate,
      result.priceDifference,
      `${result.percentageDifference.toFixed(2)}%`,
      `${result.recommendedMargin.toFixed(2)}%`
    ]);
    
    const detailsWs = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsData]);
    XLSX.utils.book_append_sheet(wb, detailsWs, 'Shipment Details');
    
    // Create competitor rates sheet
    const competitorData: any[][] = [['Shipment ID', 'Route', 'Carrier', 'Rate']];
    
    newCarrierResults.forEach(result => {
      result.competitorRates.forEach(competitor => {
        competitorData.push([
          result.shipmentId,
          result.route,
          competitor.carrierName,
          competitor.rate
        ]);
      });
    });
    
    const competitorWs = XLSX.utils.aoa_to_sheet(competitorData);
    XLSX.utils.book_append_sheet(wb, competitorWs, 'Competitor Rates');
    
    // Write file and trigger download
    XLSX.writeFile(wb, `new-carrier-analysis-${newCarrierScac}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  const exportNegotiatedRatesResults = () => {
    if (negotiatedRatesResults.length === 0) return;
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create summary sheet
    const summaryData = [
      ['Negotiated Rates Analysis Summary'],
      [''],
      ['Carrier SCAC', existingCarrierScac],
      ['Carrier Name', existingCarrierName],
      ['Negotiated Discount', `${negotiatedDiscount}%`],
      ['Total Customers', negotiatedRatesSummary?.customerCount || 0],
      ['Total Shipments Analyzed', negotiatedRatesSummary?.totalShipments || 0],
      ['Total Old Cost', formatCurrency(negotiatedRatesSummary?.totalOldCost || 0)],
      ['Total New Cost', formatCurrency(negotiatedRatesSummary?.totalNewCost || 0)],
      ['Total Savings', formatCurrency(negotiatedRatesSummary?.totalSavings || 0)],
      ['Overall Savings Percentage', `${(negotiatedRatesSummary?.overallSavingsPercentage || 0).toFixed(2)}%`],
      ['Total Additional Profit', formatCurrency(negotiatedRatesSummary?.totalAdditionalProfit || 0)],
      [''],
      ['Analysis Date', new Date().toLocaleDateString()]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Create customer summary sheet
    const customerHeaders = [
      'Customer', 'Shipment Count', 'Old Total Cost', 'New Total Cost', 
      'Total Savings', 'Savings %', 'Current Margin', 
      'Recommended Margin', 'Additional Profit'
    ];
    
    const customerData = negotiatedRatesResults.map(result => [
      result.customerName,
      result.shipmentCount,
      result.oldTotalCost,
      result.newTotalCost,
      result.totalSavings,
      `${result.savingsPercentage.toFixed(2)}%`,
      `${result.currentMargin.toFixed(2)}%`,
      `${result.recommendedMargin.toFixed(2)}%`,
      result.additionalProfit
    ]);
    
    const customerWs = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerData]);
    XLSX.utils.book_append_sheet(wb, customerWs, 'Customer Summary');
    
    // Create shipment details sheet
    const shipmentData: any[][] = [['Customer', 'Invoice #', 'Route', 'Date', 'Weight (lbs)', 'Old Rate', 'New Rate', 'Savings']];
    
    negotiatedRatesResults.forEach(result => {
      result.shipments.forEach(shipment => {
        shipmentData.push([
          result.customerName,
          shipment.invoiceNumber,
          shipment.route,
          shipment.date,
          shipment.weight,
          shipment.oldRate,
          shipment.newRate,
          shipment.savings
        ]);
      });
    });
    
    const shipmentWs = XLSX.utils.aoa_to_sheet(shipmentData);
    XLSX.utils.book_append_sheet(wb, shipmentWs, 'Shipment Details');
    
    // Write file and trigger download
    XLSX.writeFile(wb, `negotiated-rates-analysis-${existingCarrierScac}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  const renderNewCarrierAnalysis = () => (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Carrier Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Compare a new carrier's rates against existing carrier groups to determine optimal margin settings.
          This analysis uses Project44 API to get real quotes for sample shipments.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Carrier Name
            </label>
            <input
              type="text"
              value={newCarrierName}
              onChange={(e) => setNewCarrierName(e.target.value)}
              placeholder="ABC Freight"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* Carrier Group Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Compare Against Carrier Groups
            </label>
            
            {carrierGroups.length === 0 && (
              <button
                onClick={loadCarrierGroups}
                disabled={isLoadingCarriers || !project44Client}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoadingCarriers ? (
                  <>
                    <Loader className="h-3 w-3 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    <span>Load Carrier Groups</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          {carrierGroups.length > 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {carrierGroups.map((group) => (
                  <label key={group.groupCode} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedCompetitorGroups[group.groupCode] || false}
                      onChange={(e) => {
                        setSelectedCompetitorGroups({
                          ...selectedCompetitorGroups,
                          [group.groupCode]: e.target.checked
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {group.groupName} ({group.carriers.length} carriers)
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
              No carrier groups loaded. Click "Load Carrier Groups" to fetch from Project44.
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={runNewCarrierAnalysis}
            disabled={isLoading || !project44Client || !newCarrierScac || !newCarrierName}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                <span>Run Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Results */}
      {newCarrierSummary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
            <button
              onClick={exportNewCarrierResults}
              className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              <Download className="h-3 w-3" />
              <span>Export to Excel</span>
            </button>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">Average Price Difference</div>
              <div className="text-xl font-bold text-blue-800">
                {formatCurrency(newCarrierSummary.avgPriceDifference)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Per shipment
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">Average % Difference</div>
              <div className="text-xl font-bold text-blue-800">
                {newCarrierSummary.avgPercentageDifference.toFixed(2)}%
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {newCarrierSummary.avgPercentageDifference >= 0 ? 'Cheaper than competitors' : 'More expensive than competitors'}
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 mb-1">Recommended Margin</div>
              <div className="text-xl font-bold text-green-800">
                {newCarrierSummary.recommendedMargin.toFixed(2)}%
              </div>
              <div className="text-xs text-green-600 mt-1">
                Optimal margin to remain competitive
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-sm text-purple-600 mb-1">Shipments Analyzed</div>
              <div className="text-xl font-bold text-purple-800">
                {newCarrierSummary.totalShipments}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                Sample shipments
              </div>
            </div>
          </div>
          
          {/* Detailed Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipment
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New Carrier Rate
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Competitor Avg
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommended Margin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {newCarrierResults.map((result) => (
                  <tr key={result.shipmentId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      #{result.shipmentId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {result.route}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {result.weight.toLocaleString()} lbs, {result.pallets} pallets
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(result.newCarrierRate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatCurrency(result.competitorAvgRate)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className={`font-medium ${result.priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(result.priceDifference)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {result.percentageDifference.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">
                      {result.recommendedMargin.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Recommendation Box */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Target className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-md font-semibold text-green-800 mb-2">Margin Recommendation</h4>
                <p className="text-sm text-green-700 mb-2">
                  Based on the analysis of {newCarrierSummary.totalShipments} sample shipments, we recommend setting a margin of <strong>{newCarrierSummary.recommendedMargin.toFixed(2)}%</strong> for {newCarrierName} ({newCarrierScac}).
                </p>
                <p className="text-sm text-green-700">
                  This carrier is on average <strong>{Math.abs(newCarrierSummary.avgPercentageDifference).toFixed(2)}% {newCarrierSummary.avgPercentageDifference >= 0 ? 'cheaper' : 'more expensive'}</strong> than competitors, with an average price difference of <strong>{formatCurrency(Math.abs(newCarrierSummary.avgPriceDifference))}</strong> per shipment.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderNegotiatedRatesAnalysis = () => (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Negotiated Rates Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Analyze the impact of negotiated rate discounts on your margins. This tool uses your shipment history
          and current Project44 rates to calculate optimal new margins while keeping customer prices the same.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier
            </label>
            <select
              value={existingCarrierScac}
              onChange={(e) => {
                setExistingCarrierScac(e.target.value);
                const selectedCarrier = carrierList.find(c => c.scac === e.target.value);
                setExistingCarrierName(selectedCarrier?.name || e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a carrier</option>
              {carrierList.map((carrier) => (
                <option key={carrier.scac} value={carrier.scac}>
                  {carrier.name} ({carrier.scac})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Negotiated Discount (%)
            </label>
            <input
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={negotiatedDiscount}
              onChange={(e) => setNegotiatedDiscount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={runNegotiatedRatesAnalysis}
              disabled={isLoading || !project44Client || !existingCarrierScac}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  <span>Run Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">How this analysis works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>We analyze your historical shipments with this carrier</li>
                <li>For each shipment, we get current rates via Project44 API</li>
                <li>We apply your negotiated discount to calculate new costs</li>
                <li>We calculate new margins that maintain the same customer price</li>
                <li>All savings from negotiated rates become additional profit</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      
      {/* Results */}
      {negotiatedRatesSummary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
            <button
              onClick={exportNegotiatedRatesResults}
              className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              <Download className="h-3 w-3" />
              <span>Export to Excel</span>
            </button>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">Total Savings</div>
              <div className="text-xl font-bold text-blue-800">
                {formatCurrency(negotiatedRatesSummary.totalSavings)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {negotiatedRatesSummary.overallSavingsPercentage.toFixed(2)}% reduction
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 mb-1">Additional Profit</div>
              <div className="text-xl font-bold text-green-800">
                {formatCurrency(negotiatedRatesSummary.totalAdditionalProfit)}
              </div>
              <div className="text-xs text-green-600 mt-1">
                All savings become profit
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-sm text-purple-600 mb-1">Customers Affected</div>
              <div className="text-xl font-bold text-purple-800">
                {negotiatedRatesSummary.customerCount}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                With {negotiatedRatesSummary.totalShipments} shipments
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-orange-600 mb-1">Negotiated Discount</div>
              <div className="text-xl font-bold text-orange-800">
                {negotiatedDiscount}%
              </div>
              <div className="text-xs text-orange-600 mt-1">
                Applied to {existingCarrierName}
              </div>
            </div>
          </div>
          
          {/* Customer Results */}
          <div className="space-y-6">
            <h4 className="text-md font-semibold text-gray-800">Customer Impact Analysis</h4>
            
            {negotiatedRatesResults.map((result) => (
              <div key={result.customerId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <h5 className="font-medium text-gray-900">{result.customerName}</h5>
                      <span className="text-xs text-gray-500">
                        ({result.shipmentCount} shipments)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        Savings: {formatCurrency(result.totalSavings)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {result.savingsPercentage.toFixed(2)}% reduction
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Current Margin</div>
                      <div className="text-lg font-medium text-gray-900">
                        {result.currentMargin.toFixed(2)}%
                      </div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-green-600 mb-1">Recommended New Margin</div>
                      <div className="text-lg font-medium text-green-800">
                        {result.recommendedMargin.toFixed(2)}%
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-600 mb-1">Additional Profit</div>
                      <div className="text-lg font-medium text-blue-800">
                        {formatCurrency(result.additionalProfit)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <ArrowRight className="h-4 w-4" />
                    <span>Shipment Details ({result.shipments.length})</span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Invoice #
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Route
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Weight
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Old Rate
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            New Rate
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Savings
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {result.shipments.slice(0, 5).map((shipment) => (
                          <tr key={shipment.invoiceNumber} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                              {shipment.invoiceNumber}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                              {shipment.route}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                              {shipment.weight.toLocaleString()} lbs
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                              {formatCurrency(shipment.oldRate)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                              {formatCurrency(shipment.newRate)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-green-600">
                              {formatCurrency(shipment.savings)}
                            </td>
                          </tr>
                        ))}
                        
                        {result.shipments.length > 5 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-xs text-center text-gray-500">
                              + {result.shipments.length - 5} more shipments
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Recommendation Box */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Zap className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-md font-semibold text-green-800 mb-2">Margin Optimization Recommendation</h4>
                <p className="text-sm text-green-700 mb-2">
                  Based on the analysis of {negotiatedRatesSummary.totalShipments} historical shipments across {negotiatedRatesSummary.customerCount} customers, a {negotiatedDiscount}% negotiated discount with {existingCarrierName} will generate <strong>{formatCurrency(negotiatedRatesSummary.totalAdditionalProfit)}</strong> in additional profit while keeping customer prices the same.
                </p>
                <p className="text-sm text-green-700">
                  We recommend updating your margin settings for each customer as shown above. This will allow you to maintain current customer pricing while capturing 100% of the negotiated savings as additional profit.
                </p>
              </div>
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
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Analyze carrier rates and optimize your margins to maximize profitability
            </p>
          </div>
        </div>
      </div>
      
      {/* Mode Selection */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveMode('new-carrier')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeMode === 'new-carrier'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            New Carrier Analysis
          </button>
          <button
            onClick={() => setActiveMode('negotiated-rates')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeMode === 'negotiated-rates'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Negotiated Rates Analysis
          </button>
        </div>
        
        <div className="p-6">
          {/* Error and Success Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span>{success}</span>
              </div>
            </div>
          )}
          
          {/* Active Mode Content */}
          {activeMode === 'new-carrier' ? renderNewCarrierAnalysis() : renderNegotiatedRatesAnalysis()}
        </div>
      </div>
    </div>
  );
};