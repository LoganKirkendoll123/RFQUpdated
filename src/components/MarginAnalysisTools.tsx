import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Truck, 
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Upload,
  Zap,
  Award,
  Building2,
  Calendar,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Percent,
  Activity,
  Eye,
  Settings,
  Filter,
  Search,
  Clock,
  MapPin,
  Package,
  Star,
  Loader,
  Plus
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Project44APIClient } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';

interface MarginAnalysisData {
  customerName: string;
  carrierName: string;
  carrierScac: string;
  currentMargin: number;
  shipmentCount: number;
  totalRevenue: number;
  totalProfit: number;
  avgShipmentValue: number;
  profitMargin: number;
  recentTrend: 'up' | 'down' | 'stable';
  lastShipmentDate: string;
  topLanes: Array<{
    lane: string;
    shipments: number;
    revenue: number;
    profit: number;
  }>;
}

interface CarrierScorecard {
  carrierName: string;
  carrierScac: string;
  totalCustomers: number;
  totalShipments: number;
  totalRevenue: number;
  avgMargin: number;
  marginRange: { min: number; max: number };
  performanceScore: number;
  revenueGrowth: number;
  marginStability: number;
  customerRetention: number;
  topCustomers: Array<{
    customer: string;
    shipments: number;
    revenue: number;
    margin: number;
  }>;
}

interface MarginForecast {
  period: string;
  projectedRevenue: number;
  projectedProfit: number;
  projectedMargin: number;
  confidence: number;
  factors: string[];
}

interface NegotiationAnalysis {
  carrierName: string;
  carrierScac: string;
  preNegotiationData: {
    avgRate: number;
    totalVolume: number;
    marginImpact: number;
  };
  postNegotiationData?: {
    avgRate: number;
    totalVolume: number;
    marginImpact: number;
  };
  discountAnalysis: {
    avgDiscount: number;
    volumeImpact: number;
    revenueImpact: number;
  };
  customerRecommendations: Array<{
    customer: string;
    currentMargin: number;
    recommendedMargin: number;
    expectedIncrease: number;
    reasoning: string;
  }>;
}

interface NewCarrierAnalysis {
  carrierName: string;
  carrierScac: string;
  marketRates: Array<{
    lane: string;
    avgRate: number;
    volume: number;
  }>;
  competitorMargins: Array<{
    competitor: string;
    avgMargin: number;
  }>;
  recommendedMargins: Array<{
    customer: string;
    recommendedMargin: number;
    reasoning: string;
    expectedVolume: number;
    projectedRevenue: number;
  }>;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyzer' | 'scorecard' | 'forecast' | 'negotiation' | 'new-carrier'>('analyzer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Data states
  const [marginData, setMarginData] = useState<MarginAnalysisData[]>([]);
  const [carrierScorecards, setCarrierScorecards] = useState<CarrierScorecard[]>([]);
  const [forecasts, setForecastData] = useState<MarginForecast[]>([]);
  const [negotiationAnalysis, setNegotiationAnalysis] = useState<NegotiationAnalysis | null>(null);
  const [newCarrierAnalysis, setNewCarrierAnalysis] = useState<NewCarrierAnalysis | null>(null);
  
  // Filter states
  const [customerFilter, setCustomerFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [minShipments, setMinShipments] = useState(5);
  
  // Form states
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierScac, setNewCarrierScac] = useState('');
  
  // Available options
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);
  const [availableCarriers, setAvailableCarriers] = useState<Array<{name: string, scac: string}>>([]);

  // Project44 client (would be passed from parent in real implementation)
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);

  useEffect(() => {
    loadFilterOptions();
    loadMarginAnalysis();
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Load customers from Shipments
      const { data: customerData } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null);
      
      const customers = [...new Set(customerData?.map(d => d.Customer).filter(Boolean))].sort();
      setAvailableCustomers(customers);

      // Load carriers from Shipments and CustomerCarriers
      const { data: shipmentCarriers } = await supabase
        .from('Shipments')
        .select('"Booked Carrier", "SCAC"')
        .not('"Booked Carrier"', 'is', null);

      const { data: customerCarriers } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode')
        .not('P44CarrierCode', 'is', null);

      const carrierSet = new Set<string>();
      shipmentCarriers?.forEach(s => {
        if (s["Booked Carrier"]) carrierSet.add(s["Booked Carrier"]);
      });

      const carriers = Array.from(carrierSet).map(name => ({
        name,
        scac: shipmentCarriers?.find(s => s["Booked Carrier"] === name)?.SCAC || ''
      })).sort((a, b) => a.name.localeCompare(b.name));

      setAvailableCarriers(carriers);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadMarginAnalysis = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Loading comprehensive margin analysis...');
      
      // Get shipment data with filters
      let shipmentsQuery = supabase
        .from('Shipments')
        .select('*')
        .not('"Customer"', 'is', null)
        .not('"Booked Carrier"', 'is', null)
        .not('"Revenue"', 'is', null)
        .not('"Profit"', 'is', null);

      if (customerFilter) {
        shipmentsQuery = shipmentsQuery.eq('"Customer"', customerFilter);
      }
      
      if (carrierFilter) {
        shipmentsQuery = shipmentsQuery.eq('"Booked Carrier"', carrierFilter);
      }
      
      if (dateRange.start) {
        shipmentsQuery = shipmentsQuery.gte('"Scheduled Pickup Date"', dateRange.start);
      }
      
      if (dateRange.end) {
        shipmentsQuery = shipmentsQuery.lte('"Scheduled Pickup Date"', dateRange.end);
      }

      const { data: shipments, error: shipmentsError } = await shipmentsQuery;
      
      if (shipmentsError) throw shipmentsError;

      // Get customer-carrier margin data
      const { data: customerCarrierData, error: ccError } = await supabase
        .from('CustomerCarriers')
        .select('*');
      
      if (ccError) throw ccError;

      // Process margin analysis
      const marginAnalysis = await processMarginAnalysis(shipments || [], customerCarrierData || []);
      setMarginData(marginAnalysis);

      console.log(`✅ Loaded margin analysis for ${marginAnalysis.length} customer-carrier combinations`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load margin analysis';
      setError(errorMsg);
      console.error('❌ Margin analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const processMarginAnalysis = async (shipments: any[], customerCarriers: any[]): Promise<MarginAnalysisData[]> => {
    const analysisMap = new Map<string, MarginAnalysisData>();
    
    // Group shipments by customer-carrier combination
    shipments.forEach(shipment => {
      const customer = shipment.Customer;
      const carrier = shipment["Booked Carrier"];
      const scac = shipment.SCAC || '';
      const key = `${customer}:${carrier}`;
      
      if (!analysisMap.has(key)) {
        // Find margin from CustomerCarriers table
        const marginRecord = customerCarriers.find(cc => 
          cc.InternalName === customer && 
          (cc.P44CarrierCode === carrier || cc.P44CarrierCode === scac)
        );
        
        analysisMap.set(key, {
          customerName: customer,
          carrierName: carrier,
          carrierScac: scac,
          currentMargin: parseFloat(marginRecord?.Percentage || '0'),
          shipmentCount: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgShipmentValue: 0,
          profitMargin: 0,
          recentTrend: 'stable',
          lastShipmentDate: '',
          topLanes: []
        });
      }
      
      const analysis = analysisMap.get(key)!;
      const revenue = parseFloat(shipment.Revenue?.replace(/[^\d.-]/g, '') || '0');
      const profit = parseFloat(shipment.Profit?.replace(/[^\d.-]/g, '') || '0');
      
      analysis.shipmentCount++;
      analysis.totalRevenue += revenue;
      analysis.totalProfit += profit;
      
      if (shipment["Scheduled Pickup Date"] > analysis.lastShipmentDate) {
        analysis.lastShipmentDate = shipment["Scheduled Pickup Date"];
      }
    });
    
    // Calculate derived metrics and trends
    for (const analysis of analysisMap.values()) {
      analysis.avgShipmentValue = analysis.totalRevenue / analysis.shipmentCount;
      analysis.profitMargin = analysis.totalRevenue > 0 ? (analysis.totalProfit / analysis.totalRevenue) * 100 : 0;
      
      // Calculate recent trend (last 30 days vs previous 30 days)
      const recentShipments = shipments.filter(s => 
        s.Customer === analysis.customerName && 
        s["Booked Carrier"] === analysis.carrierName &&
        new Date(s["Scheduled Pickup Date"]) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      
      const previousShipments = shipments.filter(s => 
        s.Customer === analysis.customerName && 
        s["Booked Carrier"] === analysis.carrierName &&
        new Date(s["Scheduled Pickup Date"]) >= new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) &&
        new Date(s["Scheduled Pickup Date"]) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      
      const recentMargin = recentShipments.length > 0 ? 
        recentShipments.reduce((sum, s) => sum + parseFloat(s.Profit?.replace(/[^\d.-]/g, '') || '0'), 0) /
        recentShipments.reduce((sum, s) => sum + parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0'), 0) * 100 : 0;
      
      const previousMargin = previousShipments.length > 0 ? 
        previousShipments.reduce((sum, s) => sum + parseFloat(s.Profit?.replace(/[^\d.-]/g, '') || '0'), 0) /
        previousShipments.reduce((sum, s) => sum + parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0'), 0) * 100 : 0;
      
      if (recentMargin > previousMargin * 1.05) {
        analysis.recentTrend = 'up';
      } else if (recentMargin < previousMargin * 0.95) {
        analysis.recentTrend = 'down';
      }
      
      // Calculate top lanes
      const laneMap = new Map<string, {shipments: number, revenue: number, profit: number}>();
      shipments.filter(s => 
        s.Customer === analysis.customerName && 
        s["Booked Carrier"] === analysis.carrierName
      ).forEach(s => {
        const lane = `${s.Zip} → ${s.Zip_1}`;
        if (!laneMap.has(lane)) {
          laneMap.set(lane, {shipments: 0, revenue: 0, profit: 0});
        }
        const laneData = laneMap.get(lane)!;
        laneData.shipments++;
        laneData.revenue += parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0');
        laneData.profit += parseFloat(s.Profit?.replace(/[^\d.-]/g, '') || '0');
      });
      
      analysis.topLanes = Array.from(laneMap.entries())
        .map(([lane, data]) => ({lane, ...data}))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }
    
    return Array.from(analysisMap.values())
      .filter(a => a.shipmentCount >= minShipments)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  const loadCarrierScorecards = async () => {
    setLoading(true);
    try {
      console.log('📊 Loading carrier scorecards...');
      
      // Get all shipment and margin data
      const { data: shipments } = await supabase
        .from('Shipments')
        .select('*')
        .not('"Booked Carrier"', 'is', null);
      
      const { data: customerCarriers } = await supabase
        .from('CustomerCarriers')
        .select('*');
      
      const scorecards = await processCarrierScorecards(shipments || [], customerCarriers || []);
      setCarrierScorecards(scorecards);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carrier scorecards');
    } finally {
      setLoading(false);
    }
  };

  const processCarrierScorecards = async (shipments: any[], customerCarriers: any[]): Promise<CarrierScorecard[]> => {
    const carrierMap = new Map<string, CarrierScorecard>();
    
    // Group by carrier
    shipments.forEach(shipment => {
      const carrier = shipment["Booked Carrier"];
      const scac = shipment.SCAC || '';
      
      if (!carrierMap.has(carrier)) {
        carrierMap.set(carrier, {
          carrierName: carrier,
          carrierScac: scac,
          totalCustomers: 0,
          totalShipments: 0,
          totalRevenue: 0,
          avgMargin: 0,
          marginRange: { min: 100, max: 0 },
          performanceScore: 0,
          revenueGrowth: 0,
          marginStability: 0,
          customerRetention: 0,
          topCustomers: []
        });
      }
      
      const scorecard = carrierMap.get(carrier)!;
      scorecard.totalShipments++;
      scorecard.totalRevenue += parseFloat(shipment.Revenue?.replace(/[^\d.-]/g, '') || '0');
    });
    
    // Calculate metrics for each carrier
    for (const scorecard of carrierMap.values()) {
      const carrierShipments = shipments.filter(s => s["Booked Carrier"] === scorecard.carrierName);
      const uniqueCustomers = new Set(carrierShipments.map(s => s.Customer));
      scorecard.totalCustomers = uniqueCustomers.size;
      
      // Calculate margins
      const margins = customerCarriers
        .filter(cc => cc.P44CarrierCode === scorecard.carrierName || cc.P44CarrierCode === scorecard.carrierScac)
        .map(cc => parseFloat(cc.Percentage || '0'));
      
      if (margins.length > 0) {
        scorecard.avgMargin = margins.reduce((sum, m) => sum + m, 0) / margins.length;
        scorecard.marginRange.min = Math.min(...margins);
        scorecard.marginRange.max = Math.max(...margins);
      }
      
      // Calculate performance score (composite metric)
      const revenueScore = Math.min(scorecard.totalRevenue / 1000000, 1) * 30; // Max 30 points
      const volumeScore = Math.min(scorecard.totalShipments / 1000, 1) * 25; // Max 25 points
      const marginScore = Math.min(scorecard.avgMargin / 25, 1) * 25; // Max 25 points
      const customerScore = Math.min(scorecard.totalCustomers / 50, 1) * 20; // Max 20 points
      
      scorecard.performanceScore = revenueScore + volumeScore + marginScore + customerScore;
      
      // Calculate top customers
      const customerMap = new Map<string, {shipments: number, revenue: number, margin: number}>();
      carrierShipments.forEach(s => {
        const customer = s.Customer;
        if (!customerMap.has(customer)) {
          const marginRecord = customerCarriers.find(cc => 
            cc.InternalName === customer && 
            (cc.P44CarrierCode === scorecard.carrierName || cc.P44CarrierCode === scorecard.carrierScac)
          );
          customerMap.set(customer, {
            shipments: 0,
            revenue: 0,
            margin: parseFloat(marginRecord?.Percentage || '0')
          });
        }
        const customerData = customerMap.get(customer)!;
        customerData.shipments++;
        customerData.revenue += parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0');
      });
      
      scorecard.topCustomers = Array.from(customerMap.entries())
        .map(([customer, data]) => ({customer, ...data}))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }
    
    return Array.from(carrierMap.values())
      .sort((a, b) => b.performanceScore - a.performanceScore);
  };

  const runNegotiationAnalysis = async () => {
    if (!selectedCarrier || !project44Client) {
      setError('Please select a carrier and ensure Project44 connection');
      return;
    }
    
    setLoading(true);
    try {
      console.log(`🤝 Running negotiation analysis for ${selectedCarrier}...`);
      
      // Get historical data for this carrier
      const { data: shipments } = await supabase
        .from('Shipments')
        .select('*')
        .eq('"Booked Carrier"', selectedCarrier)
        .gte('"Scheduled Pickup Date"', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      if (!shipments || shipments.length === 0) {
        throw new Error('No recent shipment data found for this carrier');
      }
      
      // Get current rates from Project44 for comparison
      const sampleShipments = shipments.slice(0, 10); // Sample for rate comparison
      const currentRates = await Promise.all(
        sampleShipments.map(async (shipment) => {
          try {
            const rfqData = {
              fromDate: new Date().toISOString().split('T')[0],
              fromZip: shipment.Zip,
              toZip: shipment.Zip_1,
              pallets: parseInt(shipment["Tot Packages"] || '1'),
              grossWeight: parseInt(shipment["Tot Weight"]?.replace(/[^\d]/g, '') || '1000'),
              isStackable: false,
              accessorial: []
            };
            
            const quotes = await project44Client.getQuotes(rfqData, [], false, false, false);
            const carrierQuote = quotes.find(q => q.carrier.name === selectedCarrier);
            
            return {
              lane: `${shipment.Zip} → ${shipment.Zip_1}`,
              historicalRate: parseFloat(shipment["Carrier Quote"]?.replace(/[^\d.-]/g, '') || '0'),
              currentRate: carrierQuote ? carrierQuote.baseRate + carrierQuote.fuelSurcharge + carrierQuote.premiumsAndDiscounts : 0,
              volume: 1
            };
          } catch (error) {
            console.warn(`Failed to get current rate for ${shipment.Zip} → ${shipment.Zip_1}:`, error);
            return null;
          }
        })
      );
      
      const validRates = currentRates.filter(r => r !== null && r.currentRate > 0);
      
      if (validRates.length === 0) {
        throw new Error('Unable to get current market rates for comparison');
      }
      
      // Calculate pre-negotiation metrics
      const totalVolume = shipments.length;
      const avgHistoricalRate = shipments.reduce((sum, s) => 
        sum + parseFloat(s["Carrier Quote"]?.replace(/[^\d.-]/g, '') || '0'), 0) / shipments.length;
      
      const avgCurrentRate = validRates.reduce((sum, r) => sum + r.currentRate, 0) / validRates.length;
      
      // Calculate discount analysis
      const avgDiscount = ((avgCurrentRate - avgHistoricalRate) / avgCurrentRate) * 100;
      
      // Get customer-specific data for recommendations
      const { data: customerCarriers } = await supabase
        .from('CustomerCarriers')
        .select('*')
        .eq('P44CarrierCode', selectedCarrier);
      
      const customerRecommendations = customerCarriers?.map(cc => {
        const customerShipments = shipments.filter(s => s.Customer === cc.InternalName);
        const currentMargin = parseFloat(cc.Percentage || '0');
        
        // Recommend margin increase based on discount received
        const recommendedIncrease = Math.max(avgDiscount * 0.5, 2); // Pass through 50% of discount, minimum 2%
        const recommendedMargin = currentMargin + recommendedIncrease;
        
        return {
          customer: cc.InternalName,
          currentMargin,
          recommendedMargin,
          expectedIncrease: recommendedIncrease,
          reasoning: `Based on ${avgDiscount.toFixed(1)}% carrier discount, recommend ${recommendedIncrease.toFixed(1)}% margin increase`
        };
      }) || [];
      
      const analysis: NegotiationAnalysis = {
        carrierName: selectedCarrier,
        carrierScac: shipments[0]?.SCAC || '',
        preNegotiationData: {
          avgRate: avgHistoricalRate,
          totalVolume,
          marginImpact: 0
        },
        discountAnalysis: {
          avgDiscount,
          volumeImpact: totalVolume,
          revenueImpact: (avgCurrentRate - avgHistoricalRate) * totalVolume
        },
        customerRecommendations
      };
      
      setNegotiationAnalysis(analysis);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run negotiation analysis');
    } finally {
      setLoading(false);
    }
  };

  const runNewCarrierAnalysis = async () => {
    if (!newCarrierName || !newCarrierScac || !project44Client) {
      setError('Please enter carrier details and ensure Project44 connection');
      return;
    }
    
    setLoading(true);
    try {
      console.log(`🆕 Running new carrier analysis for ${newCarrierName}...`);
      
      // Get top lanes from existing shipments
      const { data: shipments } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      // Analyze top lanes by volume
      const laneMap = new Map<string, {volume: number, avgRevenue: number}>();
      shipments?.forEach(s => {
        const lane = `${s.Zip} → ${s.Zip_1}`;
        if (!laneMap.has(lane)) {
          laneMap.set(lane, {volume: 0, avgRevenue: 0});
        }
        const laneData = laneMap.get(lane)!;
        laneData.volume++;
        laneData.avgRevenue += parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0');
      });
      
      const topLanes = Array.from(laneMap.entries())
        .map(([lane, data]) => ({
          lane,
          volume: data.volume,
          avgRevenue: data.avgRevenue / data.volume
        }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
      
      // Get market rates for top lanes
      const marketRates = await Promise.all(
        topLanes.map(async (laneData) => {
          try {
            const [fromZip, toZip] = laneData.lane.split(' → ');
            const rfqData = {
              fromDate: new Date().toISOString().split('T')[0],
              fromZip,
              toZip,
              pallets: 3, // Standard test shipment
              grossWeight: 2500,
              isStackable: false,
              accessorial: []
            };
            
            const quotes = await project44Client.getQuotes(rfqData, [], false, false, false);
            const avgRate = quotes.length > 0 ? 
              quotes.reduce((sum, q) => sum + q.baseRate + q.fuelSurcharge + q.premiumsAndDiscounts, 0) / quotes.length : 0;
            
            return {
              lane: laneData.lane,
              avgRate,
              volume: laneData.volume
            };
          } catch (error) {
            console.warn(`Failed to get rates for ${laneData.lane}:`, error);
            return {
              lane: laneData.lane,
              avgRate: 0,
              volume: laneData.volume
            };
          }
        })
      );
      
      // Analyze competitor margins
      const { data: competitorMargins } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode, Percentage')
        .not('P44CarrierCode', 'is', null);
      
      const marginMap = new Map<string, number[]>();
      competitorMargins?.forEach(cm => {
        const carrier = cm.P44CarrierCode;
        const margin = parseFloat(cm.Percentage || '0');
        if (!marginMap.has(carrier)) {
          marginMap.set(carrier, []);
        }
        marginMap.get(carrier)!.push(margin);
      });
      
      const competitorAvgs = Array.from(marginMap.entries())
        .map(([carrier, margins]) => ({
          competitor: carrier,
          avgMargin: margins.reduce((sum, m) => sum + m, 0) / margins.length
        }))
        .sort((a, b) => b.avgMargin - a.avgMargin)
        .slice(0, 5);
      
      // Generate customer recommendations
      const customerRecommendations = availableCustomers.map(customer => {
        const customerShipments = shipments?.filter(s => s.Customer === customer) || [];
        const avgShipmentValue = customerShipments.length > 0 ?
          customerShipments.reduce((sum, s) => sum + parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0'), 0) / customerShipments.length : 0;
        
        // Base recommendation on market average with adjustments
        const marketAvg = competitorAvgs.length > 0 ? 
          competitorAvgs.reduce((sum, c) => sum + c.avgMargin, 0) / competitorAvgs.length : 20;
        
        let recommendedMargin = marketAvg;
        let reasoning = `Market average margin of ${marketAvg.toFixed(1)}%`;
        
        // Adjust based on customer volume
        if (customerShipments.length > 100) {
          recommendedMargin -= 2;
          reasoning += `, reduced 2% for high volume (${customerShipments.length} shipments)`;
        } else if (customerShipments.length < 20) {
          recommendedMargin += 3;
          reasoning += `, increased 3% for low volume (${customerShipments.length} shipments)`;
        }
        
        // Adjust based on shipment value
        if (avgShipmentValue > 2000) {
          recommendedMargin -= 1;
          reasoning += `, reduced 1% for high-value shipments`;
        }
        
        return {
          customer,
          recommendedMargin: Math.max(recommendedMargin, 10), // Minimum 10%
          reasoning,
          expectedVolume: customerShipments.length,
          projectedRevenue: avgShipmentValue * customerShipments.length * (recommendedMargin / 100)
        };
      }).sort((a, b) => b.projectedRevenue - a.projectedRevenue);
      
      const analysis: NewCarrierAnalysis = {
        carrierName: newCarrierName,
        carrierScac: newCarrierScac,
        marketRates: marketRates.filter(r => r.avgRate > 0),
        competitorMargins: competitorAvgs,
        recommendedMargins: customerRecommendations.slice(0, 20) // Top 20 customers
      };
      
      setNewCarrierAnalysis(analysis);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run new carrier analysis');
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    setLoading(true);
    try {
      console.log('📈 Generating margin forecasts...');
      
      // Get historical data for trend analysis
      const { data: shipments } = await supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('"Scheduled Pickup Date"', { ascending: true });
      
      if (!shipments || shipments.length === 0) {
        throw new Error('Insufficient historical data for forecasting');
      }
      
      // Group by month for trend analysis
      const monthlyData = new Map<string, {revenue: number, profit: number, shipments: number}>();
      
      shipments.forEach(s => {
        const month = s["Scheduled Pickup Date"].substring(0, 7); // YYYY-MM
        if (!monthlyData.has(month)) {
          monthlyData.set(month, {revenue: 0, profit: 0, shipments: 0});
        }
        const data = monthlyData.get(month)!;
        data.revenue += parseFloat(s.Revenue?.replace(/[^\d.-]/g, '') || '0');
        data.profit += parseFloat(s.Profit?.replace(/[^\d.-]/g, '') || '0');
        data.shipments++;
      });
      
      const monthlyArray = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          revenue: data.revenue,
          profit: data.profit,
          margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
          shipments: data.shipments
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      // Calculate trends
      const recentMonths = monthlyArray.slice(-3);
      const avgRecentRevenue = recentMonths.reduce((sum, m) => sum + m.revenue, 0) / recentMonths.length;
      const avgRecentMargin = recentMonths.reduce((sum, m) => sum + m.margin, 0) / recentMonths.length;
      
      // Generate 6-month forecast
      const forecasts: MarginForecast[] = [];
      for (let i = 1; i <= 6; i++) {
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + i);
        const period = futureDate.toISOString().substring(0, 7);
        
        // Simple trend-based projection with seasonal adjustments
        const seasonalFactor = Math.sin((futureDate.getMonth() / 12) * 2 * Math.PI) * 0.1 + 1;
        const projectedRevenue = avgRecentRevenue * seasonalFactor * (1 + (i * 0.02)); // 2% monthly growth
        const projectedMargin = avgRecentMargin * (1 + (i * 0.001)); // Slight margin improvement
        const projectedProfit = projectedRevenue * (projectedMargin / 100);
        
        forecasts.push({
          period,
          projectedRevenue,
          projectedProfit,
          projectedMargin,
          confidence: Math.max(90 - (i * 10), 50), // Decreasing confidence over time
          factors: [
            'Historical trend analysis',
            'Seasonal adjustments',
            'Market growth assumptions',
            i <= 3 ? 'High confidence (near-term)' : 'Medium confidence (long-term)'
          ]
        });
      }
      
      setForecastData(forecasts);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate forecast');
    } finally {
      setLoading(false);
    }
  };

  const exportAnalysis = (type: string) => {
    console.log(`📊 Exporting ${type} analysis...`);
    // Implementation would export to Excel/CSV
  };

  const renderMarginAnalyzer = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {availableCustomers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Carriers</option>
              {availableCarriers.map(carrier => (
                <option key={carrier.name} value={carrier.name}>{carrier.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Shipments</label>
            <input
              type="number"
              value={minShipments}
              onChange={(e) => setMinShipments(parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <button
              onClick={loadMarginAnalysis}
              disabled={loading}
              className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : 'Analyze'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {marginData.map((data, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-gray-900">{data.customerName}</h4>
                <p className="text-sm text-gray-600">{data.carrierName}</p>
              </div>
              <div className="flex items-center space-x-2">
                {data.recentTrend === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
                {data.recentTrend === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
                {data.recentTrend === 'stable' && <Activity className="h-5 w-5 text-gray-500" />}
                <span className="text-lg font-bold text-blue-600">
                  {data.currentMargin.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Shipments:</span>
                <div className="font-medium">{data.shipmentCount}</div>
              </div>
              <div>
                <span className="text-gray-600">Revenue:</span>
                <div className="font-medium">{formatCurrency(data.totalRevenue)}</div>
              </div>
              <div>
                <span className="text-gray-600">Profit:</span>
                <div className="font-medium text-green-600">{formatCurrency(data.totalProfit)}</div>
              </div>
              <div>
                <span className="text-gray-600">Avg Value:</span>
                <div className="font-medium">{formatCurrency(data.avgShipmentValue)}</div>
              </div>
            </div>
            
            {data.topLanes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Top Lanes</h5>
                <div className="space-y-1">
                  {data.topLanes.slice(0, 3).map((lane, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600">{lane.lane}</span>
                      <span className="font-medium">{lane.shipments} shipments</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderCarrierScorecard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Carrier Performance Scorecards</h3>
        <button
          onClick={loadCarrierScorecards}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : 'Generate Scorecards'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {carrierScorecards.map((scorecard, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-gray-900">{scorecard.carrierName}</h4>
                <p className="text-sm text-gray-600">SCAC: {scorecard.carrierScac}</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {scorecard.performanceScore.toFixed(0)}
                </div>
                <div className="text-xs text-gray-500">Score</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-600">Customers:</span>
                <div className="font-medium">{scorecard.totalCustomers}</div>
              </div>
              <div>
                <span className="text-gray-600">Shipments:</span>
                <div className="font-medium">{scorecard.totalShipments}</div>
              </div>
              <div>
                <span className="text-gray-600">Revenue:</span>
                <div className="font-medium">{formatCurrency(scorecard.totalRevenue)}</div>
              </div>
              <div>
                <span className="text-gray-600">Avg Margin:</span>
                <div className="font-medium">{scorecard.avgMargin.toFixed(1)}%</div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Margin Range</span>
                <span>{scorecard.marginRange.min.toFixed(1)}% - {scorecard.marginRange.max.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${(scorecard.avgMargin / 30) * 100}%` }}
                />
              </div>
            </div>
            
            {scorecard.topCustomers.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Top Customers</h5>
                <div className="space-y-1">
                  {scorecard.topCustomers.slice(0, 3).map((customer, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600">{customer.customer}</span>
                      <span className="font-medium">{formatCurrency(customer.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderNegotiationAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrier Negotiation Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Carrier</label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose carrier...</option>
              {availableCarriers.map(carrier => (
                <option key={carrier.name} value={carrier.name}>{carrier.name}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={runNegotiationAnalysis}
              disabled={loading || !selectedCarrier}
              className="w-full mt-6 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : 'Analyze Negotiation Impact'}
            </button>
          </div>
        </div>
      </div>

      {negotiationAnalysis && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="font-semibold text-gray-900 mb-4">
              Negotiation Analysis: {negotiationAnalysis.carrierName}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">Pre-Negotiation</h5>
                <div className="space-y-2 text-sm">
                  <div>Avg Rate: {formatCurrency(negotiationAnalysis.preNegotiationData.avgRate)}</div>
                  <div>Volume: {negotiationAnalysis.preNegotiationData.totalVolume} shipments</div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="font-medium text-green-900 mb-2">Discount Analysis</h5>
                <div className="space-y-2 text-sm">
                  <div>Avg Discount: {negotiationAnalysis.discountAnalysis.avgDiscount.toFixed(1)}%</div>
                  <div>Revenue Impact: {formatCurrency(negotiationAnalysis.discountAnalysis.revenueImpact)}</div>
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <h5 className="font-medium text-purple-900 mb-2">Recommendations</h5>
                <div className="space-y-2 text-sm">
                  <div>{negotiationAnalysis.customerRecommendations.length} customers</div>
                  <div>Avg increase: {negotiationAnalysis.customerRecommendations.length > 0 ? 
                    (negotiationAnalysis.customerRecommendations.reduce((sum, r) => sum + r.expectedIncrease, 0) / 
                     negotiationAnalysis.customerRecommendations.length).toFixed(1) : 0}%</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Customer Margin Recommendations</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recommended</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Increase</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {negotiationAnalysis.customerRecommendations.map((rec, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{rec.customer}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{rec.currentMargin.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-sm text-green-600 font-medium">{rec.recommendedMargin.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-sm text-blue-600">+{rec.expectedIncrease.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{rec.reasoning}</td>
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

  const renderNewCarrierAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Carrier Margin Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name</label>
            <input
              type="text"
              value={newCarrierName}
              onChange={(e) => setNewCarrierName(e.target.value)}
              placeholder="Enter carrier name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SCAC Code</label>
            <input
              type="text"
              value={newCarrierScac}
              onChange={(e) => setNewCarrierScac(e.target.value)}
              placeholder="Enter SCAC"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              onClick={runNewCarrierAnalysis}
              disabled={loading || !newCarrierName || !newCarrierScac}
              className="w-full mt-6 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : 'Analyze New Carrier'}
            </button>
          </div>
        </div>
      </div>

      {newCarrierAnalysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Market Rate Analysis</h4>
              <div className="space-y-3">
                {newCarrierAnalysis.marketRates.slice(0, 5).map((rate, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{rate.lane}</span>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(rate.avgRate)}</div>
                      <div className="text-xs text-gray-500">{rate.volume} shipments</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Competitor Margins</h4>
              <div className="space-y-3">
                {newCarrierAnalysis.competitorMargins.map((comp, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{comp.competitor}</span>
                    <span className="font-medium">{comp.avgMargin.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Customer Margin Recommendations</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected Volume</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Projected Revenue</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {newCarrierAnalysis.recommendedMargins.slice(0, 10).map((rec, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{rec.customer}</td>
                      <td className="px-4 py-2 text-sm text-green-600 font-medium">{rec.recommendedMargin.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{rec.expectedVolume}</td>
                      <td className="px-4 py-2 text-sm text-blue-600">{formatCurrency(rec.projectedRevenue)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{rec.reasoning}</td>
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

  const renderForecast = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Margin Forecasting</h3>
        <button
          onClick={generateForecast}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : 'Generate Forecast'}
        </button>
      </div>
      
      {forecasts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {forecasts.map((forecast, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">{forecast.period}</h4>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Confidence</div>
                  <div className="font-bold text-blue-600">{forecast.confidence}%</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-600">Revenue:</span>
                  <div className="font-medium">{formatCurrency(forecast.projectedRevenue)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Profit:</span>
                  <div className="font-medium text-green-600">{formatCurrency(forecast.projectedProfit)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Margin:</span>
                  <div className="font-medium">{forecast.projectedMargin.toFixed(1)}%</div>
                </div>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Forecast Factors</h5>
                <ul className="text-xs text-gray-600 space-y-1">
                  {forecast.factors.map((factor, i) => (
                    <li key={i}>• {factor}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
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
              Comprehensive margin analysis using real shipment data and live Project44 API calls
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'analyzer', label: 'Margin Analyzer', icon: Calculator },
            { id: 'scorecard', label: 'Carrier Scorecards', icon: Award },
            { id: 'forecast', label: 'Forecasting', icon: TrendingUp },
            { id: 'negotiation', label: 'Negotiation Analysis', icon: Target },
            { id: 'new-carrier', label: 'New Carrier Analysis', icon: Plus }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
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

      {/* Tab Content */}
      {activeTab === 'analyzer' && renderMarginAnalyzer()}
      {activeTab === 'scorecard' && renderCarrierScorecard()}
      {activeTab === 'forecast' && renderForecast()}
      {activeTab === 'negotiation' && renderNegotiationAnalysis()}
      {activeTab === 'new-carrier' && renderNewCarrierAnalysis()}
    </div>
  );
};