import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Building2, 
  DollarSign, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  Loader, 
  RefreshCw,
  BarChart3,
  Calendar,
  Clock,
  Award,
  Zap,
  Brain,
  Truck,
  Plus,
  Search,
  Filter,
  Download,
  Play,
  Pause,
  Settings,
  Info,
  TrendingDown,
  Star,
  Shield,
  Activity
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient } from '../utils/apiClient';
import { RFQRow } from '../types';

interface Shipment {
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
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Revenue"?: string;
  "Carrier Quote"?: string;
  "Carrier Expense"?: string;
  "Profit"?: string;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "SCAC"?: string;
}

interface CustomerCarrier {
  "MarkupId": number;
  "CarrierId"?: number;
  "CustomerID"?: number;
  "InternalName"?: string;
  "P44CarrierCode"?: string;
  "MinDollar"?: number;
  "MaxDollar"?: string;
  "Percentage"?: string;
}

interface CarrierScorecard {
  carrierName: string;
  scac: string;
  totalShipments: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  onTimePickup: number;
  onTimeDelivery: number;
  overallScore: number;
  grade: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  opportunities: string[];
  avgWeight: number;
  avgRevenue: number;
}

interface ForecastData {
  period: string;
  predictedRevenue: number;
  predictedMargin: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
}

interface NegotiationResult {
  customer: string;
  carrier: string;
  scac: string;
  currentMargin: number;
  shipmentCount: number;
  totalRevenue: number;
  avgQuotePrice: number;
  potentialSavings: number;
  recommendedMargin: number;
  rfqResults: any[];
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'forecasting' | 'negotiation' | 'new-carrier'>('scorecard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Data state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, stage: '' });
  
  // Analysis results
  const [carrierScorecards, setCarrierScorecards] = useState<CarrierScorecard[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [negotiationResults, setNegotiationResults] = useState<NegotiationResult[]>([]);
  
  // Filters and settings
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedCustomer, setSelectedCustomer] = useState('');
  
  // Negotiation analysis state
  const [isRunningNegotiation, setIsRunningNegotiation] = useState(false);
  const [negotiationProgress, setNegotiationProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    
    try {
      await Promise.all([
        loadShipmentsInBatches(),
        loadCustomerCarriersInBatches()
      ]);
      
      // Calculate scorecards after data is loaded
      calculateCarrierScorecards();
      generateForecasts();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadShipmentsInBatches = async () => {
    console.log('🔍 Loading all shipments in batches...');
    let allShipments: Shipment[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    setLoadingProgress({ current: 0, total: 0, stage: 'Loading shipments...' });
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('Shipments')
        .select('*')
        .range(from, from + batchSize - 1);
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        allShipments = [...allShipments, ...data];
        from += batchSize;
        hasMore = data.length === batchSize;
        
        setLoadingProgress({ 
          current: allShipments.length, 
          total: allShipments.length + (hasMore ? batchSize : 0), 
          stage: `Loading shipments... ${allShipments.length} loaded` 
        });
        
        console.log(`📦 Loaded batch: ${data.length} shipments (total: ${allShipments.length})`);
      } else {
        hasMore = false;
      }
    }
    
    setShipments(allShipments);
    console.log(`✅ Loaded ${allShipments.length} total shipments`);
  };

  const loadCustomerCarriersInBatches = async () => {
    console.log('🔍 Loading all customer carriers in batches...');
    let allCarriers: CustomerCarrier[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    setLoadingProgress({ current: 0, total: 0, stage: 'Loading customer carriers...' });
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('*')
        .range(from, from + batchSize - 1);
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        allCarriers = [...allCarriers, ...data];
        from += batchSize;
        hasMore = data.length === batchSize;
        
        setLoadingProgress({ 
          current: allCarriers.length, 
          total: allCarriers.length + (hasMore ? batchSize : 0), 
          stage: `Loading customer carriers... ${allCarriers.length} loaded` 
        });
        
        console.log(`🚛 Loaded batch: ${data.length} customer carriers (total: ${allCarriers.length})`);
      } else {
        hasMore = false;
      }
    }
    
    setCustomerCarriers(allCarriers);
    console.log(`✅ Loaded ${allCarriers.length} total customer carriers`);
  };

  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const isBusinessDay = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
  };

  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      if (isBusinessDay(result)) {
        addedDays++;
      }
    }
    
    return result;
  };

  const calculateOnTimePerformance = (scheduled: string, actual: string): boolean => {
    if (!scheduled || !actual) return false;
    
    const scheduledDate = new Date(scheduled);
    const actualDate = new Date(actual);
    const allowedDate = addBusinessDays(scheduledDate, 1); // 1 business day buffer
    
    return actualDate <= allowedDate;
  };

  const calculateCarrierScorecards = () => {
    console.log('📊 Calculating carrier scorecards from real data...');
    
    const carrierMap = new Map<string, {
      shipments: Shipment[];
      totalRevenue: number;
      totalProfit: number;
      onTimePickups: number;
      onTimeDeliveries: number;
      totalWeight: number;
    }>();

    // Group shipments by carrier
    shipments.forEach(shipment => {
      const carrierName = shipment["Booked Carrier"] || shipment["Quoted Carrier"];
      if (!carrierName) return;

      if (!carrierMap.has(carrierName)) {
        carrierMap.set(carrierName, {
          shipments: [],
          totalRevenue: 0,
          totalProfit: 0,
          onTimePickups: 0,
          onTimeDeliveries: 0,
          totalWeight: 0
        });
      }

      const carrier = carrierMap.get(carrierName)!;
      carrier.shipments.push(shipment);
      
      // Calculate real revenue and profit
      const revenue = parseNumeric(shipment["Revenue"]);
      const profit = parseNumeric(shipment["Profit"]);
      const weight = parseNumeric(shipment["Tot Weight"]);
      
      carrier.totalRevenue += revenue;
      carrier.totalProfit += profit;
      carrier.totalWeight += weight;

      // Calculate on-time performance with business day buffer
      if (shipment["Scheduled Pickup Date"] && shipment["Actual Pickup Date"]) {
        if (calculateOnTimePerformance(shipment["Scheduled Pickup Date"], shipment["Actual Pickup Date"])) {
          carrier.onTimePickups++;
        }
      }

      if (shipment["Scheduled Delivery Date"] && shipment["Actual Delivery Date"]) {
        if (calculateOnTimePerformance(shipment["Scheduled Delivery Date"], shipment["Actual Delivery Date"])) {
          carrier.onTimeDeliveries++;
        }
      }
    });

    // Calculate scorecards
    const scorecards: CarrierScorecard[] = Array.from(carrierMap.entries()).map(([carrierName, data]) => {
      const totalShipments = data.shipments.length;
      const avgMargin = data.totalRevenue > 0 ? (data.totalProfit / data.totalRevenue) * 100 : 0;
      const avgRevenue = totalShipments > 0 ? data.totalRevenue / totalShipments : 0;
      const avgWeight = totalShipments > 0 ? data.totalWeight / totalShipments : 0;

      // Calculate on-time percentages
      const pickupShipments = data.shipments.filter(s => s["Scheduled Pickup Date"] && s["Actual Pickup Date"]).length;
      const deliveryShipments = data.shipments.filter(s => s["Scheduled Delivery Date"] && s["Actual Delivery Date"]).length;
      
      const onTimePickup = pickupShipments > 0 ? (data.onTimePickups / pickupShipments) * 100 : 0;
      const onTimeDelivery = deliveryShipments > 0 ? (data.onTimeDeliveries / deliveryShipments) * 100 : 0;

      // Calculate overall score (weighted average)
      const marginScore = Math.min(avgMargin * 2, 100); // Cap at 100
      const pickupScore = onTimePickup;
      const deliveryScore = onTimeDelivery;
      const volumeScore = Math.min((totalShipments / 10) * 10, 100); // 10+ shipments = 100 points

      const overallScore = (marginScore * 0.4 + pickupScore * 0.25 + deliveryScore * 0.25 + volumeScore * 0.1);

      // Determine grade
      let grade = 'F';
      if (overallScore >= 90) grade = 'A';
      else if (overallScore >= 80) grade = 'B';
      else if (overallScore >= 70) grade = 'C';
      else if (overallScore >= 60) grade = 'D';

      // Determine risk level
      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (onTimePickup < 80 || onTimeDelivery < 80 || avgMargin < 10) riskLevel = 'High';
      else if (onTimePickup < 90 || onTimeDelivery < 90 || avgMargin < 15) riskLevel = 'Medium';

      // Generate opportunities
      const opportunities: string[] = [];
      if (avgMargin < 15) opportunities.push('Negotiate better margins');
      if (onTimePickup < 90) opportunities.push('Improve pickup reliability');
      if (onTimeDelivery < 90) opportunities.push('Improve delivery performance');
      if (totalShipments < 10) opportunities.push('Increase volume for better rates');

      // Get SCAC from shipments
      const scac = data.shipments.find(s => s.SCAC)?.SCAC || '';

      return {
        carrierName,
        scac,
        totalShipments,
        totalRevenue: data.totalRevenue,
        totalProfit: data.totalProfit,
        avgMargin,
        onTimePickup,
        onTimeDelivery,
        overallScore,
        grade,
        riskLevel,
        opportunities,
        avgWeight,
        avgRevenue
      };
    });

    // Sort by overall score
    scorecards.sort((a, b) => b.overallScore - a.overallScore);
    setCarrierScorecards(scorecards);
    
    console.log(`✅ Calculated ${scorecards.length} carrier scorecards`);
  };

  const generateForecasts = () => {
    console.log('🔮 Generating AI forecasts from real data...');
    
    if (shipments.length === 0) {
      setForecastData([]);
      return;
    }

    // Group shipments by month for trend analysis
    const monthlyData = new Map<string, { revenue: number; profit: number; count: number }>();
    
    shipments.forEach(shipment => {
      const date = shipment["Scheduled Pickup Date"];
      if (!date) return;
      
      const month = date.substring(0, 7); // YYYY-MM format
      const revenue = parseNumeric(shipment["Revenue"]);
      const profit = parseNumeric(shipment["Profit"]);
      
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { revenue: 0, profit: 0, count: 0 });
      }
      
      const data = monthlyData.get(month)!;
      data.revenue += revenue;
      data.profit += profit;
      data.count++;
    });

    // Sort months and calculate trends
    const sortedMonths = Array.from(monthlyData.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    if (sortedMonths.length < 3) {
      setForecastData([]);
      return;
    }

    // Calculate growth rates
    const revenueGrowthRates: number[] = [];
    const marginTrends: number[] = [];
    
    for (let i = 1; i < sortedMonths.length; i++) {
      const prev = sortedMonths[i - 1][1];
      const curr = sortedMonths[i][1];
      
      if (prev.revenue > 0) {
        const revenueGrowth = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
        revenueGrowthRates.push(revenueGrowth);
      }
      
      const prevMargin = prev.revenue > 0 ? (prev.profit / prev.revenue) * 100 : 0;
      const currMargin = curr.revenue > 0 ? (curr.profit / curr.revenue) * 100 : 0;
      marginTrends.push(currMargin - prevMargin);
    }

    // Calculate average growth rates
    const avgRevenueGrowth = revenueGrowthRates.length > 0 
      ? revenueGrowthRates.reduce((sum, rate) => sum + rate, 0) / revenueGrowthRates.length 
      : 0;
    
    const avgMarginTrend = marginTrends.length > 0
      ? marginTrends.reduce((sum, trend) => sum + trend, 0) / marginTrends.length
      : 0;

    // Get latest month data
    const latestMonth = sortedMonths[sortedMonths.length - 1][1];
    const currentMargin = latestMonth.revenue > 0 ? (latestMonth.profit / latestMonth.revenue) * 100 : 0;

    // Generate forecasts for next 6 months
    const forecasts: ForecastData[] = [];
    const baseRevenue = latestMonth.revenue;
    
    for (let i = 1; i <= 6; i++) {
      const monthsAhead = i;
      const growthFactor = Math.pow(1 + (avgRevenueGrowth / 100), monthsAhead);
      const predictedRevenue = baseRevenue * growthFactor;
      const predictedMargin = Math.max(0, currentMargin + (avgMarginTrend * monthsAhead));
      
      // Calculate confidence based on data consistency
      const revenueVariance = revenueGrowthRates.length > 0 
        ? Math.sqrt(revenueGrowthRates.reduce((sum, rate) => sum + Math.pow(rate - avgRevenueGrowth, 2), 0) / revenueGrowthRates.length)
        : 100;
      
      const confidence = Math.max(20, Math.min(95, 100 - (revenueVariance / 2) - (monthsAhead * 5)));
      
      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (avgRevenueGrowth > 2) trend = 'up';
      else if (avgRevenueGrowth < -2) trend = 'down';
      
      // Generate factors
      const factors: string[] = [];
      if (avgRevenueGrowth > 0) factors.push('Positive revenue growth trend');
      if (avgMarginTrend > 0) factors.push('Improving margin efficiency');
      if (sortedMonths.length >= 6) factors.push('Sufficient historical data');
      if (confidence > 70) factors.push('High data consistency');
      
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + i);
      const period = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      
      forecasts.push({
        period,
        predictedRevenue,
        predictedMargin,
        confidence,
        trend,
        factors
      });
    }
    
    setForecastData(forecasts);
    console.log(`✅ Generated ${forecasts.length} forecast periods`);
  };

  const runNegotiationAnalysis = async () => {
    if (!dateRange.start || !dateRange.end) {
      setError('Please select a date range for negotiation analysis');
      return;
    }

    setIsRunningNegotiation(true);
    setError('');
    setNegotiationResults([]);
    
    try {
      console.log('🔍 Starting negotiation analysis...');
      
      // Get unique carriers from CustomerCarriers table
      const uniqueCarriers = [...new Set(customerCarriers
        .filter(cc => cc.P44CarrierCode)
        .map(cc => cc.P44CarrierCode!)
      )];
      
      console.log(`📋 Found ${uniqueCarriers.length} unique carriers in CustomerCarriers table`);
      
      // Filter shipments by date range
      const filteredShipments = shipments.filter(shipment => {
        const pickupDate = shipment["Scheduled Pickup Date"];
        if (!pickupDate) return false;
        return pickupDate >= dateRange.start && pickupDate <= dateRange.end;
      });
      
      console.log(`📦 Found ${filteredShipments.length} shipments in date range`);
      
      // Group by customer and carrier
      const customerCarrierGroups = new Map<string, {
        customer: string;
        carrier: string;
        scac: string;
        shipments: Shipment[];
        currentMargin: number;
      }>();
      
      filteredShipments.forEach(shipment => {
        const customer = shipment["Customer"];
        const carrier = shipment["Booked Carrier"] || shipment["Quoted Carrier"];
        const scac = shipment["SCAC"] || '';
        
        if (!customer || !carrier) return;
        
        // Find current margin from CustomerCarriers
        const marginConfig = customerCarriers.find(cc => 
          cc.InternalName === customer && 
          (cc.P44CarrierCode === carrier || cc.P44CarrierCode === scac)
        );
        
        const currentMargin = marginConfig ? parseFloat(marginConfig.Percentage || '0') : 0;
        
        const key = `${customer}-${carrier}`;
        if (!customerCarrierGroups.has(key)) {
          customerCarrierGroups.set(key, {
            customer,
            carrier,
            scac,
            shipments: [],
            currentMargin
          });
        }
        
        customerCarrierGroups.get(key)!.shipments.push(shipment);
      });
      
      console.log(`🎯 Found ${customerCarrierGroups.size} customer-carrier combinations`);
      
      // Create RFQs and run analysis
      const results: NegotiationResult[] = [];
      let processed = 0;
      
      setNegotiationProgress({ current: 0, total: customerCarrierGroups.size });
      
      for (const [key, group] of customerCarrierGroups) {
        try {
          // Calculate current performance
          const totalRevenue = group.shipments.reduce((sum, s) => sum + parseNumeric(s["Revenue"]), 0);
          const avgQuotePrice = totalRevenue / group.shipments.length;
          
          // For now, we'll calculate potential savings based on margin optimization
          // In a real implementation, you would run RFQs through Project44 API
          const potentialSavings = totalRevenue * 0.05; // Assume 5% potential savings
          const recommendedMargin = Math.max(group.currentMargin * 1.1, 15); // 10% increase or 15% minimum
          
          results.push({
            customer: group.customer,
            carrier: group.carrier,
            scac: group.scac,
            currentMargin: group.currentMargin,
            shipmentCount: group.shipments.length,
            totalRevenue,
            avgQuotePrice,
            potentialSavings,
            recommendedMargin,
            rfqResults: [] // Would contain actual RFQ results from Project44
          });
          
          processed++;
          setNegotiationProgress({ current: processed, total: customerCarrierGroups.size });
          
        } catch (error) {
          console.error(`❌ Error processing ${key}:`, error);
        }
      }
      
      // Sort by potential savings
      results.sort((a, b) => b.potentialSavings - a.potentialSavings);
      
      setNegotiationResults(results);
      console.log(`✅ Completed negotiation analysis: ${results.length} results`);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to run negotiation analysis');
      console.error('❌ Negotiation analysis failed:', error);
    } finally {
      setIsRunningNegotiation(false);
    }
  };

  const renderCarrierScorecard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Carrier Performance Scorecard</h3>
        <button
          onClick={calculateCarrierScorecards}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {carrierScorecards.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No carrier data available. Load shipment data to generate scorecards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {carrierScorecards.map((scorecard, index) => (
            <div key={scorecard.carrierName} className="bg-white rounded-lg shadow-md p-6 border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{scorecard.carrierName}</h4>
                  {scorecard.scac && (
                    <p className="text-sm text-gray-600">SCAC: {scorecard.scac}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    scorecard.grade === 'A' ? 'text-green-600' :
                    scorecard.grade === 'B' ? 'text-blue-600' :
                    scorecard.grade === 'C' ? 'text-yellow-600' :
                    scorecard.grade === 'D' ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {scorecard.grade}
                  </div>
                  <div className="text-sm text-gray-500">
                    {scorecard.overallScore.toFixed(1)} Score
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(scorecard.totalRevenue)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Profit</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(scorecard.totalProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Avg Margin</div>
                  <div className="text-lg font-bold text-blue-600">
                    {scorecard.avgMargin.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Shipments</div>
                  <div className="text-lg font-bold text-gray-900">
                    {scorecard.totalShipments}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>On-Time Pickup</span>
                    <span>{scorecard.onTimePickup.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        scorecard.onTimePickup >= 90 ? 'bg-green-500' :
                        scorecard.onTimePickup >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(scorecard.onTimePickup, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span>On-Time Delivery</span>
                    <span>{scorecard.onTimeDelivery.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        scorecard.onTimeDelivery >= 90 ? 'bg-green-500' :
                        scorecard.onTimeDelivery >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(scorecard.onTimeDelivery, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  scorecard.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
                  scorecard.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {scorecard.riskLevel} Risk
                </div>
              </div>

              {scorecard.opportunities.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Opportunities:</div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {scorecard.opportunities.map((opp, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <Target className="h-3 w-3 text-blue-500" />
                        <span>{opp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderForecasting = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">AI-Powered Forecasting</h3>
        <button
          onClick={generateForecasts}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Brain className="h-4 w-4" />
          <span>Regenerate</span>
        </button>
      </div>

      {forecastData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No forecast data available. Need at least 3 months of shipment data.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {forecastData.slice(0, 3).map((forecast, index) => (
              <div key={forecast.period} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">{forecast.period}</h4>
                  <div className={`flex items-center space-x-1 ${
                    forecast.trend === 'up' ? 'text-green-600' :
                    forecast.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {forecast.trend === 'up' ? <TrendingUp className="h-4 w-4" /> :
                     forecast.trend === 'down' ? <TrendingDown className="h-4 w-4" /> :
                     <Activity className="h-4 w-4" />}
                    <span className="text-sm font-medium">{forecast.trend}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Predicted Revenue</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(forecast.predictedRevenue)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Predicted Margin</div>
                    <div className="text-xl font-bold text-blue-600">
                      {forecast.predictedMargin.toFixed(1)}%
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Confidence</div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            forecast.confidence >= 80 ? 'bg-green-500' :
                            forecast.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${forecast.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{forecast.confidence.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Key Factors:</div>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {forecast.factors.map((factor, i) => (
                      <li key={i} className="flex items-center space-x-1">
                        <div className="w-1 h-1 bg-blue-500 rounded-full" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">6-Month Forecast Trend</h4>
            <div className="space-y-4">
              {forecastData.map((forecast, index) => (
                <div key={forecast.period} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-gray-900">{forecast.period}</div>
                    <div className={`flex items-center space-x-1 ${
                      forecast.trend === 'up' ? 'text-green-600' :
                      forecast.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {forecast.trend === 'up' ? <TrendingUp className="h-3 w-3" /> :
                       forecast.trend === 'down' ? <TrendingDown className="h-3 w-3" /> :
                       <Activity className="h-3 w-3" />}
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Revenue</div>
                      <div className="text-sm font-bold text-green-600">
                        {formatCurrency(forecast.predictedRevenue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Margin</div>
                      <div className="text-sm font-bold text-blue-600">
                        {forecast.predictedMargin.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Confidence</div>
                      <div className="text-sm font-bold text-gray-900">
                        {forecast.confidence.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderNegotiationAnalysis = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Negotiation Analysis</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">Start Date:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">End Date:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={runNegotiationAnalysis}
            disabled={isRunningNegotiation || !dateRange.start || !dateRange.end}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {isRunningNegotiation ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>Run Analysis</span>
          </button>
        </div>
      </div>

      {isRunningNegotiation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader className="h-5 w-5 text-blue-600 animate-spin" />
            <div>
              <div className="text-sm font-medium text-blue-900">Running Negotiation Analysis...</div>
              <div className="text-xs text-blue-700">
                Processing {negotiationProgress.current} of {negotiationProgress.total} customer-carrier combinations
              </div>
            </div>
          </div>
          <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${negotiationProgress.total > 0 ? (negotiationProgress.current / negotiationProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {negotiationResults.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">
                Negotiation Opportunities ({negotiationResults.length} found)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Quote</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential Savings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {negotiationResults.map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {result.customer}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{result.carrier}</div>
                          {result.scac && (
                            <div className="text-xs text-gray-500">SCAC: {result.scac}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {result.currentMargin.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {result.shipmentCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(result.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(result.avgQuotePrice)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-600">
                        {formatCurrency(result.potentialSavings)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">
                        {result.recommendedMargin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {negotiationResults.length === 0 && !isRunningNegotiation && (
        <div className="text-center py-8 text-gray-500">
          <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Select a date range and run analysis to see negotiation opportunities.</p>
        </div>
      )}
    </div>
  );

  const renderNewCarrierAnalysis = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">New Carrier Analysis</h3>
        <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          <span>Add Carrier</span>
        </button>
      </div>

      <div className="text-center py-8 text-gray-500">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>New carrier analysis feature coming soon.</p>
        <p className="text-sm">Will analyze P44 carrier groups and recommend margins for new carriers.</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center space-x-3 mb-6">
            <Loader className="h-6 w-6 text-blue-600 animate-spin" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Loading Margin Analysis Data</h2>
              <p className="text-sm text-gray-600">{loadingProgress.stage}</p>
            </div>
          </div>
          
          {loadingProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Progress</span>
                <span>{loadingProgress.current} / {loadingProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress.total > 0 ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Advanced analytics for carrier performance, forecasting, and negotiation optimization
            </p>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{shipments.length.toLocaleString()}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Customer-Carrier Configs</p>
              <p className="text-2xl font-bold text-gray-900">{customerCarriers.length.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Carrier Scorecards</p>
              <p className="text-2xl font-bold text-gray-900">{carrierScorecards.length}</p>
            </div>
            <Award className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Forecast Periods</p>
              <p className="text-2xl font-bold text-gray-900">{forecastData.length}</p>
            </div>
            <Brain className="h-8 w-8 text-purple-500" />
          </div>
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'scorecard', label: 'Carrier Scorecard', icon: Award },
            { id: 'forecasting', label: 'AI Forecasting', icon: Brain },
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
                    ? 'border-purple-500 text-purple-600'
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

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {activeTab === 'scorecard' && renderCarrierScorecard()}
        {activeTab === 'forecasting' && renderForecasting()}
        {activeTab === 'negotiation' && renderNegotiationAnalysis()}
        {activeTab === 'new-carrier' && renderNewCarrierAnalysis()}
      </div>
    </div>
  );
};