import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Calendar, 
  Play, 
  Loader, 
  AlertCircle, 
  CheckCircle,
  BarChart3,
  DollarSign,
  Target,
  Clock,
  Truck,
  Building2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { CarrierSelection } from './CarrierSelection';
import { loadProject44Config } from '../utils/credentialStorage';
import { formatCurrency } from '../utils/pricingCalculator';

interface MarginAnalysisJob {
  id: string;
  customer_name: string;
  carrier_name: string;
  analysis_type: 'benchmark' | 'comparison';
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  shipment_count: number;
  recommended_margin?: number;
  current_margin?: number;
  confidence_score?: number;
  error_message?: string;
  date_range_start?: string;
  date_range_end?: string;
  first_phase_completed?: boolean;
  second_phase_started_at?: string;
  second_phase_completed_at?: string;
  first_phase_data?: any;
  second_phase_data?: any;
  discount_analysis_data?: any;
}

interface MarginRecommendation {
  id: string;
  customer_name: string;
  carrier_name: string;
  current_margin: number;
  recommended_margin: number;
  confidence_score: number;
  potential_revenue_impact: number;
  shipment_count: number;
  avg_shipment_value: number;
  margin_variance: number;
  last_updated: string;
  applied: boolean;
}

export const MarginAnalysisTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analysis' | 'recommendations' | 'history'>('analysis');
  
  // Analysis form state
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  const [analysisType, setAnalysisType] = useState<'benchmark' | 'comparison'>('benchmark');
  
  // Carrier selection state
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);
  
  // Two-phase analysis state
  const [isSecondPhase, setIsSecondPhase] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Data state
  const [customers, setCustomers] = useState<string[]>([]);
  const [jobs, setJobs] = useState<MarginAnalysisJob[]>([]);
  const [recommendations, setRecommendations] = useState<MarginRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadJobs();
    loadRecommendations();
    initializeProject44Client();
  }, []);

  const initializeProject44Client = () => {
    const config = loadProject44Config();
    if (config) {
      const client = new Project44APIClient(config);
      setProject44Client(client);
      console.log('✅ Project44 client initialized for margin analysis');
    } else {
      console.log('⚠️ No Project44 config found for margin analysis');
    }
  };

  const loadCustomers = async () => {
    try {
      console.log('📋 Loading customers from Shipments table...');
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null);
      
      if (error) throw error;
      
      const uniqueCustomers = [...new Set(data?.map(d => d.Customer).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers`);
    } catch (err) {
      console.error('❌ Failed to load customers:', err);
      setError('Failed to load customers');
    }
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('❌ Failed to load jobs:', err);
    }
  };

  const loadRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('MarginRecommendations')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setRecommendations(data || []);
    } catch (err) {
      console.error('❌ Failed to load recommendations:', err);
    }
  };

  const loadCarriersFromDatabase = async () => {
    if (!project44Client) {
      setError('Project44 client not available');
      return;
    }

    setIsLoadingCarriers(true);
    setCarriersLoaded(false);
    setError('');

    try {
      console.log('🔄 Step 1: Loading all carriers from Project44...');
      
      // Step 1: Get all carriers from Project44
      const allCarrierGroups = await project44Client.getAvailableCarriersByGroup(false, false);
      console.log(`📋 Project44 returned ${allCarrierGroups.length} carrier groups`);

      // Flatten all carriers from all groups
      const allP44Carriers = allCarrierGroups.flatMap(group => 
        group.carriers.map(carrier => ({
          ...carrier,
          groupCode: group.groupCode,
          groupName: group.groupName
        }))
      );
      console.log(`📋 Total Project44 carriers: ${allP44Carriers.length}`);

      console.log('🔄 Step 2: Loading CustomerCarriers from database...');
      
      // Step 2: Get all CustomerCarriers from database
      const { data: customerCarriers, error } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode, InternalName')
        .not('P44CarrierCode', 'is', null);

      if (error) {
        console.error('❌ Database query error:', error);
        throw error;
      }

      console.log(`📋 Database CustomerCarriers: ${customerCarriers?.length || 0}`);
      
      if (!customerCarriers || customerCarriers.length === 0) {
        console.log('⚠️ No CustomerCarriers found in database');
        setCarrierGroups([]);
        setCarriersLoaded(true);
        return;
      }

      // Get unique P44CarrierCodes from database
      const dbCarrierCodes = [...new Set(customerCarriers.map(cc => cc.P44CarrierCode).filter(Boolean))];
      console.log(`📋 Unique P44CarrierCodes in database: ${dbCarrierCodes.length}`, dbCarrierCodes);

      console.log('🔄 Step 3: Matching Project44 carriers to database entries...');
      
      // Step 3: Filter Project44 carriers to only those that exist in database
      const matchedCarriers = allP44Carriers.filter(p44Carrier => {
        // Try to match by account code first, then by SCAC, then by name
        const accountCodeMatch = dbCarrierCodes.includes(p44Carrier.accountCode || '');
        const scacMatch = p44Carrier.scac && dbCarrierCodes.includes(p44Carrier.scac);
        const nameMatch = dbCarrierCodes.some(code => 
          code.toLowerCase().includes(p44Carrier.name.toLowerCase()) ||
          p44Carrier.name.toLowerCase().includes(code.toLowerCase())
        );
        
        const isMatch = accountCodeMatch || scacMatch || nameMatch;
        
        if (isMatch) {
          console.log(`✅ Matched carrier: ${p44Carrier.name} (Account: ${p44Carrier.accountCode}, SCAC: ${p44Carrier.scac})`);
        }
        
        return isMatch;
      });

      console.log(`🎯 Step 3 Result: ${matchedCarriers.length} carriers matched between Project44 and database`);

      if (matchedCarriers.length === 0) {
        console.log('⚠️ No carriers matched between Project44 and database');
        console.log('🔍 Debug info:');
        console.log('- Database P44CarrierCodes:', dbCarrierCodes);
        console.log('- Sample Project44 carriers:', allP44Carriers.slice(0, 3).map(c => ({
          name: c.name,
          accountCode: c.accountCode,
          scac: c.scac
        })));
        
        setError('No carriers found that match between Project44 and your CustomerCarriers database. Please check that your P44CarrierCode values match the account codes from Project44.');
        setCarrierGroups([]);
        setCarriersLoaded(true);
        return;
      }

      // Group matched carriers by their original group
      const groupedCarriers = new Map<string, typeof matchedCarriers>();
      matchedCarriers.forEach(carrier => {
        const groupKey = carrier.groupCode || 'Default';
        if (!groupedCarriers.has(groupKey)) {
          groupedCarriers.set(groupKey, []);
        }
        groupedCarriers.get(groupKey)!.push(carrier);
      });

      // Create carrier groups with only matched carriers
      const filteredCarrierGroups: CarrierGroup[] = Array.from(groupedCarriers.entries()).map(([groupCode, carriers]) => {
        const originalGroup = allCarrierGroups.find(g => g.groupCode === groupCode);
        return {
          groupCode,
          groupName: originalGroup?.groupName || 'Matched Carriers',
          carriers: carriers.map(carrier => ({
            id: carrier.accountCode || carrier.id,
            name: carrier.name,
            scac: carrier.scac,
            mcNumber: carrier.mcNumber,
            dotNumber: carrier.dotNumber,
            accountCode: carrier.accountCode
          }))
        };
      });

      setCarrierGroups(filteredCarrierGroups);
      setCarriersLoaded(true);
      
      console.log(`✅ Final result: ${filteredCarrierGroups.length} carrier groups with matched carriers loaded`);
      filteredCarrierGroups.forEach(group => {
        console.log(`  - ${group.groupName}: ${group.carriers.length} carriers`);
      });

    } catch (err) {
      console.error('❌ Failed to load carriers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load carriers');
      setCarrierGroups([]);
      setCarriersLoaded(false);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    // For margin analysis, only allow one carrier at a time
    if (selected) {
      // Clear all other selections first
      setSelectedCarriers({ [carrierId]: true });
    } else {
      setSelectedCarriers({});
    }
  };

  const handleSelectAll = (selected: boolean) => {
    // For margin analysis, don't allow select all - only single selection
    if (!selected) {
      setSelectedCarriers({});
    }
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    // For margin analysis, don't allow group selection - only single selection
    if (!selected) {
      setSelectedCarriers({});
    }
  };

  const runSecondPhaseAnalysis = async (jobId: string) => {
    setIsRunningAnalysis(true);
    setError('');
    setSelectedJobId(jobId);
    setIsSecondPhase(true);

    try {
      // Get the job details
      const { data: job, error: jobError } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      
      console.log(`🔄 Starting second phase analysis for job: ${jobId}`);
      
      // Update job status to running for second phase
      const { error: updateError } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'running',
          second_phase_started_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;
      
      // Get first phase data
      const firstPhaseData = job.benchmark_data;
      if (!firstPhaseData) {
        throw new Error('No first phase data available');
      }
      
      console.log('📊 First phase data:', firstPhaseData);
      
      // Query shipments again to see if any discounts have been applied
      console.log(`🔍 Querying shipments again for date range: ${job.date_range_start} to ${job.date_range_end}`);
      
      let shipmentQuery = supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', job.date_range_start)
        .lte('"Scheduled Pickup Date"', job.date_range_end);

      const { data: currentShipments, error: shipmentError } = await shipmentQuery;

      if (shipmentError) throw shipmentError;

      console.log(`📦 Found ${currentShipments?.length || 0} total shipments in date range for second phase`);

      if (!currentShipments || currentShipments.length === 0) {
        throw new Error(`No shipments found in the selected date range for second phase`);
      }

      // Group shipments by customer
      const customerShipments = currentShipments.reduce((groups, shipment) => {
        const customer = shipment["Customer"] || 'Unknown';
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(shipment);
        return groups;
      }, {} as Record<string, any[]>);
      
      console.log(`👥 Found ${Object.keys(customerShipments).length} customers with shipments in second phase`);
      
      // Process each customer separately and compare with first phase
      const customerResults = [];
      const discountAnalysis = [];
      
      for (const [customer, shipments] of Object.entries(customerShipments)) {
        console.log(`🔍 Second phase analysis for customer: ${customer} with ${shipments.length} shipments`);
        
        // Find this customer in first phase results
        const firstPhaseCustomerData = firstPhaseData.customer_results.find(
          (cr: any) => cr.customer === customer
        );
        
        if (!firstPhaseCustomerData) {
          console.log(`⚠️ Customer ${customer} not found in first phase data, skipping`);
          continue;
        }
        
        // Calculate current margin from new shipment data
        const revenues = shipments
          .map(s => parseFloat(s["Revenue"] || '0'))
          .filter(r => r > 0);
        
        const carrierExpenses = shipments
          .map(s => parseFloat(s["Carrier Expense"] || '0'))
          .filter(e => e > 0);
        
        const profits = shipments
          .map(s => parseFloat(s["Profit"] || '0'))
          .filter(p => !isNaN(p));
        
        const avgRevenue = revenues.length > 0 ? revenues.reduce((sum, r) => sum + r, 0) / revenues.length : 0;
        const avgExpense = carrierExpenses.length > 0 ? carrierExpenses.reduce((sum, e) => sum + e, 0) / carrierExpenses.length : 0;
        const avgProfit = profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0;
        
        // Calculate current margin as a percentage
        const currentMargin = avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0;
        
        // Compare with first phase
        const firstPhaseMargin = firstPhaseCustomerData.currentMargin;
        const marginDifference = currentMargin - firstPhaseMargin;
        
        // Calculate discount percentage if margin decreased
        const discountDetected = marginDifference < -1; // More than 1% decrease in margin
        const discountPercentage = discountDetected ? Math.abs(marginDifference) : 0;
        
        // Calculate confidence score for discount detection
        const discountConfidence = discountDetected 
          ? Math.min(90, Math.max(60, 70 + (shipments.length * 2)))
          : 0;
        
        console.log(`📊 Second phase analysis for ${customer}:`, {
          shipmentCount: shipments.length,
          avgRevenue: avgRevenue.toFixed(2),
          avgExpense: avgExpense.toFixed(2),
          avgProfit: avgProfit.toFixed(2),
          currentMargin: currentMargin.toFixed(2),
          firstPhaseMargin: firstPhaseMargin.toFixed(2),
          marginDifference: marginDifference.toFixed(2),
          discountDetected,
          discountPercentage: discountPercentage.toFixed(2)
        });
        
        // Store results for this customer
        customerResults.push({
          customer,
          shipmentCount: shipments.length,
          avgRevenue,
          avgExpense,
          avgProfit,
          currentMargin,
          firstPhaseMargin,
          marginDifference,
          discountDetected,
          discountPercentage
        });
        
        // Add to discount analysis if discount detected
        if (discountDetected) {
          discountAnalysis.push({
            customer,
            carrier: job.carrier_name,
            firstPhaseMargin,
            secondPhaseMargin: currentMargin,
            discountPercentage,
            confidence: discountConfidence,
            shipmentCount: shipments.length
          });
          
          // Update recommendation with discount data
          const { error: recError } = await supabase
            .from('MarginRecommendations')
            .update({
              discount_pattern_detected: true,
              avg_discount_percentage: discountPercentage,
              discount_confidence_score: discountConfidence,
              discount_data: {
                first_phase_margin: firstPhaseMargin,
                second_phase_margin: currentMargin,
                margin_difference: marginDifference,
                first_phase_shipments: firstPhaseCustomerData.shipmentCount,
                second_phase_shipments: shipments.length
              }
            })
            .eq('customer_name', customer)
            .eq('carrier_name', job.carrier_name);

          if (recError) console.error(`Failed to update recommendation with discount data for ${customer}:`, recError);
        }
      }

      // Update job with second phase results
      const { error: updateError2 } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'completed',
          second_phase_completed_at: new Date().toISOString(),
          second_phase_data: {
            customer_count: Object.keys(customerShipments).length,
            total_shipments: currentShipments.length,
            customer_results: customerResults,
            date_range: {
              start: job.date_range_start,
              end: job.date_range_end
            }
          },
          discount_analysis_data: {
            discount_count: discountAnalysis.length,
            discount_details: discountAnalysis
          }
        })
        .eq('id', jobId);

      if (updateError2) throw updateError2;

      console.log('✅ Second phase margin analysis completed successfully');
      console.log(`📊 Found ${discountAnalysis.length} customers with discount patterns`);
      
      // Reload data
      await Promise.all([loadJobs(), loadRecommendations()]);

    } catch (err) {
      console.error('❌ Second phase margin analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Second phase analysis failed');
      
      // Update job status to failed
      if (jobId) {
        await supabase
          .from('MarginAnalysisJobs')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Second phase analysis failed'
          })
          .eq('id', jobId);
      }
    } finally {
      setIsRunningAnalysis(false);
      setIsSecondPhase(false);
      setSelectedJobId(null);
    }
  };

  const runMarginAnalysis = async () => {
    const selectedCarrierIds = Object.keys(selectedCarriers).filter(id => selectedCarriers[id]);
    if (selectedCarrierIds.length !== 1) {
      setError('Please select exactly one carrier to analyze');
      return;
    }

    const selectedCarrierId = selectedCarrierIds[0];
    const selectedCarrier = carrierGroups
      .flatMap(group => group.carriers)
      .find(carrier => carrier.id === selectedCarrierId);

    if (!selectedCarrier) {
      setError('Selected carrier not found');
      return;
    }

    setIsRunningAnalysis(true);
    setError('');

    try {
      console.log(`🔄 Starting margin analysis for ALL customers with carrier: ${selectedCarrier.name}`);

      // Create analysis job
      const { data: job, error: jobError } = await supabase
        .from('MarginAnalysisJobs')
        .insert([{
          customer_name: 'ALL',
          carrier_name: selectedCarrier.name,
          analysis_type: analysisType,
          status: 'running',
          started_at: new Date().toISOString(),
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          selected_carriers: [selectedCarrier.name]
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      console.log('✅ Analysis job created:', job.id);

      // Query ALL shipments in the date range
      console.log(`🔍 Querying ALL shipments in date range: ${dateRange.start} to ${dateRange.end}`);
      
      let shipmentQuery = supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);

      const { data: allShipments, error: shipmentError } = await shipmentQuery;

      if (shipmentError) throw shipmentError;

      console.log(`📦 Found ${allShipments?.length || 0} total shipments in date range`);

      if (!allShipments || allShipments.length === 0) {
        throw new Error(`No shipments found in the selected date range`);
      }

      // Group shipments by customer
      const customerShipments = allShipments.reduce((groups, shipment) => {
        const customer = shipment["Customer"] || 'Unknown';
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(shipment);
        return groups;
      }, {} as Record<string, typeof carrierShipments>);
      
      console.log(`👥 Found ${Object.keys(customerShipments).length} customers with shipments in date range`);
      
      // Process each customer separately
      const customerResults = [];
      
      for (const [customer, shipments] of Object.entries(customerShipments)) {
        console.log(`🔍 Analyzing customer: ${customer} with ${shipments.length} shipments`);
        
        // Get customer-specific margin from CustomerCarriers table
        const { data: customerCarriers, error: ccError } = await supabase
          .from('CustomerCarriers')
          .select('Percentage, P44CarrierCode')
          .eq('InternalName', customer)
          .ilike('P44CarrierCode', `%${selectedCarrier.name}%`);
        
        if (ccError) {
          console.error(`Error fetching margin for ${customer}:`, ccError);
        }
        
        // Calculate current margin from shipment data
        const revenues = shipments
          .map(s => parseFloat(s["Revenue"] || '0'))
          .filter(r => r > 0);
        
        const carrierExpenses = shipments
          .map(s => parseFloat(s["Carrier Expense"] || '0'))
          .filter(e => e > 0);
        
        const profits = shipments
          .map(s => parseFloat(s["Profit"] || '0'))
          .filter(p => !isNaN(p));
        
        const avgRevenue = revenues.length > 0 ? revenues.reduce((sum, r) => sum + r, 0) / revenues.length : 0;
        const avgExpense = carrierExpenses.length > 0 ? carrierExpenses.reduce((sum, e) => sum + e, 0) / carrierExpenses.length : 0;
        const avgProfit = profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0;
        
        // Calculate current margin as a percentage
        const currentMargin = avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0;
        
        // Get target margin from database or use default
        const targetMargin = customerCarriers && customerCarriers.length > 0 
          ? parseFloat(customerCarriers[0].Percentage || '15')
          : 15; // Default to 15% if no specific margin found
        
        // Calculate confidence score based on number of shipments
        const confidenceScore = Math.min(95, Math.max(60, 70 + (shipments.length * 2)));
        
        // Calculate potential revenue impact
        const potentialImpact = ((targetMargin - currentMargin) / 100) * avgRevenue * shipments.length;
        
        console.log(`📊 Analysis for ${customer}:`, {
          shipmentCount: shipments.length,
          avgRevenue: avgRevenue.toFixed(2),
          avgExpense: avgExpense.toFixed(2),
          avgProfit: avgProfit.toFixed(2),
          currentMargin: currentMargin.toFixed(2),
          targetMargin: targetMargin.toFixed(2),
          confidenceScore,
          potentialImpact: potentialImpact.toFixed(2)
        });
        
        // Store results for this customer
        customerResults.push({
          customer,
          shipmentCount: shipments.length,
          avgRevenue,
          avgExpense,
          avgProfit,
          currentMargin,
          targetMargin,
          confidenceScore,
          potentialImpact
        });
        
        // Create recommendation if margin improvement is possible
        if (Math.abs(targetMargin - currentMargin) > 1) {
          const { error: recError } = await supabase
            .from('MarginRecommendations')
            .insert([{
              customer_name: customer,
              carrier_name: selectedCarrier.name,
              current_margin: currentMargin,
              recommended_margin: targetMargin,
              confidence_score: confidenceScore,
              potential_revenue_impact: potentialImpact,
              shipment_count: shipments.length,
              avg_shipment_value: avgRevenue,
              margin_variance: Math.abs(targetMargin - currentMargin)
            }]);

          if (recError) console.error(`Failed to create recommendation for ${customer}:`, recError);
        }
      }

      // Update job with results
      const { error: updateError } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          shipment_count: allShipments.length,
          first_phase_completed: true,
          first_phase_data: {
            customer_count: Object.keys(customerShipments).length,
            total_shipments: allShipments.length,
            customer_results: customerResults,
            date_range: dateRange
          }
        })
        .eq('id', job.id);

      if (updateError) throw updateError;

      console.log('✅ Margin analysis completed successfully');
      
      // Reload data
      await Promise.all([loadJobs(), loadRecommendations()]);

    } catch (err) {
      console.error('❌ Margin analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      
      // Update job status to failed if we have a job ID
      // TODO: Update job status to failed
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  const renderAnalysisTab = () => (
    <div className="space-y-6">
      {/* First Phase Analysis Configuration */}
      {/* Analysis Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Type</label>
            <select
              value={isSecondPhase ? 'comparison' : analysisType}
              onChange={(e) => setAnalysisType(e.target.value as 'benchmark' | 'comparison')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="benchmark">Benchmark Analysis</option>
              <option value="comparison">Carrier Comparison</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={isSecondPhase && selectedJobId ? jobs.find(j => j.id === selectedJobId)?.date_range_start || dateRange.start : dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={isSecondPhase && selectedJobId ? jobs.find(j => j.id === selectedJobId)?.date_range_end || dateRange.end : dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Second Phase Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Two-Phase Analysis</h3>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Run a second phase analysis on a completed job to detect discount patterns between phases.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Completed First Phase Job</label>
              <select
                value={selectedJobId || ''}
                onChange={(e) => setSelectedJobId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a job --</option>
                {jobs
                  .filter(job => job.status === 'completed' && job.first_phase_completed && !job.second_phase_completed_at)
                  .map(job => (
                    <option key={job.id} value={job.id}>
                      {job.carrier_name} - {new Date(job.created_at).toLocaleDateString()} ({job.shipment_count} shipments)
                    </option>
                  ))
                }
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => selectedJobId && runSecondPhaseAnalysis(selectedJobId)}
                disabled={isRunningAnalysis || !selectedJobId}
                className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full"
              >
                {isRunningAnalysis && isSecondPhase ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                <span>{isRunningAnalysis && isSecondPhase ? 'Running Second Phase...' : 'Run Second Phase Analysis'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Carrier Selection */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
            {!carriersLoaded && (
              <button
                onClick={loadCarriersFromDatabase}
                disabled={isLoadingCarriers || !project44Client}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoadingCarriers ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                <span>{isLoadingCarriers ? 'Loading...' : 'Load Matched Carriers'}</span>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Select one carrier to analyze margins for the selected customer
          </p>
        </div>
        
        {carriersLoaded && (
          <div className="p-6">
            <CarrierSelection
              carrierGroups={carrierGroups}
              selectedCarriers={selectedCarriers}
              onToggleCarrier={handleCarrierToggle}
              onSelectAll={handleSelectAll}
              onSelectAllInGroup={handleSelectAllInGroup}
              isLoading={isLoadingCarriers}
              singleSelect={true}
            />
          </div>
        )}
      </div>

      {/* Run Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Run First Phase Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Analyze margin performance for ALL customers with the selected carrier
            </p>
          </div>
          <button
            onClick={runMarginAnalysis}
            disabled={isRunningAnalysis || Object.keys(selectedCarriers).filter(id => selectedCarriers[id]).length !== 1}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full md:w-auto"
          >
            {isRunningAnalysis ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            <span>{isRunningAnalysis ? 'Running Analysis...' : 'Start Analysis'}</span>
          </button>  
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Margin Analysis Works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select a carrier to analyze and date range</li>
                <li>System processes <strong>ALL shipments</strong> in the date range regardless of carrier</li>
                <li>For EACH customer, system calculates current margin performance on ALL shipments</li>
                <li>Run second phase analysis the next day to detect discount patterns</li>
                <li>System looks up target margin from CustomerCarriers table for the selected carrier</li>
                <li>Recommendations are generated for each customer based on the selected carrier's target margin</li>
                <li>Results show potential revenue impact of applying the selected carrier's margin to all shipments</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-800">
              <p className="font-medium mb-1">Two-Phase Analysis Process:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>First Phase (Today):</strong> Calculate current margins for all customers</li>
                <li><strong>Second Phase (Tomorrow):</strong> Re-analyze the same shipments to detect discount patterns</li>
                <li><strong>Discount Detection:</strong> System identifies customers who received discounts after initial quotes</li>
                <li><strong>Margin Impact:</strong> Calculates how discounts affect your overall margin performance</li>
                <li><strong>Recommendations:</strong> Updates recommendations with discount pattern information</li>
                <li><strong>Revenue Protection:</strong> Helps identify customers who consistently negotiate down prices</li>
                <li><strong>Pricing Strategy:</strong> Informs your initial pricing strategy based on discount patterns</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecommendationsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Margin Recommendations</h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-generated recommendations to optimize your margins
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recommendations.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{rec.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{rec.carrier_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{rec.current_margin.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">{rec.recommended_margin.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(rec.potential_revenue_impact)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{rec.confidence_score.toFixed(0)}%</td>
                  <td className="px-6 py-4 text-sm">
                    {rec.discount_pattern_detected ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {rec.avg_discount_percentage?.toFixed(1)}% discount
                        </span>
                        <span className="text-xs text-gray-500 mt-1">{rec.discount_confidence_score?.toFixed(0)}% confidence</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {rec.applied ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Applied
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {recommendations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No recommendations available. Run some analyses to generate recommendations.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Analysis History</h3>
          <p className="text-sm text-gray-600 mt-1">
            Track all margin analysis jobs and their results
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phases</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{job.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.carrier_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 capitalize">{job.analysis_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.shipment_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {job.current_margin && job.recommended_margin ? (
                      <span>
                        {job.current_margin.toFixed(1)}% → {job.recommended_margin.toFixed(1)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${job.first_phase_completed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs">Phase 1</span>
                        {job.first_phase_completed && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          job.second_phase_completed_at ? 'bg-green-500' : job.second_phase_started_at ? 'bg-blue-500' : 'bg-gray-300'
                        }`}></div>
                        <span className="text-xs">Phase 2</span>
                        {job.second_phase_completed_at && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {job.status === 'running' && <Loader className="h-3 w-3 mr-1 animate-spin" />}
                      {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {jobs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No analysis history available. Run your first analysis to see results here.</p>
          </div>
        )}
      </div>
    </div>
  );

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
              Analyze and optimize customer-carrier margin performance using AI-powered insights
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'analysis', label: 'Run Analysis', icon: Calculator },
            { id: 'recommendations', label: 'Recommendations', icon: Target },
            { id: 'history', label: 'History', icon: Clock }
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
      {activeTab === 'analysis' && renderAnalysisTab()}
      {activeTab === 'recommendations' && renderRecommendationsTab()}
      {activeTab === 'history' && renderHistoryTab()}
    </div>
  );
};