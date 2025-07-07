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
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQRow } from '../types';
import * as XLSX from 'xlsx';

interface NegotiationAnalyzerProps {
  project44Client: Project44APIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
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

export const NegotiationImpactAnalyzer: React.FC<NegotiationAnalyzerProps> = ({
  project44Client,
  selectedCarriers
}) => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  
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
  
  // Track shipments for reuse between phases
  const [analyzedShipments, setAnalyzedShipments] = useState<ShipmentRecord[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    loadAvailableP44Accounts();
    if (project44Client) {
      loadCarriers();
    }
  }, []);

  const loadCarriers = async () => {
    if (!project44Client) return;
    
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
      console.log('🚀 Starting Phase 1: Initial Analysis (Pre-Negotiation Baseline)');
      
      // Step 1.1: Filter Shipments by Date Range
      console.log(`📅 Filtering shipments from ${dateRange.start} to ${dateRange.end}`);
      
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .not('"Customer"', 'is', null);
      
      if (shipmentsError) {
        throw new Error(`Failed to load shipments: ${shipmentsError.message}`);
      }
      
      console.log(`📦 Found ${shipments?.length || 0} shipments in date range`);
      
      if (!shipments || shipments.length === 0) {
        throw new Error('No shipments found in the selected date range');
      }
      
      // Store shipments for reuse in Phase 2
      setAnalyzedShipments(shipments);

      setProcessingStatus(prev => ({
        ...prev,
        totalShipments: shipments.length
      }));

      // Load all customer-carrier margins for the selected P44 account
      console.log(`🔍 Loading customer margins for P44 account: ${selectedP44Account}`);
      
      const { data: margins, error: marginsError } = await supabase
        .from('CustomerCarriers')
        .select('*')
        .eq('P44CarrierCode', selectedP44Account.trim().toUpperCase());
      
      if (marginsError) {
        throw new Error(`Failed to load customer margins: ${marginsError.message}`);
      }
      
      console.log(`💰 Found ${margins?.length || 0} customer margins for account ${selectedP44Account}`);

      // Create a lookup map for customer margins
      const marginLookup = new Map<string, { percentage: number, customerName: string }>();
      margins?.forEach(margin => {
        if (margin.InternalName && margin.Percentage) {
          const customerKey = margin.InternalName.trim().toUpperCase();
          const percentage = parseFloat(margin.Percentage) / 100; // Convert to decimal
          marginLookup.set(customerKey, { 
            percentage, 
            customerName: margin.InternalName 
          });
          console.log(`📋 Margin for ${margin.InternalName}: ${(percentage * 100).toFixed(1)}% (key: ${customerKey})`);
        }
      });

      // Step 1.2 & 1.3: Calculate Revenue After Margin per Customer
      const customerResults = new Map<string, {
        shipmentCount: number;
        totalRevenueAfterMargin: number;
        totalMargin: number;
        marginCount: number;
        shipments: ShipmentRecord[];
      }>();

      let processedCount = 0;
      
      for (const shipment of shipments) {
        processedCount++;
        
        setProcessingStatus(prev => ({
          ...prev,
          processedShipments: processedCount,
          currentCustomer: shipment.Customer || 'Unknown'
        }));

        const customerName = shipment.Customer?.trim();
        if (!customerName) {
          console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - no customer name`);
          continue;
        }

        const customerKey = customerName.toUpperCase();
        console.log(`🔍 Looking up margin for customer key: ${customerKey}`);
        
        // Look up customer margin
        const marginInfo = marginLookup.get(customerKey);
        if (!marginInfo) {
          console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - no margin found for customer: ${customerName}`);
          continue;
        }
        
        const customerMargin = marginInfo.percentage;

        // Get the cost (carrier quote)
        const carrierQuote = parseFloat(shipment["Carrier Quote"] || '0');
        if (carrierQuote <= 0) {
          console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - invalid carrier quote: ${carrierQuote}`);
          continue;
        }

        // Calculate revenue after margin: cost / (1 - margin)
        const revenueAfterMargin = carrierQuote / (1 - customerMargin); 
        
        console.log(`💰 Shipment ${shipment["Invoice #"]}: Cost=${formatCurrency(carrierQuote)}, Margin=${(customerMargin * 100).toFixed(1)}%, Revenue=${formatCurrency(revenueAfterMargin)}`);

        // Aggregate by customer
        if (!customerResults.has(customerKey)) {
          customerResults.set(customerKey, {
            shipmentCount: 0,
            totalRevenueAfterMargin: 0,
            totalMargin: 0,
            marginCount: 0,
            shipments: []
          });
        }

        const customerData = customerResults.get(customerKey)!;
        customerData.shipmentCount++;
        customerData.totalRevenueAfterMargin += revenueAfterMargin;
        customerData.totalMargin += customerMargin;
        customerData.marginCount++;
        customerData.shipments.push(shipment);
      }

      // Step 1.4: Store Initial Results
      const phase1Data: Phase1Result[] = Array.from(customerResults.entries()).map(([customerKey, data]) => ({
        customer: customerKey,
        shipmentCount: data.shipmentCount,
        totalRevenueAfterMargin: Math.round(data.totalRevenueAfterMargin), // Round to nearest dollar
        avgMargin: (data.totalMargin / data.marginCount) * 100, // Convert back to percentage
        shipments: data.shipments // Store shipments for Phase 2
      })).sort((a, b) => b.totalRevenueAfterMargin - a.totalRevenueAfterMargin);

      setPhase1Results(phase1Data);
      
      console.log(`✅ Phase 1 Complete: Analyzed ${processedCount} shipments for ${phase1Data.length} customers`);
      phase1Data.forEach(result => {
        console.log(`📊 ${result.customer}: ${result.shipmentCount} shipments, ${formatCurrency(result.totalRevenueAfterMargin)} revenue, ${result.avgMargin.toFixed(1)}% avg margin`);
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
      console.log('🚀 Starting Phase 2: Post-Negotiation Analysis & Margin Determination');
      
      // Get selected carrier IDs from the UI
      let selectedCarrierIds = Object.entries(selectedCarriers)
        .filter(([_, selected]) => selected)
        .map(([carrierId, _]) => carrierId);

      if (selectedCarrierIds.length === 0) {
        // If no carriers are explicitly selected, use all available carriers from loaded groups
        if (carrierGroups.length > 0) {
          carrierGroups.forEach(group => {
            group.carriers.forEach(carrier => {
              selectedCarrierIds.push(carrier.id);
            });
          });
          console.log(`🚛 No carriers explicitly selected, using all ${selectedCarrierIds.length} available carriers`);
        } else {
          throw new Error('No carriers available for Phase 2 analysis');
        }
      }

      console.log(`🚛 Using ${selectedCarrierIds.length} selected carriers for new cost analysis`);

      // Step 2.1: Calculate Sum of Costs Before Margin PER CUSTOMER (Post-Negotiation)
      const customerNewCosts = new Map<string, number>();
      
      // Use the same shipments from Phase 1 for consistency
      const validShipments: ShipmentRecord[] = [];
      phase1Results.forEach(result => {
        if (result.shipments) {
          validShipments.push(...result.shipments);
        }
      });
      
      console.log(`✅ Filtered to ${validShipments.length} valid shipments for analysis`);

      setProcessingStatus(prev => ({
        ...prev,
        totalShipments: validShipments.length
      }));

      let processedCount = 0;

      for (const shipment of validShipments) {
        const customerName = shipment.Customer?.trim();
        if (!customerName) continue;

        const customerKey = customerName.toUpperCase();
        processedCount++;
        
        setProcessingStatus(prev => ({
          ...prev,
          processedShipments: processedCount,
          currentCustomer: customerName
        }));

        try {
          // Convert shipment to RFQ format
          const rfqData = convertShipmentToRFQ(shipment);
          
          // Validate RFQ data
          if (!rfqData.fromZip || !rfqData.toZip) {
            console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - missing ZIP codes`);
            continue;
          }
          
          if (!rfqData.grossWeight || rfqData.grossWeight <= 0) {
            console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - invalid weight: ${rfqData.grossWeight}`);
            continue;
          }

          console.log(`📞 Getting new quotes for shipment ${shipment["Invoice #"]} (${customerName})`);
          console.log(`📦 RFQ details: ${rfqData.fromZip} → ${rfqData.toZip}, ${rfqData.pallets} pallets, ${rfqData.grossWeight} lbs`);

          // Determine if this is VLTL
          const isVLTL = shipment["Is VLTL"] === "TRUE" || 
                        rfqData.pallets >= 10 || 
                        rfqData.grossWeight >= 15000;
          
          console.log(`🚚 Shipment ${shipment["Invoice #"]} is ${isVLTL ? 'VLTL' : 'Standard LTL'}`);
          
          // Get new quotes from Project44
          let quotes = [];
          try {
            console.log(`🔍 SENDING ACTUAL API REQUEST to Project44 for ${isVLTL ? 'VLTL' : 'Standard LTL'} shipment ${shipment["Invoice #"]} - Customer: ${customerName}`);
            
            // THIS IS THE ACTUAL API CALL TO PROJECT44
            quotes = await project44Client.getQuotes(
              rfqData, 
              selectedCarrierIds, 
              isVLTL, // isVolumeMode
              false,  // isFTLMode
              false   // isReeferMode
            );
            console.log(`✅ SUCCESS! Received ${quotes.length} quotes from Project44 API for shipment ${shipment["Invoice #"]}`);
          } catch (quoteError) {
            console.error(`❌ API ERROR: Failed to get quotes for shipment ${shipment["Invoice #"]}:`, quoteError);
            console.log(`🔄 Continuing with next shipment...`);
            continue;
          }

          if (quotes.length > 0) {
            // Use the best (lowest) quote
            const bestQuote = quotes.reduce((best, current) => {
              const bestTotal = best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts;
              const currentTotal = current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts;
              
              // Ensure we're comparing valid numbers
              if (isNaN(bestTotal) || bestTotal <= 0) return current;
              if (isNaN(currentTotal) || currentTotal <= 0) return best;
              
              // Return the lower cost quote
              return currentTotal < bestTotal ? current : best;
            });

            const newCost = bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts;
            if (newCost <= 0) {
              console.log(`⚠️ Invalid cost (${newCost}) for shipment ${shipment["Invoice #"]}, skipping`);
              continue;
            }
            
            console.log(`💰 New cost for ${customerName} shipment ${shipment["Invoice #"]}: ${formatCurrency(newCost)} from carrier ${bestQuote.carrier.name} (${bestQuote.carrierCode || 'unknown code'})`);

            // Add to customer total
            if (!customerNewCosts.has(customerKey)) {
              customerNewCosts.set(customerKey, 0);
            }
            customerNewCosts.set(customerKey, customerNewCosts.get(customerKey)! + newCost);
          } else {
            console.log(`⚠️ No quotes received from Project44 API for shipment ${shipment["Invoice #"]}`);
          }

        } catch (error) {
          console.error(`❌ Failed to get quotes for shipment ${shipment["Invoice #"]}:`, error);
        }

        // Use a longer delay (1 second) to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 2.2: Determine New Required Margin PER CUSTOMER
      const phase2Data: Phase2Result[] = [];

      for (const phase1Result of phase1Results) {
        const customerKey = phase1Result.customer;
        const initialRevenue = phase1Result.totalRevenueAfterMargin;
        const newTotalCost = customerNewCosts.get(customerKey) || 0;
        
        console.log(`📊 Analyzing customer ${customerKey}: Initial revenue=${formatCurrency(initialRevenue)}, New cost=${formatCurrency(newTotalCost)}`);

        if (newTotalCost > 0 && initialRevenue > 0) {
          // Calculate new required margin: ((revenue goal) - (new cost)) / (revenue goal)
          const newRequiredMargin = ((initialRevenue - newTotalCost) / initialRevenue) * 100;
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

          phase2Data.push({
            customer: customerKey,
            initialRevenue,
            newTotalCost,
            newRequiredMargin,
            marginChange,
            impactAnalysis
          });

          console.log(`📊 ${customerKey}: Initial Revenue=${formatCurrency(initialRevenue)}, New Cost=${formatCurrency(newTotalCost)}, New Margin=${newRequiredMargin.toFixed(1)}%, Change=${marginChange > 0 ? '+' : ''}${marginChange.toFixed(1)}%`);
        }
      }

      setPhase2Results(phase2Data.sort((a, b) => b.marginChange - a.marginChange));
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
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Negotiation Impact Analyzer</h1>
            <p className="text-sm text-gray-600">
              Two-phase analysis to determine optimal customer margins after carrier negotiations
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Configuration</h3>
          {project44Client ? (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Project44 API Ready</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Project44 API Not Connected</span>
            </div>
          )}
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
            <select
              value={selectedP44Account}
              onChange={(e) => {
                setSelectedP44Account(e.target.value);
                // Reset results when account changes
                setPhase1Results([]);
                setPhase2Results([]);
                setAnalysisComplete(false);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select P44 Account...</option>
              {availableAccounts.map(account => (
                <option key={account} value={account}>{account}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Carrier Status */}
      {project44Client && (
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

      {/* API Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">How This Tool Works (API Calls in Both Phases):</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Phase 1: Analyzes historical shipments and <strong>uses their actual carrier costs</strong> to establish revenue targets</li>
              <li>Phase 2: <strong>Sends new API requests to Project44</strong> for the same shipments to get current market rates</li>
              <li>Compares historical revenue targets with new API-sourced costs to determine optimal margins</li>
              <li>Both phases use the same shipments for true apples-to-apples comparison</li>
            </ol>
            <p className="mt-2 text-xs">Note: Phase 2 will make <strong>real API calls to Project44</strong> for each shipment and may take several minutes to complete.</p>
          </div>
        </div>
      </div>
      
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
                <h3 className="text-lg font-semibold text-gray-900">Phase 1: Historical Analysis</h3>
                <p className="text-sm text-gray-600">Calculate revenue targets from historical shipments</p>
              </div>
            </div>
            {phase1Results.length > 0 && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
          </div>
          
          <button
            onClick={runPhase1Analysis}
            disabled={processingStatus.isRunning || !selectedP44Account}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              processingStatus.isRunning || !selectedP44Account
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {processingStatus.isRunning && processingStatus.phase === 1 ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Calendar className="h-5 w-5" />
                <span>Analyze Historical Data</span>
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
                <h3 className="text-lg font-semibold text-gray-900">Phase 2: Current Market Analysis</h3>
                <p className="text-sm text-gray-600">Send same shipments to Project44 API for current rates</p>
              </div>
            </div>
            {analysisComplete && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
          </div>
          
          <button
            onClick={runPhase2Analysis}
            disabled={processingStatus.isRunning || phase1Results.length === 0 || !project44Client}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              processingStatus.isRunning || phase1Results.length === 0 || !project44Client
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {processingStatus.isRunning && processingStatus.phase === 2 ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                <span>Get Current Market Rates</span>
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
                  ? 'Analyzing historical shipments and calculating revenue targets'
                  : 'Sending API requests to Project44 for current market rates'}
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
              {processingStatus.phase === 1 ? 'Processing historical shipment data' : 'Sending API requests to Project44'} - 
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
              <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
                <h3 className="text-lg font-semibold text-blue-900">Phase 1: Historical Revenue Targets</h3>
                <p className="text-sm text-blue-700">Based on actual historical shipment costs and margins</p>
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
              <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
                <h3 className="text-lg font-semibold text-purple-900">Phase 2: Current Market Rate Analysis</h3>
                <p className="text-sm text-purple-700">Based on real-time Project44 API quotes for the same shipments</p>
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