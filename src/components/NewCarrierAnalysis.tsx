import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  TrendingUp, 
  DollarSign,
  Package,
  Clock,
  Star,
  Loader,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQRow, QuoteWithPricing } from '../types';

interface NewCarrierAnalysisProps {
  project44Client: Project44APIClient | null;
  dateRange: { start: string; end: string };
}

interface CarrierAnalysis {
  carrierId: string;
  carrierName: string;
  scac: string;
  avgRate: number;
  quoteCount: number;
  avgTransitDays: number;
  competitiveScore: number;
  recommendationReason: string;
  sampleQuotes: QuoteWithPricing[];
}

export const NewCarrierAnalysis: React.FC<NewCarrierAnalysisProps> = ({
  project44Client,
  dateRange
}) => {
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [existingCarriers, setExistingCarriers] = useState<Set<string>>(new Set());
  const [newCarrierAnalysis, setNewCarrierAnalysis] = useState<CarrierAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (project44Client) {
      loadCarriersAndExisting();
    }
  }, [project44Client]);

  const loadCarriersAndExisting = async () => {
    if (!project44Client) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🚛 Loading available carriers and existing relationships...');
      
      // Load available carriers from Project44
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      // Load existing carrier relationships from CustomerCarriers table
      const { data: customerCarriers, error } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode')
        .not('P44CarrierCode', 'is', null);
      
      if (error) {
        throw error;
      }
      
      const existing = new Set(customerCarriers?.map(cc => cc.P44CarrierCode) || []);
      setExistingCarriers(existing);
      
      console.log(`✅ Loaded ${groups.length} carrier groups and ${existing.size} existing relationships`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load carriers';
      setError(errorMsg);
      console.error('❌ Failed to load carriers:', err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeNewCarriers = async () => {
    if (!project44Client || carrierGroups.length === 0) {
      setError('Project44 client not available or no carriers loaded');
      return;
    }
    
    setAnalyzing(true);
    setError('');
    setNewCarrierAnalysis([]);
    
    try {
      console.log('🔍 Analyzing new carrier opportunities...');
      
      // Get all available carriers that are not in existing relationships
      const allCarriers = carrierGroups.flatMap(group => group.carriers);
      const newCarriers = allCarriers.filter(carrier => 
        !existingCarriers.has(carrier.id) && 
        !existingCarriers.has(carrier.scac || '') &&
        !existingCarriers.has(carrier.name)
      );
      
      console.log(`📊 Found ${newCarriers.length} new carriers to analyze`);
      
      if (newCarriers.length === 0) {
        setError('No new carriers found to analyze');
        return;
      }
      
      // Get sample shipments to test with new carriers
      const { data: sampleShipments, error } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .limit(10); // Analyze with 10 sample shipments
      
      if (error || !sampleShipments || sampleShipments.length === 0) {
        setError('No sample shipments found for analysis');
        return;
      }
      
      // Convert shipments to RFQ format
      const sampleRFQs: RFQRow[] = sampleShipments.map(shipment => ({
        fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
        fromZip: shipment["Zip"] || '00000',
        toZip: shipment["Zip_1"] || '00000',
        pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
        grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
        isStackable: false,
        isReefer: false,
        accessorial: []
      }));
      
      setCurrentProgress({ current: 0, total: Math.min(newCarriers.length, 20) }); // Limit to top 20 carriers
      const carriersToAnalyze = newCarriers.slice(0, 20);
      const analysisResults: CarrierAnalysis[] = [];
      
      for (let i = 0; i < carriersToAnalyze.length; i++) {
        const carrier = carriersToAnalyze[i];
        setCurrentProgress({ current: i + 1, total: carriersToAnalyze.length });
        
        try {
          console.log(`📊 Analyzing carrier ${carrier.name} (${i + 1}/${carriersToAnalyze.length})`);
          
          const carrierQuotes: QuoteWithPricing[] = [];
          let totalRate = 0;
          let totalTransitDays = 0;
          let validQuotes = 0;
          
          // Test this carrier with sample RFQs
          for (const rfq of sampleRFQs.slice(0, 3)) { // Test with 3 RFQs per carrier
            try {
              const quotes = await project44Client.getQuotes(rfq, [carrier.id], false, false, false);
              
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
              
              carrierQuotes.push(...quotesWithPricing);
              
              quotesWithPricing.forEach(quote => {
                totalRate += quote.carrierTotalRate;
                if (quote.transitDays) {
                  totalTransitDays += quote.transitDays;
                }
                validQuotes++;
              });
              
            } catch (quoteError) {
              console.warn(`⚠️ Failed to get quotes from ${carrier.name}:`, quoteError);
            }
          }
          
          if (validQuotes > 0) {
            const avgRate = totalRate / validQuotes;
            const avgTransitDays = totalTransitDays / validQuotes;
            
            // Calculate competitive score (lower rates and faster transit = higher score)
            const rateScore = Math.max(0, 100 - (avgRate / 50)); // Normalize rate score
            const transitScore = Math.max(0, 100 - (avgTransitDays * 10)); // Normalize transit score
            const competitiveScore = (rateScore + transitScore) / 2;
            
            // Generate recommendation reason
            let recommendationReason = '';
            if (competitiveScore >= 80) {
              recommendationReason = 'Excellent rates and fast transit times';
            } else if (competitiveScore >= 60) {
              recommendationReason = 'Competitive pricing with good service';
            } else if (competitiveScore >= 40) {
              recommendationReason = 'Moderate pricing, consider for specific lanes';
            } else {
              recommendationReason = 'Higher rates, evaluate for specialized services';
            }
            
            analysisResults.push({
              carrierId: carrier.id,
              carrierName: carrier.name,
              scac: carrier.scac || '',
              avgRate,
              quoteCount: validQuotes,
              avgTransitDays,
              competitiveScore,
              recommendationReason,
              sampleQuotes: carrierQuotes.slice(0, 3) // Keep top 3 sample quotes
            });
          }
          
        } catch (carrierError) {
          console.warn(`⚠️ Failed to analyze carrier ${carrier.name}:`, carrierError);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Sort by competitive score descending
      analysisResults.sort((a, b) => b.competitiveScore - a.competitiveScore);
      
      setNewCarrierAnalysis(analysisResults);
      console.log(`✅ New carrier analysis completed: ${analysisResults.length} carriers analyzed`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze new carriers';
      setError(errorMsg);
      console.error('❌ Failed to analyze new carriers:', err);
    } finally {
      setAnalyzing(false);
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
            <UserPlus className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">New Carrier Analysis</h3>
              <p className="text-sm text-gray-600">
                Discover and evaluate new carrier opportunities
              </p>
            </div>
          </div>
          <button
            onClick={analyzeNewCarriers}
            disabled={analyzing || !project44Client || carrierGroups.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Analyze New Carriers</span>
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
      {analyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader className="h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">
                Analyzing new carriers... ({currentProgress.current}/{currentProgress.total})
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

      {/* Carrier Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Carrier Network Summary</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Package className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">Total Available</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {carrierGroups.reduce((sum, group) => sum + group.carriers.length, 0)}
            </div>
            <div className="text-sm text-blue-700">carriers in network</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">Current Partners</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {existingCarriers.size}
            </div>
            <div className="text-sm text-green-700">active relationships</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <UserPlus className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900">New Opportunities</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {carrierGroups.reduce((sum, group) => sum + group.carriers.length, 0) - existingCarriers.size}
            </div>
            <div className="text-sm text-purple-700">potential new carriers</div>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {newCarrierAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            New Carrier Recommendations ({newCarrierAnalysis.length})
          </h4>
          
          <div className="space-y-4">
            {newCarrierAnalysis.map((analysis, index) => (
              <div key={analysis.carrierId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{analysis.carrierName}</h5>
                      <p className="text-sm text-gray-600">
                        SCAC: {analysis.scac || 'N/A'} • {analysis.quoteCount} quotes analyzed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className="font-bold text-lg text-gray-900">
                      {analysis.competitiveScore.toFixed(0)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-700">Avg Rate</span>
                    </div>
                    <div className="text-lg font-bold text-green-900">
                      {formatCurrency(analysis.avgRate)}
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700">Avg Transit</span>
                    </div>
                    <div className="text-lg font-bold text-blue-900">
                      {analysis.avgTransitDays.toFixed(1)} days
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700">Score</span>
                    </div>
                    <div className="text-lg font-bold text-purple-900">
                      {analysis.competitiveScore.toFixed(0)}/100
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Quotes</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {analysis.quoteCount}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    <strong>Recommendation:</strong> {analysis.recommendationReason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};