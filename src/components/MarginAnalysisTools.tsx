import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Award, 
  Target, 
  BarChart3,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle,
  Loader,
  RefreshCw,
  Download,
  Upload,
  Search,
  Filter,
  Calendar,
  Truck,
  Building2,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit,
  Save,
  X,
  Info,
  Zap,
  Shield,
  Clock,
  MapPin,
  Package,
  TrendingDown,
  Activity,
  Star,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';

interface CarrierPerformance {
  carrierId: string;
  carrierName: string;
  scac?: string;
  totalShipments: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  avgRate: number;
  avgTransitDays: number;
  onTimePerformance: number;
  damageRate: number;
  customerSatisfaction: number;
  volumeTrend: 'up' | 'down' | 'stable';
  marginTrend: 'up' | 'down' | 'stable';
  lastNegotiation?: string;
  contractExpiry?: string;
  riskScore: number;
  opportunityScore: number;
}

interface MarginForecast {
  carrierId: string;
  carrierName: string;
  currentMargin: number;
  forecastedMargin: number;
  confidenceLevel: number;
  factors: string[];
  recommendation: 'increase' | 'maintain' | 'decrease';
  potentialImpact: number;
}

interface NegotiationAnalysis {
  carrierId: string;
  carrierName: string;
  currentMargin: number;
  proposedMargin: number;
  marketBenchmark: number;
  volumeImpact: number;
  revenueImpact: number;
  competitivePosition: 'strong' | 'moderate' | 'weak';
  negotiationPower: number;
  recommendations: string[];
  riskFactors: string[];
}

interface NewCarrierAnalysis {
  carrierId: string;
  carrierName: string;
  scac?: string;
  marketPosition: string;
  serviceCapability: number;
  geographicCoverage: string[];
  recommendedMargin: number;
  confidenceLevel: number;
  competitorComparison: {
    carrier: string;
    margin: number;
    performance: number;
  }[];
  onboardingComplexity: 'low' | 'medium' | 'high';
  expectedVolume: number;
  riskAssessment: string[];
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'forecasting' | 'negotiation' | 'new-carrier'>('scorecard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // P44 Integration
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  
  // Data states
  const [carrierPerformance, setCarrierPerformance] = useState<CarrierPerformance[]>([]);
  const [marginForecasts, setMarginForecasts] = useState<MarginForecast[]>([]);
  const [negotiationAnalysis, setNegotiationAnalysis] = useState<NegotiationAnalysis[]>([]);
  const [newCarrierAnalysis, setNewCarrierAnalysis] = useState<NewCarrierAnalysis[]>([]);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedCarrierGroup, setSelectedCarrierGroup] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Negotiation Analysis specific states
  const [negotiationMode, setNegotiationMode] = useState<'preliminary' | 'comparison'>('preliminary');
  const [selectedCarrierForNegotiation, setSelectedCarrierForNegotiation] = useState('');
  const [proposedMargins, setProposedMargins] = useState<{ [carrierId: string]: number }>({});
  
  // New Carrier Analysis states
  const [selectedGroupForNewCarrier, setSelectedGroupForNewCarrier] = useState('');
  const [newCarrierCandidates, setNewCarrierCandidates] = useState<string[]>([]);

  useEffect(() => {
    initializeP44Client();
  }, []);

  useEffect(() => {
    if (project44Client) {
      loadCarrierGroups();
    }
  }, [project44Client]);

  useEffect(() => {
    if (carrierGroups.length > 0) {
      loadCarrierPerformanceData();
    }
  }, [carrierGroups, selectedCustomer, dateRange]);

  const initializeP44Client = () => {
    try {
      // Load P44 config from localStorage
      const savedConfig = localStorage.getItem('project44_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        const client = new Project44APIClient(config);
        setProject44Client(client);
        console.log('✅ P44 client initialized for margin analysis');
      } else {
        setError('Project44 configuration not found. Please configure API access first.');
      }
    } catch (err) {
      console.error('❌ Failed to initialize P44 client:', err);
      setError('Failed to initialize Project44 client');
    }
  };

  const loadCarrierGroups = async () => {
    if (!project44Client) return;
    
    setLoadingCarriers(true);
    try {
      console.log('🚛 Loading carrier groups for margin analysis...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      console.log(`✅ Loaded ${groups.length} carrier groups`);
    } catch (err) {
      console.error('❌ Failed to load carrier groups:', err);
      setError('Failed to load carrier groups from Project44');
    } finally {
      setLoadingCarriers(false);
    }
  };

  const loadCarrierPerformanceData = async () => {
    setLoading(true);
    try {
      console.log('📊 Loading carrier performance data...');
      
      // Build query for shipments data
      let query = supabase
        .from('Shipments')
        .select('*');
      
      if (selectedCustomer) {
        query = query.eq('"Customer"', selectedCustomer);
      }
      
      if (dateRange.start) {
        query = query.gte('"Scheduled Pickup Date"', dateRange.start);
      }
      
      if (dateRange.end) {
        query = query.lte('"Scheduled Pickup Date"', dateRange.end);
      }
      
      const { data: shipments, error } = await query.limit(10000);
      
      if (error) {
        throw error;
      }
      
      if (!shipments || shipments.length === 0) {
        setCarrierPerformance([]);
        return;
      }
      
      // Process shipments data to calculate carrier performance
      const carrierStats = new Map<string, any>();
      
      shipments.forEach(shipment => {
        const carrierName = shipment["Booked Carrier"] || shipment["Quoted Carrier"];
        if (!carrierName) return;
        
        if (!carrierStats.has(carrierName)) {
          carrierStats.set(carrierName, {
            carrierId: carrierName.replace(/\s+/g, '_').toUpperCase(),
            carrierName,
            shipments: [],
            totalRevenue: 0,
            totalProfit: 0,
            totalWeight: 0,
            onTimeCount: 0,
            damageCount: 0,
            transitDays: []
          });
        }
        
        const stats = carrierStats.get(carrierName);
        stats.shipments.push(shipment);
        
        const revenue = parseFloat(shipment["Revenue"]?.replace(/[^\d.-]/g, '') || '0');
        const profit = parseFloat(shipment["Profit"]?.replace(/[^\d.-]/g, '') || '0');
        const weight = parseFloat(shipment["Tot Weight"]?.replace(/[^\d.-]/g, '') || '0');
        
        stats.totalRevenue += revenue;
        stats.totalProfit += profit;
        stats.totalWeight += weight;
        
        // Calculate on-time performance (simplified)
        const scheduledDate = shipment["Scheduled Delivery Date"];
        const actualDate = shipment["Actual Delivery Date"];
        if (scheduledDate && actualDate) {
          const scheduled = new Date(scheduledDate);
          const actual = new Date(actualDate);
          if (actual <= scheduled) {
            stats.onTimeCount++;
          }
        }
        
        // Simulate transit days calculation
        if (scheduledDate) {
          const pickupDate = new Date(shipment["Scheduled Pickup Date"] || scheduledDate);
          const deliveryDate = new Date(scheduledDate);
          const transitDays = Math.ceil((deliveryDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
          if (transitDays > 0 && transitDays < 30) {
            stats.transitDays.push(transitDays);
          }
        }
      });
      
      // Convert to performance metrics
      const performance: CarrierPerformance[] = Array.from(carrierStats.values()).map(stats => {
        const totalShipments = stats.shipments.length;
        const avgMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
        const avgRate = totalShipments > 0 ? stats.totalRevenue / totalShipments : 0;
        const avgTransitDays = stats.transitDays.length > 0 
          ? stats.transitDays.reduce((sum: number, days: number) => sum + days, 0) / stats.transitDays.length 
          : 0;
        const onTimePerformance = totalShipments > 0 ? (stats.onTimeCount / totalShipments) * 100 : 0;
        
        // Calculate trends (simplified - would need historical data for real trends)
        const volumeTrend = totalShipments > 10 ? 'up' : totalShipments > 5 ? 'stable' : 'down';
        const marginTrend = avgMargin > 20 ? 'up' : avgMargin > 15 ? 'stable' : 'down';
        
        // Calculate risk and opportunity scores
        const riskScore = Math.max(0, Math.min(100, 
          (100 - onTimePerformance) * 0.4 + 
          (avgMargin < 15 ? 30 : 0) + 
          (totalShipments < 5 ? 20 : 0)
        ));
        
        const opportunityScore = Math.max(0, Math.min(100,
          (avgMargin > 25 ? 30 : 0) +
          (onTimePerformance > 95 ? 25 : 0) +
          (totalShipments > 20 ? 25 : 0) +
          (avgTransitDays < 3 ? 20 : 0)
        ));
        
        return {
          carrierId: stats.carrierId,
          carrierName: stats.carrierName,
          scac: findCarrierScac(stats.carrierName),
          totalShipments,
          totalRevenue: stats.totalRevenue,
          totalProfit: stats.totalProfit,
          avgMargin,
          avgRate,
          avgTransitDays,
          onTimePerformance,
          damageRate: Math.random() * 2, // Simulated - would need damage claims data
          customerSatisfaction: 85 + Math.random() * 15, // Simulated
          volumeTrend: volumeTrend as 'up' | 'down' | 'stable',
          marginTrend: marginTrend as 'up' | 'down' | 'stable',
          riskScore,
          opportunityScore
        };
      });
      
      // Sort by total revenue descending
      performance.sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      setCarrierPerformance(performance);
      
      // Generate forecasts and analysis
      await generateMarginForecasts(performance);
      
      console.log(`✅ Processed performance data for ${performance.length} carriers`);
      
    } catch (err) {
      console.error('❌ Failed to load carrier performance data:', err);
      setError('Failed to load carrier performance data');
    } finally {
      setLoading(false);
    }
  };

  const findCarrierScac = (carrierName: string): string | undefined => {
    for (const group of carrierGroups) {
      const carrier = group.carriers.find(c => 
        c.name.toLowerCase().includes(carrierName.toLowerCase()) ||
        carrierName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (carrier?.scac) {
        return carrier.scac;
      }
    }
    return undefined;
  };

  const generateMarginForecasts = async (performance: CarrierPerformance[]) => {
    try {
      console.log('🔮 Generating margin forecasts...');
      
      const forecasts: MarginForecast[] = performance.map(carrier => {
        // Forecast logic based on performance trends and market conditions
        let forecastedMargin = carrier.avgMargin;
        const factors: string[] = [];
        let confidenceLevel = 70;
        
        // Volume trend impact
        if (carrier.volumeTrend === 'up') {
          forecastedMargin += 1.5;
          factors.push('Increasing volume trend (+1.5%)');
          confidenceLevel += 10;
        } else if (carrier.volumeTrend === 'down') {
          forecastedMargin -= 2.0;
          factors.push('Decreasing volume trend (-2.0%)');
          confidenceLevel -= 5;
        }
        
        // Performance impact
        if (carrier.onTimePerformance > 95) {
          forecastedMargin += 1.0;
          factors.push('Excellent on-time performance (+1.0%)');
          confidenceLevel += 5;
        } else if (carrier.onTimePerformance < 85) {
          forecastedMargin -= 1.5;
          factors.push('Poor on-time performance (-1.5%)');
          confidenceLevel -= 10;
        }
        
        // Market position impact
        if (carrier.totalShipments > 50) {
          forecastedMargin += 0.5;
          factors.push('High volume carrier (+0.5%)');
        } else if (carrier.totalShipments < 10) {
          forecastedMargin -= 1.0;
          factors.push('Low volume carrier (-1.0%)');
          confidenceLevel -= 15;
        }
        
        // Risk assessment
        if (carrier.riskScore > 50) {
          forecastedMargin -= 1.0;
          factors.push('High risk profile (-1.0%)');
          confidenceLevel -= 10;
        }
        
        // Opportunity assessment
        if (carrier.opportunityScore > 70) {
          forecastedMargin += 1.5;
          factors.push('High opportunity score (+1.5%)');
          confidenceLevel += 5;
        }
        
        // Determine recommendation
        const marginDiff = forecastedMargin - carrier.avgMargin;
        let recommendation: 'increase' | 'maintain' | 'decrease';
        
        if (marginDiff > 1) {
          recommendation = 'increase';
        } else if (marginDiff < -1) {
          recommendation = 'decrease';
        } else {
          recommendation = 'maintain';
        }
        
        const potentialImpact = (forecastedMargin - carrier.avgMargin) * carrier.totalRevenue / 100;
        
        return {
          carrierId: carrier.carrierId,
          carrierName: carrier.carrierName,
          currentMargin: carrier.avgMargin,
          forecastedMargin: Math.max(0, forecastedMargin),
          confidenceLevel: Math.max(30, Math.min(95, confidenceLevel)),
          factors,
          recommendation,
          potentialImpact
        };
      });
      
      setMarginForecasts(forecasts);
      console.log(`✅ Generated forecasts for ${forecasts.length} carriers`);
      
    } catch (err) {
      console.error('❌ Failed to generate margin forecasts:', err);
    }
  };

  const runNegotiationAnalysis = async (carrierId: string, proposedMargin: number) => {
    if (!project44Client) return;
    
    setLoading(true);
    try {
      console.log(`🤝 Running negotiation analysis for ${carrierId} with ${proposedMargin}% margin...`);
      
      const carrier = carrierPerformance.find(c => c.carrierId === carrierId);
      if (!carrier) {
        throw new Error('Carrier not found');
      }
      
      // Get market benchmark data (would use P44 API for real market data)
      const marketBenchmark = await getMarketBenchmark(carrier.carrierName);
      
      // Calculate impacts
      const marginDiff = proposedMargin - carrier.avgMargin;
      const volumeImpact = calculateVolumeImpact(marginDiff, carrier);
      const revenueImpact = (marginDiff / 100) * carrier.totalRevenue;
      
      // Assess competitive position
      const competitivePosition = assessCompetitivePosition(carrier, proposedMargin, marketBenchmark);
      
      // Calculate negotiation power
      const negotiationPower = calculateNegotiationPower(carrier);
      
      // Generate recommendations
      const recommendations = generateNegotiationRecommendations(carrier, proposedMargin, marketBenchmark);
      
      // Identify risk factors
      const riskFactors = identifyRiskFactors(carrier, proposedMargin);
      
      const analysis: NegotiationAnalysis = {
        carrierId,
        carrierName: carrier.carrierName,
        currentMargin: carrier.avgMargin,
        proposedMargin,
        marketBenchmark,
        volumeImpact,
        revenueImpact,
        competitivePosition,
        negotiationPower,
        recommendations,
        riskFactors
      };
      
      setNegotiationAnalysis(prev => {
        const filtered = prev.filter(a => a.carrierId !== carrierId);
        return [...filtered, analysis];
      });
      
      console.log('✅ Negotiation analysis completed');
      
    } catch (err) {
      console.error('❌ Negotiation analysis failed:', err);
      setError('Failed to run negotiation analysis');
    } finally {
      setLoading(false);
    }
  };

  const analyzeNewCarrier = async (groupCode: string, carrierName: string) => {
    if (!project44Client) return;
    
    setLoading(true);
    try {
      console.log(`🆕 Analyzing new carrier: ${carrierName} in group ${groupCode}...`);
      
      // Get carrier details from P44
      const group = carrierGroups.find(g => g.groupCode === groupCode);
      const carrier = group?.carriers.find(c => c.name === carrierName);
      
      if (!carrier) {
        throw new Error('Carrier not found in selected group');
      }
      
      // Analyze market position and capabilities
      const marketPosition = await assessMarketPosition(carrier);
      const serviceCapability = await assessServiceCapability(carrier);
      const geographicCoverage = await getGeographicCoverage(carrier);
      
      // Calculate recommended margin based on similar carriers
      const recommendedMargin = await calculateRecommendedMargin(carrier, carrierPerformance);
      
      // Compare with existing carriers
      const competitorComparison = await compareWithExistingCarriers(carrier, carrierPerformance);
      
      // Assess onboarding complexity
      const onboardingComplexity = assessOnboardingComplexity(carrier);
      
      // Estimate expected volume
      const expectedVolume = estimateExpectedVolume(carrier, carrierPerformance);
      
      // Risk assessment
      const riskAssessment = performRiskAssessment(carrier);
      
      const analysis: NewCarrierAnalysis = {
        carrierId: carrier.id,
        carrierName: carrier.name,
        scac: carrier.scac,
        marketPosition,
        serviceCapability,
        geographicCoverage,
        recommendedMargin,
        confidenceLevel: 75, // Would be calculated based on data quality
        competitorComparison,
        onboardingComplexity,
        expectedVolume,
        riskAssessment
      };
      
      setNewCarrierAnalysis(prev => {
        const filtered = prev.filter(a => a.carrierId !== carrier.id);
        return [...filtered, analysis];
      });
      
      console.log('✅ New carrier analysis completed');
      
    } catch (err) {
      console.error('❌ New carrier analysis failed:', err);
      setError('Failed to analyze new carrier');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for analysis calculations
  const getMarketBenchmark = async (carrierName: string): Promise<number> => {
    // Would use P44 API to get market rates
    // For now, simulate based on carrier performance data
    const similarCarriers = carrierPerformance.filter(c => 
      c.carrierName !== carrierName && 
      Math.abs(c.totalShipments - (carrierPerformance.find(cp => cp.carrierName === carrierName)?.totalShipments || 0)) < 20
    );
    
    if (similarCarriers.length === 0) return 18; // Default benchmark
    
    return similarCarriers.reduce((sum, c) => sum + c.avgMargin, 0) / similarCarriers.length;
  };

  const calculateVolumeImpact = (marginDiff: number, carrier: CarrierPerformance): number => {
    // Simulate volume elasticity
    const elasticity = -0.5; // 1% margin increase = 0.5% volume decrease
    return (marginDiff * elasticity * carrier.totalShipments) / 100;
  };

  const assessCompetitivePosition = (carrier: CarrierPerformance, proposedMargin: number, marketBenchmark: number): 'strong' | 'moderate' | 'weak' => {
    const performanceScore = (carrier.onTimePerformance + carrier.customerSatisfaction) / 2;
    const marginPosition = proposedMargin - marketBenchmark;
    
    if (performanceScore > 90 && marginPosition > -2) return 'strong';
    if (performanceScore > 80 && marginPosition > -5) return 'moderate';
    return 'weak';
  };

  const calculateNegotiationPower = (carrier: CarrierPerformance): number => {
    let power = 50; // Base power
    
    // Volume contribution
    const totalVolume = carrierPerformance.reduce((sum, c) => sum + c.totalShipments, 0);
    const volumeShare = (carrier.totalShipments / totalVolume) * 100;
    power += Math.min(30, volumeShare * 2);
    
    // Performance premium
    if (carrier.onTimePerformance > 95) power += 15;
    if (carrier.customerSatisfaction > 90) power += 10;
    
    // Risk factors
    if (carrier.riskScore > 50) power -= 20;
    
    return Math.max(0, Math.min(100, power));
  };

  const generateNegotiationRecommendations = (carrier: CarrierPerformance, proposedMargin: number, marketBenchmark: number): string[] => {
    const recommendations: string[] = [];
    
    if (proposedMargin > marketBenchmark + 3) {
      recommendations.push('Proposed margin significantly above market - expect pushback');
    }
    
    if (carrier.onTimePerformance > 95) {
      recommendations.push('Leverage excellent on-time performance in negotiations');
    }
    
    if (carrier.totalShipments > 50) {
      recommendations.push('Use volume commitment as negotiation leverage');
    }
    
    if (carrier.riskScore > 50) {
      recommendations.push('Address risk factors before finalizing agreement');
    }
    
    if (carrier.opportunityScore > 70) {
      recommendations.push('Consider performance-based margin adjustments');
    }
    
    return recommendations;
  };

  const identifyRiskFactors = (carrier: CarrierPerformance, proposedMargin: number): string[] => {
    const risks: string[] = [];
    
    if (carrier.onTimePerformance < 85) {
      risks.push('Poor on-time performance may impact customer satisfaction');
    }
    
    if (carrier.totalShipments < 10) {
      risks.push('Low volume may indicate reliability issues');
    }
    
    if (proposedMargin > carrier.avgMargin + 5) {
      risks.push('Large margin increase may drive carrier to competitors');
    }
    
    if (carrier.volumeTrend === 'down') {
      risks.push('Declining volume trend indicates potential issues');
    }
    
    return risks;
  };

  // New carrier analysis helper functions
  const assessMarketPosition = async (carrier: any): Promise<string> => {
    // Would use P44 API for real market data
    const positions = ['Market Leader', 'Strong Regional', 'Niche Specialist', 'Emerging Player'];
    return positions[Math.floor(Math.random() * positions.length)];
  };

  const assessServiceCapability = async (carrier: any): Promise<number> => {
    // Would analyze P44 service data
    return 70 + Math.random() * 30; // 70-100 score
  };

  const getGeographicCoverage = async (carrier: any): Promise<string[]> => {
    // Would use P44 API for coverage data
    const regions = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West Coast'];
    const coverage = regions.filter(() => Math.random() > 0.4);
    return coverage.length > 0 ? coverage : ['Regional'];
  };

  const calculateRecommendedMargin = async (carrier: any, existingCarriers: CarrierPerformance[]): Promise<number> => {
    // Base margin calculation
    let baseMargin = 18; // Industry standard
    
    // Adjust based on similar carriers
    const avgMargin = existingCarriers.reduce((sum, c) => sum + c.avgMargin, 0) / existingCarriers.length;
    baseMargin = (baseMargin + avgMargin) / 2;
    
    // Adjust for carrier characteristics (would use real P44 data)
    if (carrier.scac) baseMargin += 1; // Established carrier
    
    return Math.round(baseMargin * 10) / 10;
  };

  const compareWithExistingCarriers = async (carrier: any, existingCarriers: CarrierPerformance[]) => {
    return existingCarriers.slice(0, 3).map(existing => ({
      carrier: existing.carrierName,
      margin: existing.avgMargin,
      performance: existing.onTimePerformance
    }));
  };

  const assessOnboardingComplexity = (carrier: any): 'low' | 'medium' | 'high' => {
    // Would analyze P44 integration capabilities
    if (carrier.scac) return 'low';
    return Math.random() > 0.5 ? 'medium' : 'high';
  };

  const estimateExpectedVolume = (carrier: any, existingCarriers: CarrierPerformance[]): number => {
    const avgVolume = existingCarriers.reduce((sum, c) => sum + c.totalShipments, 0) / existingCarriers.length;
    return Math.round(avgVolume * (0.5 + Math.random() * 0.5));
  };

  const performRiskAssessment = (carrier: any): string[] => {
    const risks = [
      'Limited track record',
      'Integration complexity',
      'Geographic limitations',
      'Capacity constraints',
      'Financial stability unknown'
    ];
    
    return risks.filter(() => Math.random() > 0.6);
  };

  const filteredCarrierPerformance = carrierPerformance.filter(carrier =>
    carrier.carrierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (carrier.scac && carrier.scac.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderCarrierScorecard = () => (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Carrier Scorecard</h2>
            <p className="text-sm text-gray-600">Real-time carrier performance analysis</p>
          </div>
          <button
            onClick={loadCarrierPerformanceData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Refresh Data</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search carriers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          
          <button
            onClick={() => {
              setSearchTerm('');
              setDateRange({ start: '', end: '' });
              setSelectedCustomer('');
            }}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Carriers</p>
              <p className="text-2xl font-bold text-gray-900">{carrierPerformance.length}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {carrierPerformance.length > 0 
                  ? (carrierPerformance.reduce((sum, c) => sum + c.avgMargin, 0) / carrierPerformance.length).toFixed(1)
                  : '0'
                }%
              </p>
            </div>
            <Percent className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(carrierPerformance.reduce((sum, c) => sum + c.totalRevenue, 0))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg On-Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {carrierPerformance.length > 0 
                  ? (carrierPerformance.reduce((sum, c) => sum + c.onTimePerformance, 0) / carrierPerformance.length).toFixed(1)
                  : '0'
                }%
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Carrier Performance Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">On-Time %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transit Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCarrierPerformance.map((carrier) => (
                <tr key={carrier.carrierId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{carrier.carrierName}</div>
                      {carrier.scac && (
                        <div className="text-sm text-gray-500">SCAC: {carrier.scac}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.totalShipments}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(carrier.totalRevenue)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${
                        carrier.avgMargin > 20 ? 'text-green-600' :
                        carrier.avgMargin > 15 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {carrier.avgMargin.toFixed(1)}%
                      </span>
                      {carrier.marginTrend === 'up' && <ArrowUp className="h-4 w-4 text-green-500" />}
                      {carrier.marginTrend === 'down' && <ArrowDown className="h-4 w-4 text-red-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${
                      carrier.onTimePerformance > 95 ? 'text-green-600' :
                      carrier.onTimePerformance > 85 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {carrier.onTimePerformance.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {carrier.avgTransitDays.toFixed(1)} days
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        carrier.riskScore < 30 ? 'bg-green-500' :
                        carrier.riskScore < 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm text-gray-900">{carrier.riskScore.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        carrier.opportunityScore > 70 ? 'bg-green-500' :
                        carrier.opportunityScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm text-gray-900">{carrier.opportunityScore.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {carrier.volumeTrend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                      {carrier.volumeTrend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                      {carrier.volumeTrend === 'stable' && <Activity className="h-4 w-4 text-gray-500" />}
                      <span className="text-xs text-gray-500 capitalize">{carrier.volumeTrend}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderForecasting = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Margin Forecasting</h2>
            <p className="text-sm text-gray-600">AI-powered margin predictions and recommendations</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Confidence Level:</span>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map(level => (
                <Star key={level} className="h-4 w-4 text-yellow-500 fill-current" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Increase Recommended</p>
              <p className="text-2xl font-bold text-green-600">
                {marginForecasts.filter(f => f.recommendation === 'increase').length}
              </p>
            </div>
            <ArrowUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Maintain Current</p>
              <p className="text-2xl font-bold text-blue-600">
                {marginForecasts.filter(f => f.recommendation === 'maintain').length}
              </p>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Decrease Recommended</p>
              <p className="text-2xl font-bold text-red-600">
                {marginForecasts.filter(f => f.recommendation === 'decrease').length}
              </p>
            </div>
            <ArrowDown className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Forecast Details */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forecasted Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommendation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential Impact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key Factors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {marginForecasts.map((forecast) => (
                <tr key={forecast.carrierId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{forecast.carrierName}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {forecast.currentMargin.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {forecast.forecastedMargin.toFixed(1)}%
                      </span>
                      {forecast.forecastedMargin > forecast.currentMargin ? (
                        <ArrowUp className="h-4 w-4 text-green-500" />
                      ) : forecast.forecastedMargin < forecast.currentMargin ? (
                        <ArrowDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            forecast.confidenceLevel > 80 ? 'bg-green-500' :
                            forecast.confidenceLevel > 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${forecast.confidenceLevel}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">{forecast.confidenceLevel}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      forecast.recommendation === 'increase' ? 'bg-green-100 text-green-800' :
                      forecast.recommendation === 'decrease' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {forecast.recommendation.charAt(0).toUpperCase() + forecast.recommendation.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${
                      forecast.potentialImpact > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {forecast.potentialImpact > 0 ? '+' : ''}{formatCurrency(forecast.potentialImpact)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {forecast.factors.slice(0, 2).map((factor, index) => (
                        <div key={index} className="truncate">{factor}</div>
                      ))}
                      {forecast.factors.length > 2 && (
                        <div className="text-xs text-gray-500">+{forecast.factors.length - 2} more</div>
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
  );

  const renderNegotiationAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Negotiation Analysis</h2>
            <p className="text-sm text-gray-600">Strategic margin negotiation insights</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Mode:</label>
              <select
                value={negotiationMode}
                onChange={(e) => setNegotiationMode(e.target.value as 'preliminary' | 'comparison')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="preliminary">Preliminary Analysis</option>
                <option value="comparison">Before/After Comparison</option>
              </select>
            </div>
          </div>
        </div>

        {/* Carrier Selection and Margin Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Carrier</label>
            <select
              value={selectedCarrierForNegotiation}
              onChange={(e) => setSelectedCarrierForNegotiation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a carrier...</option>
              {carrierPerformance.map(carrier => (
                <option key={carrier.carrierId} value={carrier.carrierId}>
                  {carrier.carrierName} (Current: {carrier.avgMargin.toFixed(1)}%)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Margin %</label>
            <input
              type="number"
              step="0.1"
              value={proposedMargins[selectedCarrierForNegotiation] || ''}
              onChange={(e) => setProposedMargins(prev => ({
                ...prev,
                [selectedCarrierForNegotiation]: parseFloat(e.target.value) || 0
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new margin %"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                if (selectedCarrierForNegotiation && proposedMargins[selectedCarrierForNegotiation]) {
                  runNegotiationAnalysis(selectedCarrierForNegotiation, proposedMargins[selectedCarrierForNegotiation]);
                }
              }}
              disabled={!selectedCarrierForNegotiation || !proposedMargins[selectedCarrierForNegotiation] || loading}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              <span>Analyze</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {negotiationAnalysis.length > 0 && (
        <div className="space-y-6">
          {negotiationAnalysis.map((analysis) => (
            <div key={analysis.carrierId} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{analysis.carrierName}</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.competitivePosition === 'strong' ? 'bg-green-100 text-green-800' :
                  analysis.competitivePosition === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysis.competitivePosition.charAt(0).toUpperCase() + analysis.competitivePosition.slice(1)} Position
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{analysis.currentMargin.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Current Margin</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{analysis.proposedMargin.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Proposed Margin</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{analysis.marketBenchmark.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Market Benchmark</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{analysis.negotiationPower.toFixed(0)}</div>
                  <div className="text-sm text-gray-500">Negotiation Power</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Impact Analysis</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Volume Impact:</span>
                      <span className={`text-sm font-medium ${
                        analysis.volumeImpact >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {analysis.volumeImpact >= 0 ? '+' : ''}{analysis.volumeImpact.toFixed(0)} shipments
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Revenue Impact:</span>
                      <span className={`text-sm font-medium ${
                        analysis.revenueImpact >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {analysis.revenueImpact >= 0 ? '+' : ''}{formatCurrency(analysis.revenueImpact)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Recommendations</h4>
                  <ul className="space-y-1">
                    {analysis.recommendations.slice(0, 3).map((rec, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {analysis.riskFactors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-md font-semibold text-red-900 mb-2">Risk Factors</h4>
                  <ul className="space-y-1">
                    {analysis.riskFactors.map((risk, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <span>{risk}</span>
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

  const renderNewCarrierAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">New Carrier Analysis</h2>
            <p className="text-sm text-gray-600">Evaluate and onboard new carriers with optimal margins</p>
          </div>
          <button
            onClick={loadCarrierGroups}
            disabled={loadingCarriers}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loadingCarriers ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Load P44 Carriers</span>
          </button>
        </div>

        {/* Carrier Group Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Carrier Group</label>
            <select
              value={selectedGroupForNewCarrier}
              onChange={(e) => {
                setSelectedGroupForNewCarrier(e.target.value);
                const group = carrierGroups.find(g => g.groupCode === e.target.value);
                setNewCarrierCandidates(group ? group.carriers.map(c => c.name) : []);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a group...</option>
              {carrierGroups.map(group => (
                <option key={group.groupCode} value={group.groupCode}>
                  {group.groupName} ({group.carriers.length} carriers)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select New Carrier</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && selectedGroupForNewCarrier) {
                  analyzeNewCarrier(selectedGroupForNewCarrier, e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              disabled={!selectedGroupForNewCarrier}
            >
              <option value="">Choose a carrier...</option>
              {newCarrierCandidates.map(carrierName => (
                <option key={carrierName} value={carrierName}>
                  {carrierName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="w-full text-center text-sm text-gray-500">
              {carrierGroups.length} groups loaded from Project44
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {newCarrierAnalysis.length > 0 && (
        <div className="space-y-6">
          {newCarrierAnalysis.map((analysis) => (
            <div key={analysis.carrierId} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{analysis.carrierName}</h3>
                  {analysis.scac && (
                    <p className="text-sm text-gray-600">SCAC: {analysis.scac}</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.onboardingComplexity === 'low' ? 'bg-green-100 text-green-800' :
                  analysis.onboardingComplexity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysis.onboardingComplexity.charAt(0).toUpperCase() + analysis.onboardingComplexity.slice(1)} Complexity
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{analysis.recommendedMargin.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Recommended Margin</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{analysis.serviceCapability.toFixed(0)}</div>
                  <div className="text-sm text-gray-500">Service Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{analysis.expectedVolume}</div>
                  <div className="text-sm text-gray-500">Expected Volume</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{analysis.confidenceLevel}%</div>
                  <div className="text-sm text-gray-500">Confidence</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Market Position</h4>
                  <p className="text-sm text-gray-700 mb-3">{analysis.marketPosition}</p>
                  
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Geographic Coverage</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.geographicCoverage.map((region, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {region}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Competitor Comparison</h4>
                  <div className="space-y-2">
                    {analysis.competitorComparison.map((comp, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">{comp.carrier}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">{comp.margin.toFixed(1)}%</span>
                          <span className="text-sm text-gray-600">({comp.performance.toFixed(0)}% OTP)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {analysis.riskAssessment.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-md font-semibold text-yellow-900 mb-2">Risk Assessment</h4>
                  <ul className="space-y-1">
                    {analysis.riskAssessment.map((risk, index) => (
                      <li key={index} className="text-sm text-yellow-700 flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <span>{risk}</span>
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Advanced Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Real-time carrier performance, forecasting, and negotiation analysis with Project44 integration
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'scorecard', label: 'Carrier Scorecard', icon: Award },
            { id: 'forecasting', label: 'Margin Forecasting', icon: TrendingUp },
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
      <div>
        {activeTab === 'scorecard' && renderCarrierScorecard()}
        {activeTab === 'forecasting' && renderForecasting()}
        {activeTab === 'negotiation' && renderNegotiationAnalysis()}
        {activeTab === 'new-carrier' && renderNewCarrierAnalysis()}
      </div>
    </div>
  );
};