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
  Truck
} from 'lucide-react';
import { Project44APIClient } from '../utils/apiClient';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
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
  
  const [phase1Results, setPhase1Results] = useState<Phase1Result[]>([]);
  const [phase2Results, setPhase2Results] = useState<Phase2Result[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    phase: 1,
    currentCustomer: '',
    processedShipments: 0,
    totalShipments: 0,
    isRunning: false
  });
  
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    loadAvailableP44Accounts();
  }, []);

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

  const runPhase1Analysis = async () => {
    if (!selectedP44Account) {
      alert('Please select a P44 account code first');
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
      const marginLookup = new Map<string, number>();
      margins?.forEach(margin => {
        if (margin.InternalName && margin.Percentage) {
          const customerKey = margin.InternalName.trim().toUpperCase();
          const percentage = parseFloat(margin.Percentage) / 100; // Convert to decimal
          marginLookup.set(customerKey, percentage);
          console.log(`📋 Margin for ${margin.InternalName}: ${(percentage * 100).toFixed(1)}%`);
        }
      });

      // Step 1.2 & 1.3: Calculate Revenue After Margin per Customer
      const customerResults = new Map<string, {
        shipmentCount: number;
        totalRevenueAfterMargin: number;
        totalMargin: number;
        marginCount: number;
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
        
        // Look up customer margin
        const customerMargin = marginLookup.get(customerKey);
        if (!customerMargin) {
          console.log(`⚠️ Skipping shipment ${shipment["Invoice #"]} - no margin found for customer: ${customerName}`);
          continue;
        }

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
            marginCount: 0
          });
        }

        const customerData = customerResults.get(customerKey)!;
        customerData.shipmentCount++;
        customerData.totalRevenueAfterMargin += revenueAfterMargin;
        customerData.totalMargin += customerMargin;
        customerData.marginCount++;
      }

      // Step 1.4: Store Initial Results
      const phase1Data: Phase1Result[] = Array.from(customerResults.entries()).map(([customerKey, data]) => ({
        customer: customerKey,
        shipmentCount: data.shipmentCount,
        totalRevenueAfterMargin: data.totalRevenueAfterMargin,
        avgMargin: (data.totalMargin / data.marginCount) * 100 // Convert back to percentage
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
      alert('Project44 client not available');
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
      
      // Get selected carrier IDs
      const selectedCarrierIds = Object.entries(selectedCarriers)
        .filter(([_, selected]) => selected)
        .map(([carrierId, _]) => carrierId);

      if (selectedCarrierIds.length === 0) {
        throw new Error('No carriers selected for Phase 2 analysis');
      }

      console.log(`🚛 Using ${selectedCarrierIds.length} selected carriers for new cost analysis`);

      // Step 2.1: Calculate Sum of Costs Before Margin PER CUSTOMER (Post-Negotiation)
      const customerNewCosts = new Map<string, number>();
      
      // Get all shipments from Phase 1 again
      const { data: shipments, error: shipmentsError } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .not('"Customer"', 'is', null);
      
      if (shipmentsError) {
        throw new Error(`Failed to reload shipments: ${shipmentsError.message}`);
      }

      // Filter to only customers from Phase 1
      const phase1Customers = new Set(phase1Results.map(r => r.customer));
      const validShipments = shipments?.filter(s => 
        s.Customer && phase1Customers.has(s.Customer.trim().toUpperCase())
      ) || [];

      setProcessingStatus(prev => ({
        ...prev,
        totalShipments: validShipments.length
      }));

      let processedCount = 0;

      for (const shipment of validShipments) {
        processedCount++;
        
        const customerName = shipment.Customer?.trim();
        if (!customerName) continue;

        const customerKey = customerName.toUpperCase();
        
        setProcessingStatus(prev => ({
          ...prev,
          processedShipments: processedCount,
          currentCustomer: customerName
        }));

        try {
          // Build RFQ from shipment data
          const rfqData = {
            fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
            fromZip: shipment["Zip"] || '60607',
            toZip: shipment["Zip_1"] || '30033',
            pallets: shipment["Tot Packages"] || 1,
            grossWeight: parseInt(shipment["Tot Weight"]?.replace(/[^\d]/g, '') || '1000'),
            isStackable: false,
            isReefer: false,
            accessorial: []
          };

          console.log(`📞 Getting new quotes for shipment ${shipment["Invoice #"]} (${customerName})`);

          // Determine if this is VLTL
          const isVLTL = shipment["Is VLTL"] === "TRUE" || rfqData.pallets >= 10 || rfqData.grossWeight >= 15000;
          
          // Get new quotes from Project44
          const quotes = await project44Client.getQuotes(
            rfqData, 
            selectedCarrierIds, 
            isVLTL, // isVolumeMode
            false,  // isFTLMode
            false   // isReeferMode
          );

          if (quotes.length > 0) {
            // Use the best (lowest) quote
            const bestQuote = quotes.reduce((best, current) => {
              const bestTotal = best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts;
              const currentTotal = current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts;
              return currentTotal < bestTotal ? current : best;
            });

            const newCost = bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts;
            
            console.log(`💰 New cost for ${customerName} shipment: ${formatCurrency(newCost)}`);

            // Add to customer total
            if (!customerNewCosts.has(customerKey)) {
              customerNewCosts.set(customerKey, 0);
            }
            customerNewCosts.set(customerKey, customerNewCosts.get(customerKey)! + newCost);
          } else {
            console.log(`⚠️ No quotes received for shipment ${shipment["Invoice #"]}`);
          }

        } catch (error) {
          console.error(`❌ Failed to get quotes for shipment ${shipment["Invoice #"]}:`, error);
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 2.2: Determine New Required Margin PER CUSTOMER
      const phase2Data: Phase2Result[] = [];

      for (const phase1Result of phase1Results) {
        const customerKey = phase1Result.customer;
        const initialRevenue = phase1Result.totalRevenueAfterMargin;
        const newTotalCost = customerNewCosts.get(customerKey) || 0;

        if (newTotalCost > 0) {
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">P44 Account Code</label>
            <select
              value={selectedP44Account}
              onChange={(e) => setSelectedP44Account(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select P44 Account...</option>
              {availableAccounts.map(account => (
                <option key={account} value={account}>{account}</option>
              ))}
            </select>
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
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Phase 1: Baseline Analysis</h3>
                <p className="text-sm text-gray-600">Calculate current revenue targets per customer</p>
              </div>
            </div>
            {phase1Results.length > 0 && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
          </div>
          
          <button
            onClick={runPhase1Analysis}
            disabled={processingStatus.isRunning || !selectedP44Account}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {processingStatus.isRunning && processingStatus.phase === 1 ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Run Phase 1</span>
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
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Phase 2: Impact Analysis</h3>
                <p className="text-sm text-gray-600">Calculate new required margins with current rates</p>
              </div>
            </div>
            {analysisComplete && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
          </div>
          
          <button
            onClick={runPhase2Analysis}
            disabled={processingStatus.isRunning || phase1Results.length === 0 || !project44Client}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {processingStatus.isRunning && processingStatus.phase === 2 ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Run Phase 2</span>
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
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="h-5 w-5 animate-spin text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Processing Phase {processingStatus.phase}
            </h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Current Customer: {processingStatus.currentCustomer}</span>
              <span>{processingStatus.processedShipments} of {processingStatus.totalShipments}</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${processingStatus.totalShipments > 0 ? (processingStatus.processedShipments / processingStatus.totalShipments) * 100 : 0}%` 
                }}
              />
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
            </button>
          </div>

          {/* Phase 1 Results */}
          {phase1Results.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Phase 1: Baseline Revenue Targets</h3>
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
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Phase 2: Negotiation Impact Analysis</h3>
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