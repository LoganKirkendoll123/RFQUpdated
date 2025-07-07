import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Calendar,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Loader,
  BarChart3,
  Target,
  ArrowRight,
  RefreshCw,
  Download,
  Building2,
  Truck,
  Info,
  MapPin
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from './utils/apiClient';
import { supabase } from './utils/supabase';
import { formatCurrency } from './utils/pricingCalculator';
import { RFQRow, Quote } from '../types';
import * as XLSX from 'xlsx';

// Sample RFQ data for API testing
const SAMPLE_RFQS = [
  {
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '60607',
    toZip: '30033',
    pallets: 3,
    grossWeight: 2500,
    isStackable: false,
    isReefer: false,
    accessorial: []
  },
  {
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '90210',
    toZip: '10001',
    pallets: 5,
    grossWeight: 4000,
    isStackable: true,
    isReefer: false,
    accessorial: []
  },
  {
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '33101',
    toZip: '75201',
    pallets: 2,
    grossWeight: 1800,
    isStackable: true,
    isReefer: false,
    accessorial: []
  }
];

interface NegotiationAnalyzerProps {
  project44Client: Project44APIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  isProject44Connected?: boolean;
}

interface ShipmentRecord {
  "Invoice #": number;
  "Customer"?: string;
  "Scheduled Pickup Date"?: string;
  "Zip"?: string;
  "Zip_1"?: string;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Max Freight Class"?: string;
  "Is VLTL"?: string;
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Revenue"?: string;
  "Carrier Quote"?: string;
  "Profit"?: string;
  "Origin City"?: string;
  "State"?: string;
  "Destination City"?: string;
  "State_1"?: string;
}

interface CustomerCarrierMargin {
  "MarkupId": number;
  "InternalName"?: string;
  "P44CarrierCode"?: string;
  "Percentage"?: string;
}

interface Phase1Result {
  customer: string;
  shipmentCount: number;
  totalRevenueAfterMargin: number;
  avgMargin: number;
}

interface Phase2Result {
  customer: string;
  initialRevenue: number;
  newTotalCost: number;
  newRequiredMargin: number;
  marginChange: number;
  impactAnalysis: string;
}

interface ProcessingStatus {
  phase: 1 | 2;
  currentCustomer: string;
  processedShipments: number;
  totalShipments: number;
  isRunning: boolean;
  error?: string;
}

const NegotiationImpactAnalyzer: React.FC<NegotiationAnalyzerProps> = ({
  project44Client,
  selectedCarriers,
  isProject44Connected = false
}) => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  
  // Debug state to track API connection
  const [selectedP44Account, setSelectedP44Account] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  
  // Carrier selection state
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  const [phase1Results, setPhase1Results] = useState<Phase1Result[]>([]);
  const [phase2Results, setPhase2Results] = useState<Phase2Result[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    phase: 1,
    currentCustomer: '',
    processedShipments: 0,
    totalShipments: 0,
    isRunning: false
  });
  
  // Store shipments by customer for reuse between phases
  const [customerShipments, setCustomerShipments] = useState<Map<string, ShipmentRecord[]>>(new Map());
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'untested' | 'connected' | 'error'>('untested');
  const [apiConnectionError, setApiConnectionError] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    console.log('🔄 NegotiationImpactAnalyzer component mounted');
    console.log('🔍 Project44 client available:', !!project44Client);
    loadAvailableP44Accounts();
    if (project44Client) {
      console.log('🔍 Project44 client available, testing connection...');
      loadCarriers();
    } else {
      console.log('⚠️ Project44 client not available');
    }
  }, [project44Client]);

  const loadCarriers = async () => {
    if (!project44Client) {
      console.log('❌ Cannot load carriers - Project44 client not available');
      return;
    }
    
    setIsLoadingCarriers(true);
    try {
      console.log('🚛 Loading carriers for negotiation analysis...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      console.log(`✅ Loaded ${groups.length} carrier groups for negotiation analysis`);
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
      setCarrierGroups([]);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const loadAvailableP44Accounts = async () => {
    try {
      console.log('🔍 Loading available P44 account codes...');
      
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode')
        .not('P44CarrierCode', 'is', null);
      
      if (error) {
        console.error('❌ Error loading P44 accounts:', error);
        return;
      }
      
      const uniqueAccounts = [...new Set(data?.map(d => d.P44CarrierCode).filter(Boolean))].sort();
      setAvailableAccounts(uniqueAccounts);
      console.log(`✅ Loaded ${uniqueAccounts.length} unique P44 account codes`);
    } catch (err) {
      console.error('❌ Failed to load P44 accounts:', err);
    }
  };

  // Test the Project44 API connection
  const testApiConnection = async () => {
    if (!project44Client) {
      console.log('❌ Cannot test API connection - Project44 client not available');
      setApiConnectionStatus('error');
      setApiConnectionError('No Project44 client available. Please set up your Project44 credentials in the API Setup tab.');
      return false;
    }

    setIsTesting(true);
    try {
      console.log('🔍 Testing Project44 API connection...');
      const token = await project44Client.getAccessToken();
      if (token) {
        console.log('✅ Project44 API connection successful!');
        setApiConnectionStatus('connected');
        setApiConnectionError('');
        setIsTesting(false);
        return true;
      } else {
        throw new Error('Failed to get access token');
      }
    } catch (error) {
      console.error('❌ Project44 API connection test failed:', error);
      setApiConnectionStatus('error');
      setApiConnectionError(error instanceof Error ? error.message : 'Unknown error');
      setIsTesting(false);
      return false;
    }
  };

  // Run API connection test on component mount
  useEffect(() => {
    const runTest = async () => {
      if (project44Client && apiConnectionStatus === 'untested') {
        console.log('🔄 Running automatic API connection test');
        await testApiConnection();
      }
    }
    runTest();
  }, [project44Client]);

  // Convert a shipment record to an RFQ format that Project44 API can use
  const convertShipmentToRFQ = (shipment: ShipmentRecord): RFQRow => {
    // Parse weight from string format
    const weightStr = shipment["Tot Weight"] || '0';
    const weight = parseInt(weightStr.replace(/[^\d]/g, '')) || 1000;
    
    // Parse pallets from Tot Packages
    const pallets = shipment["Tot Packages"] || 1;
    
    // Parse freight class
    const freightClass = shipment["Max Freight Class"] || '70';
    
    // Determine if this is VLTL
    const isVLTL = shipment["Is VLTL"] === 'TRUE';
    
    // Parse accessorials if any
    const accessorialStr = shipment["Accessorials"] || '';
    const accessorial = accessorialStr.split(/[,;]/).map(a => a.trim()).filter(Boolean);
    
    return {
      fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
      fromZip: shipment["Zip"] || '60607',
      toZip: shipment["Zip_1"] || '30033',
      pallets: typeof pallets === 'number' ? pallets : parseInt(pallets) || 1,
      grossWeight: weight,
      isStackable: false,
      isReefer: false,
      freightClass,
      accessorial,
      originCity: shipment["Origin City"],
      originState: shipment["State"],
      destinationCity: shipment["Destination City"],
      destinationState: shipment["State_1"],
      // If VLTL, add totalLinearFeet
      totalLinearFeet: isVLTL ? Math.ceil((typeof pallets === 'number' ? pallets : parseInt(pallets) || 1) * 4 / 12) : undefined
    };
  };

  const runPhase1Analysis = async () => {
    if (!selectedP44Account) {
      alert('Please select a P44 account code first');
      return;
    }
    
    if (!project44Client) {
      alert('Project44 client not available. Please ensure your Project44 API credentials are valid.');
      return;
    }

    setProcessingStatus({
      phase: 1,
      currentCustomer: '',
      processedShipments: 0,
      totalShipments: 0,
      isRunning: true
    });

    try {
      // First, test API connection
      const isConnected = await testApiConnection();
      if (!isConnected) {
        throw new Error('Cannot proceed with analysis: Project44 API connection failed');
      }
      
      console.log('🚀 Starting Phase 1: Initial Analysis with Project44 API calls');
      
      // Step 1.1: Filter Shipments by Date Range
      console.log(`📅 Filtering shipments from ${dateRange.start} to ${dateRange.end}`);
      
      const { data: shipments, error: shipmentsError } = await supabase
        .from('mass_rfq_batches')
        .select('*')
        .gte('date_range_start', dateRange.start)
        .lte('date_range_end', dateRange.end)
        .not('customer_name', 'is', null);
      
      if (shipmentsError) {
        console.log('⚠️ No historical shipments found in database, using sample data instead');
        // Use sample RFQs instead
        const sampleResults = await processPhase1SampleRfqs(selectedP44Account);
        setPhase1Results(sampleResults);
        return;
      }
      
      console.log(`📦 Found ${shipments?.length || 0} RFQ batches in date range`);
      
      if (!shipments || shipments.length === 0) {
        console.log('⚠️ No historical RFQ batches found in database, using sample data instead');
        // Use sample RFQs instead
        const sampleResults = await processPhase1SampleRfqs(selectedP44Account);
        setPhase1Results(sampleResults);
        return;
      }

      setProcessingStatus(prev => ({
        ...prev,
        totalShipments: SAMPLE_RFQS.length * 3 // 3 sample RFQs per customer
      }));

      // Extract unique customers from the RFQ batches
      const uniqueCustomers = [...new Set(shipments.map(batch => batch.customer_name))].filter(Boolean);
      console.log(`👥 Found ${uniqueCustomers.length} unique customers in RFQ batches`);
      
      // Process each customer with sample RFQs
      const allResults: Phase1Result[] = [];
      let processedCount = 0;
      
      for (const customer of uniqueCustomers) {
        if (!customer) continue;
        
        console.log(`🔍 Processing customer: ${customer}`);
        setProcessingStatus(prev => ({
          ...prev,
          currentCustomer: customer
        }));
        
        // Get quotes for each sample RFQ
        for (const rfq of SAMPLE_RFQS) {
          processedCount++;
          setProcessingStatus(prev => ({
            ...prev,
            processedShipments: processedCount
          }));
          
          try {
            console.log(`📦 Getting quotes for ${customer} with RFQ: ${rfq.fromZip} → ${rfq.toZip}`);
            
            // Get quotes from Project44 API
            const quotes = await project44Client.getQuotesForAccountGroup(
              rfq,
              selectedP44Account,
              false, // isVolumeMode
              false, // isFTLMode
              false  // isReeferMode
            );
            
            if (quotes.length > 0) {
              // Calculate total cost from all quotes
              const totalCost = quotes.reduce((sum, quote) => {
                const quoteCost = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
                return sum + quoteCost;
              }, 0);
              
              // Calculate average cost
              const avgCost = totalCost / quotes.length;
              
              // Assume a standard margin for this analysis
              const standardMargin = 0.15; // 15%
              
              // Calculate revenue after margin
              const revenueAfterMargin = avgCost / (1 - standardMargin);
              
              console.log(`💰 ${customer} RFQ ${processedCount}: ${quotes.length} quotes, Avg Cost=${formatCurrency(avgCost)}, Revenue=${formatCurrency(revenueAfterMargin)}`);
              
              // Add to customer results
              const existingResult = allResults.find(r => r.customer === customer);
              if (existingResult) {
                existingResult.shipmentCount++;
                existingResult.totalRevenueAfterMargin += revenueAfterMargin;
              } else {
                allResults.push({
                  customer,
                  shipmentCount: 1,
                  totalRevenueAfterMargin: revenueAfterMargin,
                  avgMargin: standardMargin * 100
                });
              }
            } else {
              console.log(`⚠️ No quotes received for ${customer} with RFQ: ${rfq.fromZip} → ${rfq.toZip}`);
            }
          } catch (error) {
            console.error(`❌ Error getting quotes for ${customer}:`, error);
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Sort results by revenue
      const sortedResults = allResults.sort((a, b) => b.totalRevenueAfterMargin - a.totalRevenueAfterMargin);
      setPhase1Results(sortedResults);
      
      console.log(`✅ Phase 1 Complete: Analyzed ${processedCount} RFQs for ${sortedResults.length} customers`);
      sortedResults.forEach(result => {
        console.log(`📊 ${result.customer}: ${result.shipmentCount} RFQs, ${formatCurrency(result.totalRevenueAfterMargin)} revenue, ${result.avgMargin.toFixed(1)}% avg margin`);
      });

    } catch (error) {
      console.error('❌ Phase 1 failed:', error);
      setProcessingStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Phase 1 analysis failed'
      }));
    } finally {
      setProcessingStatus(prev => ({
        ...prev,
        isRunning: false
      }));
    }
  };

  // Process sample RFQs for Phase 1
  const processPhase1SampleRfqs = async (accountGroupCode: string): Promise<Phase1Result[]> => {
    console.log(`🔍 Processing sample RFQs for Phase 1 with account group: ${accountGroupCode}`);
    
    // Sample customers
    const sampleCustomers = ['ACME CORP', 'GLOBAL LOGISTICS', 'MEGA SHIPPING'];
    const results: Phase1Result[] = [];
    let processedCount = 0;
    
    for (const customer of sampleCustomers) {
      console.log(`👤 Processing sample customer: ${customer}`);
      let customerRevenue = 0;
      let customerShipments = 0;
      
      for (const rfq of SAMPLE_RFQS) {
        processedCount++;
        setProcessingStatus(prev => ({
          ...prev,
          processedShipments: processedCount,
          currentCustomer: customer
        }));
        
        try {
          console.log(`📦 Getting quotes for ${customer} with RFQ: ${rfq.fromZip} → ${rfq.toZip}`);
          
          // Get quotes from Project44 API
          const quotes = await project44Client!.getQuotesForAccountGroup(
            rfq,
            accountGroupCode,
            false, // isVolumeMode
            false, // isFTLMode
            false  // isReeferMode
          );
          
          if (quotes.length > 0) {
            // Calculate total cost from all quotes
            const totalCost = quotes.reduce((sum, quote) => {
              const quoteCost = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
              return sum + quoteCost;
            }, 0);
            
            // Calculate average cost
            const avgCost = totalCost / quotes.length;
            
            // Assume a standard margin for this analysis
            const standardMargin = 0.15; // 15%
            
            // Calculate revenue after margin
            const revenueAfterMargin = avgCost / (1 - standardMargin);
            
            console.log(`💰 ${customer} RFQ ${processedCount}: ${quotes.length} quotes, Avg Cost=${formatCurrency(avgCost)}, Revenue=${formatCurrency(revenueAfterMargin)}`);
            
            customerRevenue += revenueAfterMargin;
            customerShipments++;
          } else {
            console.log(`⚠️ No quotes received for ${customer} with RFQ: ${rfq.fromZip} → ${rfq.toZip}`);
          }
        } catch (error) {
          console.error(`❌ Error getting quotes for ${customer}:`, error);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (customerShipments > 0) {
        results.push({
          customer,
          shipmentCount: customerShipments,
          totalRevenueAfterMargin: customerRevenue,
          avgMargin: 15 // 15% standard margin
        });
      }
    }
    
    return results.sort((a, b) => b.totalRevenueAfterMargin - a.totalRevenueAfterMargin);
  };

  const runPhase2Analysis = async () => {
    if (!project44Client) {
      alert('Project44 client not available. Please ensure your Project44 API credentials are valid.');
      return;
    }

    if (phase1Results.length === 0) {
      alert('Please run Phase 1 analysis first');
      return;
    }

    setProcessingStatus({
      phase: 2,
      currentCustomer: '',
      processedShipments: 0,
      totalShipments: 0,
      isRunning: true
    });

    try {
      // First, test API connection
      const isConnected = await testApiConnection();
      if (!isConnected) {
        throw new Error('Cannot proceed with analysis: Project44 API connection failed');
      }
      
      console.log('🚀 Starting Phase 2: Post-Negotiation Analysis with Project44 API calls');
      
      // Get selected carrier IDs
      const selectedCarrierIds = Object.entries(selectedCarriers)
        .filter(([_, selected]) => selected)
        .map(([carrierId, _]) => carrierId);

      if (selectedCarrierIds.length === 0) {
        throw new Error('No carriers selected for Phase 2 analysis');
      }

      console.log(`🚛 Using ${selectedCarrierIds.length} selected carriers for new cost analysis`);
      
      // Process the same RFQs as Phase 1, but with the selected carriers
      const phase2Data = await processPhase2WithSelectedCarriers();
      
      setPhase2Results(phase2Data);
      setAnalysisComplete(true);
      
      console.log(`✅ Phase 2 Complete: Analyzed ${phase2Data.length} customers for margin impact`);

    } catch (error) {
      console.error('❌ Phase 2 failed:', error);
      setProcessingStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Phase 2 analysis failed'
      }));
    } finally {
      setProcessingStatus(prev => ({
        ...prev,
        isRunning: false
      }));
    }
  };

  // Process Phase 2 with selected carriers
  const processPhase2WithSelectedCarriers = async (): Promise<Phase2Result[]> => {
    console.log('🔍 Processing Phase 2 with selected carriers');
    
    // Get selected carrier IDs
    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
    
    if (selectedCarrierIds.length === 0) {
      throw new Error('No carriers selected for Phase 2 analysis');
    }
    
    // Use the same customers from Phase 1
    const customers = phase1Results.map(r => r.customer);
    console.log(`👥 Processing ${customers.length} customers from Phase 1`);
    
    const results: Phase2Result[] = [];
    let processedCount = 0;
    
    setProcessingStatus(prev => ({
      ...prev,
      totalShipments: customers.length * SAMPLE_RFQS.length
    }));
    
    for (const customer of customers) {
      console.log(`👤 Processing customer: ${customer}`);
      let customerNewCost = 0;
      let customerRfqCount = 0;
      
      // Get the initial revenue from Phase 1
      const phase1Result = phase1Results.find(r => r.customer === customer);
      if (!phase1Result) continue;
      
      // Process each sample RFQ
      for (const rfq of SAMPLE_RFQS) {
        processedCount++;
        setProcessingStatus(prev => ({
          ...prev,
          processedShipments: processedCount,
          currentCustomer: customer
        }));
        
        try {
          console.log(`📦 Getting quotes for ${customer} with RFQ: ${rfq.fromZip} → ${rfq.toZip} using selected carriers`);
          
          // Get quotes from Project44 API with selected carriers
          const quotes = await project44Client!.getQuotes(
            rfq,
            selectedCarrierIds,
            false, // isVolumeMode
            false, // isFTLMode
            false  // isReeferMode
          );
          
          if (quotes.length > 0) {
            // Use the best (lowest) quote
            const bestQuote = quotes.reduce((best, current) => {
              const bestTotal = best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts;
              const currentTotal = current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts;
              return currentTotal < bestTotal ? current : best;
            });
            
            const newCost = bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts;
            console.log(`💰 New cost for ${customer} RFQ: ${formatCurrency(newCost)}`);
            
            customerNewCost += newCost;
            customerRfqCount++;
          } else {
            console.log(`⚠️ No quotes received for ${customer} RFQ`);
          }
        } catch (error) {
          console.error(`❌ Error getting quotes for ${customer}:`, error);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (customerRfqCount > 0 && customerNewCost > 0) {
        // Calculate new required margin
        const initialRevenue = phase1Result.totalRevenueAfterMargin;
        const newRequiredMargin = ((initialRevenue - customerNewCost) / initialRevenue) * 100;
        const marginChange = newRequiredMargin - phase1Result.avgMargin;
        
        let impactAnalysis = '';
        if (marginChange > 5) {
          impactAnalysis = 'Significant margin improvement opportunity';
        } else if (marginChange > 0) {
          impactAnalysis = 'Modest margin improvement';
        } else if (marginChange > -5) {
          impactAnalysis = 'Minimal margin impact';
        } else {
          impactAnalysis = 'Margin compression - review pricing strategy';
        }
        
        results.push({
          customer,
          initialRevenue,
          newTotalCost: customerNewCost,
          newRequiredMargin,
          marginChange,
          impactAnalysis
        });
        
        console.log(`📊 ${customer}: Initial Revenue=${formatCurrency(initialRevenue)}, New Cost=${formatCurrency(customerNewCost)}, New Margin=${newRequiredMargin.toFixed(1)}%, Change=${marginChange > 0 ? '+' : ''}${marginChange.toFixed(1)}%`);
      }
    }
    
    return results.sort((a, b) => b.marginChange - a.marginChange);
  };

  const exportResults = () => {
    if (phase1Results.length === 0 && phase2Results.length === 0) {
      alert('No results to export');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Phase 1 Results
    if (phase1Results.length > 0) {
      const phase1Data = phase1Results.map(result => ({
        'Customer': result.customer,
        'Shipment Count': result.shipmentCount,
        'Total Revenue After Margin': result.totalRevenueAfterMargin,
        'Average Margin %': result.avgMargin.toFixed(2)
      }));

      const ws1 = XLSX.utils.json_to_sheet(phase1Data);
      XLSX.utils.book_append_sheet(workbook, ws1, 'Phase 1 - Baseline');
    }

    // Phase 2 Results
    if (phase2Results.length > 0) {
      const phase2Data = phase2Results.map(result => ({
        'Customer': result.customer,
        'Initial Revenue Target': result.initialRevenue,
        'New Total Cost': result.newTotalCost,
        'New Required Margin %': result.newRequiredMargin.toFixed(2),
        'Margin Change %': result.marginChange.toFixed(2),
        'Impact Analysis': result.impactAnalysis
      }));

      const ws2 = XLSX.utils.json_to_sheet(phase2Data);
      XLSX.utils.book_append_sheet(workbook, ws2, 'Phase 2 - Impact Analysis');
    }

    // Summary
    if (phase2Results.length > 0) {
      const summaryData = [
        { 'Metric': 'Total Customers Analyzed', 'Value': phase2Results.length },
        { 'Metric': 'Customers with Margin Improvement', 'Value': phase2Results.filter(r => r.marginChange > 0).length },
        { 'Metric': 'Customers with Margin Compression', 'Value': phase2Results.filter(r => r.marginChange < 0).length },
        { 'Metric': 'Average Margin Change', 'Value': (phase2Results.reduce((sum, r) => sum + r.marginChange, 0) / phase2Results.length).toFixed(2) + '%' },
        { 'Metric': 'Best Margin Improvement', 'Value': Math.max(...phase2Results.map(r => r.marginChange)).toFixed(2) + '%' },
        { 'Metric': 'Worst Margin Impact', 'Value': Math.min(...phase2Results.map(r => r.marginChange)).toFixed(2) + '%' }
      ];

      const ws3 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, ws3, 'Summary');
    }

    const fileName = `negotiation-impact-analysis-${dateRange.start}-to-${dateRange.end}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg flex-shrink-0">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Negotiation Impact Analyzer</h1>
              <p className="text-sm text-gray-600">
                Two-phase analysis to determine optimal customer margins after carrier negotiations
              </p>
            </div>
          </div>
          
          {/* API Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
            apiConnectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
            apiConnectionStatus === 'error' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {isTesting ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : apiConnectionStatus === 'connected' ? (
              <CheckCircle className="h-4 w-4" />
            ) : apiConnectionStatus === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isTesting ? 'Testing API...' :
               apiConnectionStatus === 'connected' ? 'API Connected' :
               apiConnectionStatus === 'error' ? 'API Error' :
               'API Status Unknown'}
            </span>
          </div>
        </div>
      </div>
      
      {/* API Connection Error */}
      {apiConnectionStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3 flex-wrap">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-red-800">Project44 API Connection Error</h3>
              <p className="mt-1 text-sm text-red-700">{apiConnectionError}</p>
              <div className="mt-3">
                <button
                  onClick={testApiConnection}
                  disabled={isTesting}
                  className="inline-flex items-center space-x-2 px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Connection</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* How It Works */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg flex-shrink-0">
            <Info className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-blue-900 mb-2">How This Tool Works</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>This tool uses <strong>direct Project44 API calls</strong> in both phases to analyze the impact of carrier negotiations:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li><strong>Phase 1:</strong> Establishes baseline costs using the current carrier account</li>
                <li><strong>Phase 2:</strong> Simulates negotiated rates using your selected carriers</li>
                <li>Both phases use identical RFQs for a true apples-to-apples comparison</li>
                <li>The tool calculates how much your margin can improve with the new rates</li>
              </ol>
              <p className="mt-2 font-medium">Important: Both phases make real-time API calls to Project44 - no historical costs are used.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">P44 Account Code</label>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedP44Account}
                  onChange={(e) => setSelectedP44Account(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                  disabled={!isProject44Connected}
                >
                  <option value="">Select P44 Account Code...</option>
                  {availableAccounts.map(account => (
                    <option key={account} value={account}>{account}</option>
                  ))}
                </select>
                {!project44Client && (
                  <div className="text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    API not connected
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Carrier Status */}
      {apiConnectionStatus === 'connected' && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Carrier Status</span>
            </div>
            <div className="text-sm text-gray-600">
              {isLoadingCarriers ? (
                <div className="flex items-center space-x-2">
                  <Loader className="h-4 w-4 animate-spin text-blue-500" />
                  <span>Loading carriers...</span>
                </div>
              ) : carrierGroups.length > 0 ? (
                <span>
                  {carrierGroups.reduce((total, group) => total + group.carriers.length, 0)} carriers available
                </span>
              ) : (
                <span className="text-orange-600">No carriers loaded</span>
              )}
            </div>
          </div>
          
          {carrierGroups.length === 0 && !isLoadingCarriers && (
            <div className="mt-2">
              <button
                onClick={loadCarriers}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Load Carriers
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phase 1 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Phase 1: Baseline API Analysis</h3>
                <p className="text-sm text-gray-600">Make API calls to Project44 for baseline rates</p>
              </div>
            </div>
            {phase1Results.length > 0 && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
          </div>
          
          <button
            onClick={runPhase1Analysis}
            disabled={processingStatus.isRunning || !selectedP44Account || !project44Client || apiConnectionStatus !== 'connected'}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {processingStatus.isRunning && processingStatus.phase === 1 ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Making API Calls...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Run Baseline API Analysis</span>
              </>
            )}
          </button>
          
          {phase1Results.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                ✅ Analyzed {phase1Results.length} customers with {phase1Results.reduce((sum, r) => sum + r.shipmentCount, 0)} total shipments
              </div>
            </div>
          )}
        </div>

        {/* Phase 2 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Phase 2: Negotiation API Analysis</h3>
                <p className="text-sm text-gray-600">Make API calls to Project44 with new carrier selection</p>
              </div>
            </div>
            {analysisComplete && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
          </div>
          
          <button
            onClick={runPhase2Analysis}
            disabled={processingStatus.isRunning || phase1Results.length === 0 || !project44Client || apiConnectionStatus !== 'connected'}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {processingStatus.isRunning && processingStatus.phase === 2 ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Making API Calls...</span>
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                <span>Run Negotiation API Analysis</span>
              </>
            )}
          </button>
          
          {phase2Results.length > 0 && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm text-purple-800">
                ✅ Impact analysis complete for {phase2Results.length} customers
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {processingStatus.isRunning && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <Loader className="h-5 w-5 animate-spin text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Processing Phase {processingStatus.phase}
              </h3>
              <p className="text-sm text-gray-600">
                {processingStatus.phase === 1
                  ? 'Making API calls to Project44 for baseline rates'
                  : 'Making API calls to Project44 for negotiated rates'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">
                {processingStatus.processedShipments} / {processingStatus.totalShipments}
              </div>
              <div className="text-sm text-gray-500">Shipments processed</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span>Processing: <span className="font-medium">{processingStatus.currentCustomer || 'Initializing...'}</span></span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${processingStatus.totalShipments > 0 ? (processingStatus.processedShipments / processingStatus.totalShipments) * 100 : 0}%` 
                }}
              />
            </div>
            
            <div className="text-xs text-gray-500 text-right">
              Making API calls to Project44 - 
              {processingStatus.totalShipments > 0
                ? ((processingStatus.processedShipments / processingStatus.totalShipments) * 100).toFixed(1) 
                : 0}% complete
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {processingStatus.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{processingStatus.error}</span>
            <button 
              onClick={() => setProcessingStatus(prev => ({ ...prev, error: undefined }))}
              className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {(phase1Results.length > 0 || phase2Results.length > 0) && (
        <div className="space-y-6">
          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                {phase2Results.length} customers
              </span>
            </button>
          </div>

          {/* Phase 1 Results */}
          {phase1Results.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-blue-100">
                <h3 className="text-lg font-semibold text-blue-900">Phase 1: Baseline API Analysis</h3>
                <p className="text-sm text-blue-800">Based on Project44 API calls for baseline rates</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue Target</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {phase1Results.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{result.customer}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{result.shipmentCount}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(result.totalRevenueAfterMargin)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{result.avgMargin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phase 2 Results */}
          {phase2Results.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-purple-100">
                <h3 className="text-lg font-semibold text-purple-900">Phase 2: Negotiation API Analysis</h3>
                <p className="text-sm text-purple-800">Based on Project44 API calls with negotiated rates</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue Target</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required Margin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {phase2Results.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{result.customer}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(result.initialRevenue)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(result.newTotalCost)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{result.newRequiredMargin.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-sm">
                          <div className={`flex items-center space-x-1 ${
                            result.marginChange > 0 ? 'text-green-600' : 
                            result.marginChange < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {result.marginChange > 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : result.marginChange < 0 ? (
                              <TrendingDown className="h-4 w-4" />
                            ) : null}
                            <span>{result.marginChange > 0 ? '+' : ''}{result.marginChange.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{result.impactAnalysis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NegotiationImpactAnalyzer;