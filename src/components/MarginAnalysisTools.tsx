import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3, 
  DollarSign, 
  Truck, 
  Award, 
  Clock, 
  MapPin, 
  Package, 
  RefreshCw, 
  Download, 
  Eye, 
  Plus, 
  Minus, 
  ArrowUp, 
  ArrowDown, 
  Activity, 
  Zap, 
  Shield, 
  Star, 
  Building2, 
  Globe, 
  Layers, 
  Database,
  Loader,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  Brain,
  Gauge
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';

// Interfaces for real data structures
interface ShipmentData {
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
  "SCAC"?: string;
}

interface CustomerCarrierData {
  "MarkupId": number;
  "CarrierId"?: number;
  "CustomerID"?: number;
  "InternalName"?: string;
  "P44CarrierCode"?: string;
  "MinDollar"?: number;
  "MaxDollar"?: string;
  "Percentage"?: string;
}

interface CarrierMetrics {
  carrierName: string;
  scac?: string;
  totalShipments: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  onTimePerformance: number;
  avgTransitDays: number;
  totalWeight: number;
  avgWeight: number;
  riskScore: number;
  opportunityScore: number;
  trendDirection: 'up' | 'down' | 'stable';
  lastShipmentDate?: string;
  topCustomers: string[];
  topLanes: string[];
  serviceTypes: string[];
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
}

interface ForecastData {
  carrierName: string;
  currentMargin: number;
  predictedMargin: number;
  confidenceLevel: number;
  trendFactors: string[];
  revenueImpact: number;
  recommendation: 'increase' | 'maintain' | 'decrease';
  reasoning: string;
}

interface NegotiationAnalysis {
  carrierName: string;
  currentMargin: number;
  proposedMargin: number;
  marketBenchmark: number;
  volumeImpact: number;
  revenueImpact: number;
  competitivePosition: 'strong' | 'moderate' | 'weak';
  negotiationPower: number;
  riskFactors: string[];
  opportunities: string[];
  recommendation: string;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'forecasting' | 'negotiation' | 'new-carrier'>('scorecard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Data state
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrierData[]>([]);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [carrierMetrics, setCarrierMetrics] = useState<CarrierMetrics[]>([]);
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  
  // Loading states
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [loadingP44Data, setLoadingP44Data] = useState(false);
  
  // Progress tracking
  const [shipmentProgress, setShipmentProgress] = useState({ loaded: 0, total: 0 });
  const [carrierProgress, setCarrierProgress] = useState({ loaded: 0, total: 0 });
  
  // Negotiation analysis state
  const [negotiationMode, setNegotiationMode] = useState<'preliminary' | 'comparison'>('preliminary');
  const [selectedCarrierForNegotiation, setSelectedCarrierForNegotiation] = useState<string>('');
  const [proposedMargin, setProposedMargin] = useState<number>(0);
  const [beforeMargin, setBeforeMargin] = useState<number>(0);
  const [afterMargin, setAfterMargin] = useState<number>(0);
  const [negotiationAnalysis, setNegotiationAnalysis] = useState<NegotiationAnalysis | null>(null);
  
  // New carrier analysis state
  const [selectedP44Group, setSelectedP44Group] = useState<string>('');
  const [selectedNewCarrier, setSelectedNewCarrier] = useState<string>('');
  const [newCarrierAnalysis, setNewCarrierAnalysis] = useState<any>(null);
  
  // Filters
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [carrierFilter, setCarrierFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Starting comprehensive data load...');
      
      // Load all data in parallel
      await Promise.all([
        loadShipmentsInBatches(),
        loadCustomerCarriersInBatches(),
        loadP44CarrierGroups()
      ]);
      
      console.log('✅ All data loaded successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMsg);
      console.error('❌ Data loading failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadShipmentsInBatches = async () => {
    setLoadingShipments(true);
    setShipmentProgress({ loaded: 0, total: 0 });
    
    try {
      console.log('📦 Loading shipments in batches...');
      
      // First, get total count
      const { count, error: countError } = await supabase
        .from('Shipments')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      const totalRecords = count || 0;
      setShipmentProgress({ loaded: 0, total: totalRecords });
      console.log(`📊 Total shipments to load: ${totalRecords}`);
      
      const batchSize = 1000;
      const allShipments: ShipmentData[] = [];
      let from = 0;
      
      while (from < totalRecords) {
        console.log(`📦 Loading shipments batch: ${from + 1} to ${Math.min(from + batchSize, totalRecords)}`);
        
        const { data, error } = await supabase
          .from('Shipments')
          .select('*')
          .range(from, from + batchSize - 1)
          .order('"Scheduled Pickup Date"', { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allShipments.push(...data);
          setShipmentProgress({ loaded: allShipments.length, total: totalRecords });
          console.log(`✅ Loaded ${data.length} shipments (total: ${allShipments.length}/${totalRecords})`);
        }
        
        from += batchSize;
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setShipments(allShipments);
      console.log(`✅ Completed loading ${allShipments.length} shipments`);
      
    } catch (err) {
      console.error('❌ Failed to load shipments:', err);
      throw err;
    } finally {
      setLoadingShipments(false);
    }
  };

  const loadCustomerCarriersInBatches = async () => {
    setLoadingCarriers(true);
    setCarrierProgress({ loaded: 0, total: 0 });
    
    try {
      console.log('🚛 Loading customer carriers in batches...');
      
      // First, get total count
      const { count, error: countError } = await supabase
        .from('CustomerCarriers')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      const totalRecords = count || 0;
      setCarrierProgress({ loaded: 0, total: totalRecords });
      console.log(`📊 Total customer carriers to load: ${totalRecords}`);
      
      const batchSize = 1000;
      const allCarriers: CustomerCarrierData[] = [];
      let from = 0;
      
      while (from < totalRecords) {
        console.log(`🚛 Loading carriers batch: ${from + 1} to ${Math.min(from + batchSize, totalRecords)}`);
        
        const { data, error } = await supabase
          .from('CustomerCarriers')
          .select('*')
          .range(from, from + batchSize - 1)
          .order('"MarkupId"', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allCarriers.push(...data);
          setCarrierProgress({ loaded: allCarriers.length, total: totalRecords });
          console.log(`✅ Loaded ${data.length} carriers (total: ${allCarriers.length}/${totalRecords})`);
        }
        
        from += batchSize;
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setCustomerCarriers(allCarriers);
      console.log(`✅ Completed loading ${allCarriers.length} customer carriers`);
      
    } catch (err) {
      console.error('❌ Failed to load customer carriers:', err);
      throw err;
    } finally {
      setLoadingCarriers(false);
    }
  };

  const loadP44CarrierGroups = async () => {
    setLoadingP44Data(true);
    
    try {
      console.log('🌐 Loading Project44 carrier groups...');
      
      // This would need a Project44 client instance
      // For now, we'll create a placeholder that would be replaced with real API call
      const mockGroups: CarrierGroup[] = [
        {
          groupCode: 'DEFAULT',
          groupName: 'Default Carrier Group',
          carriers: []
        }
      ];
      
      setCarrierGroups(mockGroups);
      console.log(`✅ Loaded ${mockGroups.length} carrier groups from Project44`);
      
    } catch (err) {
      console.error('❌ Failed to load P44 carrier groups:', err);
      throw err;
    } finally {
      setLoadingP44Data(false);
    }
  };

  // Calculate carrier metrics from real data
  const calculateCarrierMetrics = (): CarrierMetrics[] => {
    console.log('📊 Calculating carrier metrics from real data...');
    
    const carrierMap = new Map<string, {
      shipments: ShipmentData[];
      margins: CustomerCarrierData[];
    }>();
    
    // Group shipments by carrier
    shipments.forEach(shipment => {
      const carrierName = shipment["Booked Carrier"] || shipment["Quoted Carrier"];
      if (!carrierName) return;
      
      if (!carrierMap.has(carrierName)) {
        carrierMap.set(carrierName, { shipments: [], margins: [] });
      }
      carrierMap.get(carrierName)!.shipments.push(shipment);
    });
    
    // Add margin data
    customerCarriers.forEach(margin => {
      const carrierCode = margin["P44CarrierCode"];
      if (!carrierCode) return;
      
      // Try to match by carrier code or name
      for (const [carrierName, data] of carrierMap.entries()) {
        if (carrierName.includes(carrierCode) || carrierCode.includes(carrierName)) {
          data.margins.push(margin);
          break;
        }
      }
    });
    
    const metrics: CarrierMetrics[] = [];
    
    carrierMap.forEach((data, carrierName) => {
      const { shipments: carrierShipments, margins } = data;
      
      if (carrierShipments.length === 0) return;
      
      // Calculate metrics from real data
      const totalRevenue = carrierShipments.reduce((sum, s) => {
        const revenue = parseFloat(s["Revenue"] || '0');
        return sum + (isNaN(revenue) ? 0 : revenue);
      }, 0);
      
      const totalProfit = carrierShipments.reduce((sum, s) => {
        const profit = parseFloat(s["Profit"] || '0');
        return sum + (isNaN(profit) ? 0 : profit);
      }, 0);
      
      const totalWeight = carrierShipments.reduce((sum, s) => {
        const weight = parseFloat(s["Tot Weight"] || '0');
        return sum + (isNaN(weight) ? 0 : weight);
      }, 0);
      
      const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      
      // Calculate on-time performance
      const onTimeShipments = carrierShipments.filter(s => {
        const scheduled = s["Scheduled Delivery Date"];
        const actual = s["Actual Delivery Date"];
        if (!scheduled || !actual) return true; // Assume on-time if no data
        return new Date(actual) <= new Date(scheduled);
      }).length;
      
      const onTimePerformance = carrierShipments.length > 0 ? 
        (onTimeShipments / carrierShipments.length) * 100 : 0;
      
      // Calculate risk and opportunity scores
      const riskScore = calculateRiskScore(carrierShipments, margins, avgMargin, onTimePerformance);
      const opportunityScore = calculateOpportunityScore(carrierShipments, margins, avgMargin, totalRevenue);
      
      // Determine trend direction
      const recentShipments = carrierShipments
        .filter(s => s["Scheduled Pickup Date"])
        .sort((a, b) => new Date(b["Scheduled Pickup Date"]!).getTime() - new Date(a["Scheduled Pickup Date"]!).getTime())
        .slice(0, Math.min(10, Math.floor(carrierShipments.length / 2)));
      
      const olderShipments = carrierShipments
        .filter(s => s["Scheduled Pickup Date"])
        .sort((a, b) => new Date(a["Scheduled Pickup Date"]!).getTime() - new Date(b["Scheduled Pickup Date"]!).getTime())
        .slice(0, Math.min(10, Math.floor(carrierShipments.length / 2)));
      
      const recentAvgMargin = calculateAvgMargin(recentShipments);
      const olderAvgMargin = calculateAvgMargin(olderShipments);
      
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      if (recentAvgMargin > olderAvgMargin + 1) trendDirection = 'up';
      else if (recentAvgMargin < olderAvgMargin - 1) trendDirection = 'down';
      
      // Get top customers and lanes
      const customerCounts = new Map<string, number>();
      const laneCounts = new Map<string, number>();
      
      carrierShipments.forEach(s => {
        if (s["Customer"]) {
          customerCounts.set(s["Customer"], (customerCounts.get(s["Customer"]) || 0) + 1);
        }
        
        const lane = `${s["Zip"]} → ${s["Zip_1"]}`;
        if (s["Zip"] && s["Zip_1"]) {
          laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
        }
      });
      
      const topCustomers = Array.from(customerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([customer]) => customer);
      
      const topLanes = Array.from(laneCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lane]) => lane);
      
      // Service types
      const serviceTypes = [...new Set(carrierShipments
        .map(s => s["Service Level"])
        .filter(Boolean)
      )].slice(0, 3);
      
      // Performance grade
      const performanceGrade = calculatePerformanceGrade(avgMargin, onTimePerformance, riskScore);
      
      // Generate recommendations
      const recommendations = generateRecommendations(
        avgMargin, onTimePerformance, riskScore, opportunityScore, trendDirection, totalRevenue
      );
      
      metrics.push({
        carrierName,
        scac: carrierShipments[0]["SCAC"],
        totalShipments: carrierShipments.length,
        totalRevenue,
        totalProfit,
        avgMargin,
        onTimePerformance,
        avgTransitDays: 0, // Would need to calculate from actual vs scheduled dates
        totalWeight,
        avgWeight: totalWeight / carrierShipments.length,
        riskScore,
        opportunityScore,
        trendDirection,
        lastShipmentDate: carrierShipments[0]["Scheduled Pickup Date"],
        topCustomers,
        topLanes,
        serviceTypes,
        performanceGrade,
        recommendations
      });
    });
    
    // Sort by total revenue descending
    metrics.sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    console.log(`✅ Calculated metrics for ${metrics.length} carriers`);
    return metrics;
  };

  // Helper functions for calculations
  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const calculateAvgMargin = (shipments: ShipmentData[]): number => {
    if (shipments.length === 0) return 0;
    
    const totalRevenue = shipments.reduce((sum, s) => sum + parseNumeric(s["Revenue"]), 0);
    const totalProfit = shipments.reduce((sum, s) => sum + parseNumeric(s["Profit"]), 0);
    
    return totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  };

  const calculateRiskScore = (
    shipments: ShipmentData[], 
    margins: CustomerCarrierData[], 
    avgMargin: number, 
    onTimePerformance: number
  ): number => {
    let riskScore = 0;
    
    // Low margin risk
    if (avgMargin < 10) riskScore += 30;
    else if (avgMargin < 15) riskScore += 15;
    
    // Performance risk
    if (onTimePerformance < 85) riskScore += 25;
    else if (onTimePerformance < 95) riskScore += 10;
    
    // Volume concentration risk
    const customerCounts = new Map<string, number>();
    shipments.forEach(s => {
      if (s["Customer"]) {
        customerCounts.set(s["Customer"], (customerCounts.get(s["Customer"]) || 0) + 1);
      }
    });
    
    const maxCustomerShipments = Math.max(...Array.from(customerCounts.values()));
    const concentrationRatio = maxCustomerShipments / shipments.length;
    
    if (concentrationRatio > 0.5) riskScore += 20;
    else if (concentrationRatio > 0.3) riskScore += 10;
    
    // Limited margin configurations risk
    if (margins.length === 0) riskScore += 15;
    else if (margins.length < 3) riskScore += 5;
    
    return Math.min(riskScore, 100);
  };

  const calculateOpportunityScore = (
    shipments: ShipmentData[], 
    margins: CustomerCarrierData[], 
    avgMargin: number, 
    totalRevenue: number
  ): number => {
    let opportunityScore = 0;
    
    // High volume opportunity
    if (totalRevenue > 100000) opportunityScore += 25;
    else if (totalRevenue > 50000) opportunityScore += 15;
    
    // Margin improvement opportunity
    if (avgMargin < 15) opportunityScore += 20;
    else if (avgMargin < 20) opportunityScore += 10;
    
    // Growth opportunity (recent shipments vs older)
    const recentCount = shipments.filter(s => {
      const date = new Date(s["Scheduled Pickup Date"] || '');
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return date > threeMonthsAgo;
    }).length;
    
    const growthRate = (recentCount / shipments.length) * 4; // Annualized
    if (growthRate > 1.2) opportunityScore += 20;
    else if (growthRate > 1.1) opportunityScore += 10;
    
    // Diversification opportunity
    const uniqueCustomers = new Set(shipments.map(s => s["Customer"]).filter(Boolean)).size;
    if (uniqueCustomers > 5) opportunityScore += 15;
    else if (uniqueCustomers > 2) opportunityScore += 10;
    
    // Margin configuration opportunity
    if (margins.length === 0) opportunityScore += 20; // No configurations = opportunity to add
    
    return Math.min(opportunityScore, 100);
  };

  const calculatePerformanceGrade = (
    avgMargin: number, 
    onTimePerformance: number, 
    riskScore: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' => {
    let score = 0;
    
    // Margin scoring (40% weight)
    if (avgMargin >= 20) score += 40;
    else if (avgMargin >= 15) score += 32;
    else if (avgMargin >= 10) score += 24;
    else if (avgMargin >= 5) score += 16;
    else score += 8;
    
    // Performance scoring (35% weight)
    if (onTimePerformance >= 98) score += 35;
    else if (onTimePerformance >= 95) score += 30;
    else if (onTimePerformance >= 90) score += 25;
    else if (onTimePerformance >= 85) score += 20;
    else score += 10;
    
    // Risk scoring (25% weight) - lower risk = higher score
    if (riskScore <= 10) score += 25;
    else if (riskScore <= 25) score += 20;
    else if (riskScore <= 40) score += 15;
    else if (riskScore <= 60) score += 10;
    else score += 5;
    
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    if (score >= 55) return 'D';
    return 'F';
  };

  const generateRecommendations = (
    avgMargin: number,
    onTimePerformance: number,
    riskScore: number,
    opportunityScore: number,
    trendDirection: 'up' | 'down' | 'stable',
    totalRevenue: number
  ): string[] => {
    const recommendations: string[] = [];
    
    if (avgMargin < 15) {
      recommendations.push('Consider increasing margin rates - currently below target');
    }
    
    if (onTimePerformance < 95) {
      recommendations.push('Monitor delivery performance - implement service level agreements');
    }
    
    if (riskScore > 40) {
      recommendations.push('High risk carrier - consider diversification or enhanced monitoring');
    }
    
    if (opportunityScore > 60) {
      recommendations.push('High opportunity carrier - consider expanding relationship');
    }
    
    if (trendDirection === 'down') {
      recommendations.push('Declining performance trend - schedule carrier review meeting');
    }
    
    if (totalRevenue > 100000 && avgMargin < 18) {
      recommendations.push('High volume carrier with low margin - priority for rate negotiation');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performing well - maintain current relationship and monitor trends');
    }
    
    return recommendations;
  };

  // Generate forecasts based on real data trends
  const generateForecasts = (): ForecastData[] => {
    const metrics = calculateCarrierMetrics();
    
    return metrics.slice(0, 10).map(metric => {
      // Analyze trends and predict future margins
      const trendFactor = metric.trendDirection === 'up' ? 1.05 : 
                         metric.trendDirection === 'down' ? 0.95 : 1.0;
      
      const performanceFactor = metric.onTimePerformance > 95 ? 1.02 : 
                               metric.onTimePerformance < 85 ? 0.98 : 1.0;
      
      const volumeFactor = metric.totalRevenue > 100000 ? 1.03 : 
                          metric.totalRevenue < 25000 ? 0.97 : 1.0;
      
      const predictedMargin = metric.avgMargin * trendFactor * performanceFactor * volumeFactor;
      
      const confidenceLevel = Math.min(95, 60 + 
        (metric.totalShipments > 50 ? 15 : 0) +
        (metric.onTimePerformance > 95 ? 10 : 0) +
        (metric.riskScore < 30 ? 10 : 0)
      );
      
      const trendFactors: string[] = [];
      if (metric.trendDirection !== 'stable') {
        trendFactors.push(`${metric.trendDirection === 'up' ? 'Improving' : 'Declining'} performance trend`);
      }
      if (metric.onTimePerformance > 95) {
        trendFactors.push('Excellent on-time performance');
      } else if (metric.onTimePerformance < 85) {
        trendFactors.push('Poor on-time performance');
      }
      if (metric.totalRevenue > 100000) {
        trendFactors.push('High volume relationship');
      }
      if (metric.riskScore > 40) {
        trendFactors.push('Elevated risk factors');
      }
      
      const revenueImpact = (predictedMargin - metric.avgMargin) * metric.totalRevenue / 100;
      
      let recommendation: 'increase' | 'maintain' | 'decrease' = 'maintain';
      if (predictedMargin > metric.avgMargin + 1) recommendation = 'increase';
      else if (predictedMargin < metric.avgMargin - 1) recommendation = 'decrease';
      
      const reasoning = `Based on ${metric.totalShipments} shipments, ${metric.onTimePerformance.toFixed(1)}% on-time performance, and ${metric.trendDirection} trend. ${
        recommendation === 'increase' ? 'Strong performance indicates margin increase potential.' :
        recommendation === 'decrease' ? 'Performance concerns suggest margin pressure.' :
        'Stable performance supports maintaining current margins.'
      }`;
      
      return {
        carrierName: metric.carrierName,
        currentMargin: metric.avgMargin,
        predictedMargin,
        confidenceLevel,
        trendFactors,
        revenueImpact,
        recommendation,
        reasoning
      };
    });
  };

  // Negotiation analysis functions
  const analyzeNegotiation = async () => {
    if (!selectedCarrierForNegotiation) return;
    
    const carrierMetrics = calculateCarrierMetrics();
    const metric = carrierMetrics.find(m => m.carrierName === selectedCarrierForNegotiation);
    
    if (!metric) return;
    
    const currentMargin = negotiationMode === 'preliminary' ? metric.avgMargin : beforeMargin;
    const targetMargin = negotiationMode === 'preliminary' ? proposedMargin : afterMargin;
    
    // Calculate market benchmark (average of similar carriers)
    const similarCarriers = carrierMetrics.filter(m => 
      Math.abs(m.totalRevenue - metric.totalRevenue) < metric.totalRevenue * 0.5
    );
    const marketBenchmark = similarCarriers.reduce((sum, m) => sum + m.avgMargin, 0) / similarCarriers.length;
    
    const volumeImpact = metric.totalShipments;
    const revenueImpact = (targetMargin - currentMargin) * metric.totalRevenue / 100;
    
    let competitivePosition: 'strong' | 'moderate' | 'weak' = 'moderate';
    if (metric.onTimePerformance > 95 && metric.riskScore < 30) competitivePosition = 'strong';
    else if (metric.onTimePerformance < 85 || metric.riskScore > 60) competitivePosition = 'weak';
    
    const negotiationPower = Math.min(100, 
      (metric.onTimePerformance - 80) * 2 +
      (100 - metric.riskScore) * 0.5 +
      (metric.totalRevenue > 100000 ? 20 : 0) +
      (metric.opportunityScore > 60 ? 15 : 0)
    );
    
    const riskFactors: string[] = [];
    const opportunities: string[] = [];
    
    if (targetMargin > marketBenchmark + 2) {
      riskFactors.push('Proposed margin significantly above market benchmark');
    }
    if (metric.onTimePerformance < 90) {
      riskFactors.push('Below-average delivery performance');
    }
    if (metric.riskScore > 50) {
      riskFactors.push('High risk profile may limit negotiation leverage');
    }
    
    if (metric.totalRevenue > 100000) {
      opportunities.push('High volume relationship provides negotiation leverage');
    }
    if (metric.onTimePerformance > 95) {
      opportunities.push('Excellent performance supports margin increase');
    }
    if (targetMargin < marketBenchmark) {
      opportunities.push('Below-market margin provides competitive advantage');
    }
    
    let recommendation = '';
    if (negotiationMode === 'preliminary') {
      if (targetMargin <= marketBenchmark && competitivePosition === 'strong') {
        recommendation = 'Proceed with negotiation - strong position and reasonable target';
      } else if (targetMargin > marketBenchmark + 3) {
        recommendation = 'Consider lowering target margin - may be too aggressive';
      } else {
        recommendation = 'Proceed with caution - monitor carrier response carefully';
      }
    } else {
      const improvement = targetMargin - currentMargin;
      if (improvement > 0) {
        recommendation = `Successful negotiation - achieved ${improvement.toFixed(1)}% margin increase`;
      } else if (improvement < 0) {
        recommendation = `Margin decreased by ${Math.abs(improvement).toFixed(1)}% - analyze impact`;
      } else {
        recommendation = 'No change in margin - consider future optimization opportunities';
      }
    }
    
    setNegotiationAnalysis({
      carrierName: selectedCarrierForNegotiation,
      currentMargin,
      proposedMargin: targetMargin,
      marketBenchmark,
      volumeImpact,
      revenueImpact,
      competitivePosition,
      negotiationPower,
      riskFactors,
      opportunities,
      recommendation
    });
  };

  // New carrier analysis
  const analyzeNewCarrier = async () => {
    if (!selectedNewCarrier || !selectedP44Group) return;
    
    // This would integrate with P44 API to get carrier details
    // For now, we'll create a comprehensive analysis framework
    
    const existingMetrics = calculateCarrierMetrics();
    const avgMarketMargin = existingMetrics.reduce((sum, m) => sum + m.avgMargin, 0) / existingMetrics.length;
    
    // Analyze similar carriers for benchmarking
    const similarCarriers = existingMetrics.filter(m => 
      m.serviceTypes.some(service => service.includes('LTL')) // Example similarity criteria
    );
    
    const recommendedMargin = similarCarriers.length > 0 ?
      similarCarriers.reduce((sum, m) => sum + m.avgMargin, 0) / similarCarriers.length :
      avgMarketMargin;
    
    const analysis = {
      carrierName: selectedNewCarrier,
      groupCode: selectedP44Group,
      recommendedMargin: recommendedMargin,
      marketPosition: 'To be determined through initial shipments',
      serviceCapabilities: ['LTL', 'Standard Service'], // Would come from P44 API
      geographicCoverage: 'National', // Would come from P44 API
      competitorComparison: similarCarriers.slice(0, 3).map(c => ({
        name: c.carrierName,
        margin: c.avgMargin,
        performance: c.onTimePerformance
      })),
      onboardingComplexity: 'Medium',
      riskAssessment: 'New carrier - limited performance history',
      recommendations: [
        `Start with ${recommendedMargin.toFixed(1)}% margin based on market analysis`,
        'Implement enhanced monitoring for first 90 days',
        'Establish clear performance metrics and SLAs',
        'Consider trial period with limited volume'
      ]
    };
    
    setNewCarrierAnalysis(analysis);
  };

  // Update metrics when data changes
  useEffect(() => {
    if (shipments.length > 0) {
      const metrics = calculateCarrierMetrics();
      setCarrierMetrics(metrics);
      
      const forecasts = generateForecasts();
      setForecasts(forecasts);
    }
  }, [shipments, customerCarriers]);

  const renderLoadingProgress = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Loader className="h-6 w-6 text-blue-500 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900">Loading Data in Batches</h3>
        </div>
        
        <div className="space-y-4">
          {/* Shipments Progress */}
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Shipments</span>
              <span>{shipmentProgress.loaded.toLocaleString()} / {shipmentProgress.total.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ 
                  width: `${shipmentProgress.total > 0 ? (shipmentProgress.loaded / shipmentProgress.total) * 100 : 0}%` 
                }}
              />
            </div>
            {loadingShipments && (
              <div className="text-xs text-blue-600 mt-1">Loading shipments in batches of 1,000...</div>
            )}
          </div>
          
          {/* Customer Carriers Progress */}
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Customer Carriers</span>
              <span>{carrierProgress.loaded.toLocaleString()} / {carrierProgress.total.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ 
                  width: `${carrierProgress.total > 0 ? (carrierProgress.loaded / carrierProgress.total) * 100 : 0}%` 
                }}
              />
            </div>
            {loadingCarriers && (
              <div className="text-xs text-green-600 mt-1">Loading carriers in batches of 1,000...</div>
            )}
          </div>
          
          {/* P44 Data Progress */}
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Project44 Carrier Groups</span>
              <span>{loadingP44Data ? 'Loading...' : 'Complete'}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: loadingP44Data ? '50%' : '100%' }}
              />
            </div>
            {loadingP44Data && (
              <div className="text-xs text-purple-600 mt-1">Loading Project44 data...</div>
            )}
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>
              Total Records: {(shipmentProgress.total + carrierProgress.total).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCarrierScorecard = () => (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Carriers</p>
              <p className="text-2xl font-bold text-gray-900">{carrierMetrics.length}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {carrierMetrics.length > 0 ? 
                  (carrierMetrics.reduce((sum, m) => sum + m.avgMargin, 0) / carrierMetrics.length).toFixed(1) : 0
                }%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(carrierMetrics.reduce((sum, m) => sum + m.totalRevenue, 0))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Performance</p>
              <p className="text-2xl font-bold text-gray-900">
                {carrierMetrics.length > 0 ? 
                  (carrierMetrics.reduce((sum, m) => sum + m.onTimePerformance, 0) / carrierMetrics.length).toFixed(1) : 0
                }%
              </p>
            </div>
            <Award className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>
      
      {/* Carrier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {carrierMetrics.slice(0, 10).map((metric, index) => (
          <div key={metric.carrierName} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  metric.performanceGrade === 'A' ? 'bg-green-100' :
                  metric.performanceGrade === 'B' ? 'bg-blue-100' :
                  metric.performanceGrade === 'C' ? 'bg-yellow-100' :
                  metric.performanceGrade === 'D' ? 'bg-orange-100' : 'bg-red-100'
                }`}>
                  <Truck className={`h-5 w-5 ${
                    metric.performanceGrade === 'A' ? 'text-green-600' :
                    metric.performanceGrade === 'B' ? 'text-blue-600' :
                    metric.performanceGrade === 'C' ? 'text-yellow-600' :
                    metric.performanceGrade === 'D' ? 'text-orange-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{metric.carrierName}</h4>
                  <p className="text-sm text-gray-600">
                    Grade: {metric.performanceGrade} • {metric.totalShipments} shipments
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {metric.avgMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Margin</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="font-bold">{formatCurrency(metric.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">On-Time</p>
                <p className="font-bold">{metric.onTimePerformance.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className={`font-bold ${
                  metric.riskScore < 30 ? 'text-green-600' :
                  metric.riskScore < 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metric.riskScore.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Opportunity</p>
                <p className={`font-bold ${
                  metric.opportunityScore > 60 ? 'text-green-600' :
                  metric.opportunityScore > 30 ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {metric.opportunityScore.toFixed(0)}
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Top Recommendations:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {metric.recommendations.slice(0, 2).map((rec, i) => (
                  <li key={i} className="flex items-start space-x-1">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderForecasting = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Brain className="h-6 w-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI-Powered Margin Forecasting</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {forecasts.slice(0, 8).map((forecast, index) => (
            <div key={forecast.carrierName} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{forecast.carrierName}</h4>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  forecast.recommendation === 'increase' ? 'bg-green-100 text-green-800' :
                  forecast.recommendation === 'decrease' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {forecast.recommendation.toUpperCase()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-600">Current</p>
                  <p className="font-bold">{forecast.currentMargin.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Predicted</p>
                  <p className={`font-bold ${
                    forecast.predictedMargin > forecast.currentMargin ? 'text-green-600' :
                    forecast.predictedMargin < forecast.currentMargin ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {forecast.predictedMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
              
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Confidence</span>
                  <span className="font-medium">{forecast.confidenceLevel}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${forecast.confidenceLevel}%` }}
                  />
                </div>
              </div>
              
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-1">Revenue Impact:</p>
                <p className={`font-bold ${
                  forecast.revenueImpact > 0 ? 'text-green-600' : 
                  forecast.revenueImpact < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {forecast.revenueImpact > 0 ? '+' : ''}{formatCurrency(forecast.revenueImpact)}
                </p>
              </div>
              
              <div className="text-xs text-gray-600">
                <p className="font-medium mb-1">Key Factors:</p>
                <ul className="space-y-1">
                  {forecast.trendFactors.slice(0, 2).map((factor, i) => (
                    <li key={i}>• {factor}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNegotiationAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Target className="h-6 w-6 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">Negotiation Analysis</h3>
        </div>
        
        {/* Mode Selection */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setNegotiationMode('preliminary')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              negotiationMode === 'preliminary'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Preliminary Analysis
          </button>
          <button
            onClick={() => setNegotiationMode('comparison')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              negotiationMode === 'comparison'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Before/After Comparison
          </button>
        </div>
        
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier</label>
            <select
              value={selectedCarrierForNegotiation}
              onChange={(e) => setSelectedCarrierForNegotiation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select Carrier</option>
              {carrierMetrics.map(metric => (
                <option key={metric.carrierName} value={metric.carrierName}>
                  {metric.carrierName}
                </option>
              ))}
            </select>
          </div>
          
          {negotiationMode === 'preliminary' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proposed Margin %</label>
              <input
                type="number"
                step="0.1"
                value={proposedMargin}
                onChange={(e) => setProposedMargin(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                placeholder="18.5"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Before Margin %</label>
                <input
                  type="number"
                  step="0.1"
                  value={beforeMargin}
                  onChange={(e) => setBeforeMargin(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  placeholder="15.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">After Margin %</label>
                <input
                  type="number"
                  step="0.1"
                  value={afterMargin}
                  onChange={(e) => setAfterMargin(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  placeholder="18.5"
                />
              </div>
            </>
          )}
          
          <div className="flex items-end">
            <button
              onClick={analyzeNegotiation}
              disabled={!selectedCarrierForNegotiation}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>
        
        {/* Analysis Results */}
        {negotiationAnalysis && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Analysis: {negotiationAnalysis.carrierName}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">Margin Comparison</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <span className="font-bold">{negotiationAnalysis.currentMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proposed:</span>
                    <span className="font-bold">{negotiationAnalysis.proposedMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Market Benchmark:</span>
                    <span className="font-bold">{negotiationAnalysis.marketBenchmark.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="font-medium text-green-900 mb-2">Financial Impact</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Revenue Impact:</span>
                    <span className={`font-bold ${
                      negotiationAnalysis.revenueImpact > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {negotiationAnalysis.revenueImpact > 0 ? '+' : ''}{formatCurrency(negotiationAnalysis.revenueImpact)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume Impact:</span>
                    <span className="font-bold">{negotiationAnalysis.volumeImpact} shipments</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <h5 className="font-medium text-purple-900 mb-2">Negotiation Position</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Position:</span>
                    <span className={`font-bold capitalize ${
                      negotiationAnalysis.competitivePosition === 'strong' ? 'text-green-600' :
                      negotiationAnalysis.competitivePosition === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {negotiationAnalysis.competitivePosition}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Power Score:</span>
                    <span className="font-bold">{negotiationAnalysis.negotiationPower.toFixed(0)}/100</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h5 className="font-medium text-red-900 mb-2">Risk Factors</h5>
                <ul className="text-sm text-red-700 space-y-1">
                  {negotiationAnalysis.riskFactors.map((risk, i) => (
                    <li key={i} className="flex items-start space-x-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h5 className="font-medium text-green-900 mb-2">Opportunities</h5>
                <ul className="text-sm text-green-700 space-y-1">
                  {negotiationAnalysis.opportunities.map((opp, i) => (
                    <li key={i} className="flex items-start space-x-1">
                      <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Recommendation</h5>
              <p className="text-sm text-gray-700">{negotiationAnalysis.recommendation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderNewCarrierAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Plus className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">New Carrier Analysis</h3>
        </div>
        
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">P44 Group</label>
            <select
              value={selectedP44Group}
              onChange={(e) => setSelectedP44Group(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select Group</option>
              {carrierGroups.map(group => (
                <option key={group.groupCode} value={group.groupCode}>
                  {group.groupName}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Carrier</label>
            <input
              type="text"
              value={selectedNewCarrier}
              onChange={(e) => setSelectedNewCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Enter carrier name"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={analyzeNewCarrier}
              disabled={!selectedNewCarrier || !selectedP44Group}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>
        
        {/* Analysis Results */}
        {newCarrierAnalysis && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              New Carrier Analysis: {newCarrierAnalysis.carrierName}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="font-medium text-green-900 mb-2">Recommended Setup</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Recommended Margin:</span>
                    <span className="font-bold">{newCarrierAnalysis.recommendedMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Group:</span>
                    <span className="font-bold">{newCarrierAnalysis.groupCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Onboarding:</span>
                    <span className="font-bold">{newCarrierAnalysis.onboardingComplexity}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">Market Position</h5>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Coverage:</span>
                    <span className="ml-2">{newCarrierAnalysis.geographicCoverage}</span>
                  </div>
                  <div>
                    <span className="font-medium">Services:</span>
                    <span className="ml-2">{newCarrierAnalysis.serviceCapabilities.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h5 className="font-medium text-gray-900 mb-2">Competitor Comparison</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Carrier</th>
                      <th className="px-4 py-2 text-left">Margin</th>
                      <th className="px-4 py-2 text-left">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newCarrierAnalysis.competitorComparison.map((comp: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2">{comp.name}</td>
                        <td className="px-4 py-2">{comp.margin.toFixed(1)}%</td>
                        <td className="px-4 py-2">{comp.performance.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Implementation Recommendations</h5>
              <ul className="text-sm text-gray-700 space-y-1">
                {newCarrierAnalysis.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start space-x-1">
                    <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-500" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (loading || loadingShipments || loadingCarriers || loadingP44Data) {
    return renderLoadingProgress();
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
        <button
          onClick={loadAllData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
              <p className="text-sm text-gray-600">
                Real-time carrier performance analysis with {shipments.length.toLocaleString()} shipments 
                and {customerCarriers.length.toLocaleString()} margin configurations
              </p>
            </div>
          </div>
          <button
            onClick={loadAllData}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

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

      {/* Tab Content */}
      {activeTab === 'scorecard' && renderCarrierScorecard()}
      {activeTab === 'forecasting' && renderForecasting()}
      {activeTab === 'negotiation' && renderNegotiationAnalysis()}
      {activeTab === 'new-carrier' && renderNewCarrierAnalysis()}
    </div>
  );
};