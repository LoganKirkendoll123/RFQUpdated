import React, { useState, useEffect } from 'react';
import { 
  Handshake, 
  TrendingDown, 
  Calculator, 
  Users,
  Loader,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Package,
  Target
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { RFQRow, ProcessingResult, QuoteWithPricing } from '../types';

interface NegotiationAnalysisProps {
  project44Client: Project44APIClient | null;
  dateRange: { start: string; end: string };
}

interface CustomerCarrierPair {
  customer: string;
  carrier: string;
  p44CarrierCode: string;
  currentMargin: number;
  shipmentCount: number;
  totalRevenue: number;
  avgRevenue: number;
}

interface NegotiationResult {
  customer: string;
  carrier: string;
  currentMargin: number;
  currentRevenue: number;
  marketQuotes: QuoteWithPricing[];
  potentialSavings: number;
  recommendedMargin: number;
  shipmentCount: number;
}

export const NegotiationAnalysis: React.FC<NegotiationAnalysisProps> = ({
  project44Client,
  dateRange
}) => {
  const [customerCarrierPairs, setCustomerCarrierPairs] = useState<CustomerCarrierPair[]>([]);
  const [negotiationResults, setNegotiationResults] = useState<NegotiationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadCustomerCarrierPairs();
  }, [dateRange]);

  const loadCustomerCarrierPairs = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Loading customer-carrier pairs from CustomerCarriers table...');
      
      // Get unique customer-carrier combinations from CustomerCarriers table
      const { data: customerCarriers, error: ccError } = await supabase
        .from('CustomerCarriers')
        .select('InternalName, P44CarrierCode, Percentage')
        .not('InternalName', 'is', null)
        .not('P44CarrierCode', 'is', null)
        .not('Percentage', 'is', null);
      
      if (ccError) {
        throw ccError;
      }
      
      if (!customerCarriers || customerCarriers.length === 0) {
        setCustomerCarrierPairs([]);
        return;
      }
      
      // Get shipment data for the date range to calculate volumes
      const { data: shipments, error: shipError } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);
      
      if (shipError) {
        throw shipError;
      }
      
      // Parse numeric values from string fields
      const parseNumeric = (value: string | null | undefined): number => {
        if (!value) return 0;
        const cleaned = value.toString().replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
      };
      
      // Create customer-carrier pairs with shipment data
      const pairs: CustomerCarrierPair[] = [];
      
      customerCarriers.forEach(cc => {
        const customer = cc.InternalName;
        const p44CarrierCode = cc.P44CarrierCode;
        const currentMargin = parseFloat(cc.Percentage || '0');
        
        // Find matching shipments for this customer-carrier combination
        const matchingShipments = shipments?.filter(shipment => 
          shipment["Customer"] === customer && 
          (shipment["Booked Carrier"] === p44CarrierCode || 
           shipment["Quoted Carrier"] === p44CarrierCode ||
           shipment["SCAC"] === p44CarrierCode)
        ) || [];
        
        if (matchingShipments.length > 0) {
          const totalRevenue = matchingShipments.reduce((sum, s) => sum + parseNumeric(s["Revenue"]), 0);
          const avgRevenue = totalRevenue / matchingShipments.length;
          
          pairs.push({
            customer,
            carrier: p44CarrierCode,
            p44CarrierCode,
            currentMargin,
            shipmentCount: matchingShipments.length,
            totalRevenue,
            avgRevenue
          });
        }
      });
      
      // Sort by total revenue descending
      pairs.sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      setCustomerCarrierPairs(pairs);
      console.log(`✅ Loaded ${pairs.length} customer-carrier pairs with shipment data`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load customer-carrier pairs';
      setError(errorMsg);
      console.error('❌ Failed to load customer-carrier pairs:', err);
    } finally {
      setLoading(false);
    }
  };

  const runNegotiationAnalysis = async () => {
    if (!project44Client || customerCarrierPairs.length === 0) {
      setError('Project44 client not available or no customer-carrier pairs loaded');
      return;
    }
    
    setProcessing(true);
    setError('');
    setNegotiationResults([]);
    setCurrentProgress({ current: 0, total: customerCarrierPairs.length });
    
    try {
      console.log(`🤝 Starting negotiation analysis for ${customerCarrierPairs.length} customer-carrier pairs`);
      
      const results: NegotiationResult[] = [];
      
      for (let i = 0; i < customerCarrierPairs.length; i++) {
        const pair = customerCarrierPairs[i];
        setCurrentProgress({ current: i + 1, total: customerCarrierPairs.length });
        
        try {
          console.log(`📊 Analyzing ${pair.customer} + ${pair.carrier} (${i + 1}/${customerCarrierPairs.length})`);
          
          // Get recent shipments for this customer-carrier pair to create RFQs
          const { data: recentShipments, error } = await supabase
            .from('Shipments')
            .select('*')
            .eq('"Customer"', pair.customer)
            .or(`"Booked Carrier".eq.${pair.carrier},"Quoted Carrier".eq.${pair.carrier},"SCAC".eq.${pair.carrier}`)
            .gte('"Scheduled Pickup Date"', dateRange.start)
            .lte('"Scheduled Pickup Date"', dateRange.end)
            .limit(5); // Analyze up to 5 recent shipments
          
          if (error || !recentShipments || recentShipments.length === 0) {
            console.log(`⚠️ No recent shipments found for ${pair.customer} + ${pair.carrier}`);
            continue;
          }
          
          // Convert shipments to RFQ format and get market quotes
          const marketQuotes: QuoteWithPricing[] = [];
          
          for (const shipment of recentShipments) {
            try {
              // Convert shipment to RFQ format
              const rfq: RFQRow = {
                fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
                fromZip: shipment["Zip"] || '00000',
                toZip: shipment["Zip_1"] || '00000',
                pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
                grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
                isStackable: false,
                isReefer: false,
                accessorial: []
              };
              
              // Get market quotes for this RFQ
              const quotes = await project44Client.getQuotes(rfq, [], false, false, false);
              
              // Convert to QuoteWithPricing format (simplified)
              const quotesWithPricing = quotes.map(quote => ({
                ...quote,
                carrierTotalRate: quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts,
                customerPrice: quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts,
                profit: 0,
                markupApplied: 0,
                isCustomPrice: false,
                chargeBreakdown: {
                  baseCharges: [],
                  fuelCharges: [],
                  accessorialCharges: [],
                  discountCharges: [],
                  premiumCharges: [],
                  otherCharges: []
                }
              })) as QuoteWithPricing[];
              
              marketQuotes.push(...quotesWithPricing);
              
            } catch (quoteError) {
              console.warn(`⚠️ Failed to get quotes for shipment:`, quoteError);
            }
          }
          
          if (marketQuotes.length > 0) {
            // Calculate potential savings and recommended margin
            const avgMarketRate = marketQuotes.reduce((sum, q) => sum + q.carrierTotalRate, 0) / marketQuotes.length;
            const currentRate = pair.avgRevenue;
            const potentialSavings = Math.max(0, currentRate - avgMarketRate);
            
            // Recommend a margin that's competitive but maintains profitability
            const recommendedMargin = Math.max(pair.currentMargin - 5, 10); // Reduce by 5% but keep minimum 10%
            
            results.push({
              customer: pair.customer,
              carrier: pair.carrier,
              currentMargin: pair.currentMargin,
              currentRevenue: pair.totalRevenue,
              marketQuotes,
              potentialSavings: potentialSavings * pair.shipmentCount, // Total potential savings
              recommendedMargin,
              shipmentCount: pair.shipmentCount
            });
          }
          
        } catch (pairError) {
          console.warn(`⚠️ Failed to analyze pair ${pair.customer} + ${pair.carrier}:`, pairError);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Sort results by potential savings descending
      results.sort((a, b) => b.potentialSavings - a.potentialSavings);
      
      setNegotiationResults(results);
      console.log(`✅ Negotiation analysis completed: ${results.length} results`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to run negotiation analysis';
      setError(errorMsg);
      console.error('❌ Failed to run negotiation analysis:', err);
    } finally {
      setProcessing(false);
      setCurrentProgress({ current: 0, total: 0 });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Handshake className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Negotiation Analysis</h3>
              <p className="text-sm text-gray-600">
                Analyze market rates vs current margins for customer-carrier pairs
              </p>
            </div>
          </div>
          <button
            onClick={runNegotiationAnalysis}
            disabled={processing || !project44Client || customerCarrierPairs.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? (
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

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {processing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader className="h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">
                Analyzing customer-carrier pairs... ({currentProgress.current}/{currentProgress.total})
              </div>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer-Carrier Pairs Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Customer-Carrier Pairs ({customerCarrierPairs.length})
        </h4>
        
        {customerCarrierPairs.length === 0 ? (
          <p className="text-gray-500">No customer-carrier pairs found for the selected date range</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerCarrierPairs.slice(0, 6).map((pair, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-gray-900">{pair.customer}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Carrier: {pair.carrier}</div>
                  <div>Margin: {pair.currentMargin}%</div>
                  <div>Shipments: {pair.shipmentCount}</div>
                  <div>Revenue: {formatCurrency(pair.totalRevenue)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Negotiation Results */}
      {negotiationResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Negotiation Opportunities ({negotiationResults.length})
          </h4>
          
          <div className="space-y-4">
            {negotiationResults.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className="font-medium text-gray-900">
                      {result.customer} + {result.carrier}
                    </h5>
                    <p className="text-sm text-gray-600">
                      {result.shipmentCount} shipments • {result.marketQuotes.length} market quotes
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(result.potentialSavings)}
                    </div>
                    <div className="text-sm text-gray-500">Potential Savings</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Current Margin</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{result.currentMargin}%</div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700">Recommended</span>
                    </div>
                    <div className="text-lg font-bold text-blue-900">{result.recommendedMargin}%</div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Package className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-700">Revenue</span>
                    </div>
                    <div className="text-lg font-bold text-green-900">
                      {formatCurrency(result.currentRevenue)}
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingDown className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700">Market Avg</span>
                    </div>
                    <div className="text-lg font-bold text-purple-900">
                      {formatCurrency(result.marketQuotes.reduce((sum, q) => sum + q.carrierTotalRate, 0) / result.marketQuotes.length)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};