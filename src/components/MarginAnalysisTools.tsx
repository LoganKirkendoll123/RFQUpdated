import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Target, 
  Clock, 
  Calendar, 
  Truck, 
  Users, 
  DollarSign, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Play,
  ArrowRight,
  Filter,
  Download,
  Eye,
  Zap
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { CarrierSelection } from './CarrierSelection';
import { Project44APIClient } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';

interface MarginAnalysisToolsProps {
  project44Client?: Project44APIClient | null;
}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = ({ project44Client }) => {
  const [activeTab, setActiveTab] = useState<'analysis' | 'recommendations' | 'history'>('analysis');
  const [analysisType, setAnalysisType] = useState<'benchmark' | 'comparison'>('benchmark');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [isSecondPhase, setIsSecondPhase] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Carrier selection state
  const [carrierGroups, setCarrierGroups] = useState<any[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  // Data state
  const [jobs, setJobs] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Set default date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setDateRange({
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    });
  }, []);

  const loadData = async () => {
    await Promise.all([loadJobs(), loadRecommendations()]);
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const loadRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('MarginRecommendations')
        .select('*')
        .order('last_updated', { ascending: false });
      
      if (error) throw error;
      setRecommendations(data || []);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  };

  const loadCarriers = async () => {
    if (!project44Client) {
      setError('Project44 client not available');
      return;
    }

    setIsLoadingCarriers(true);
    try {
      console.log('🚛 Loading carriers for margin analysis...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      console.log(`✅ Loaded ${groups.length} carrier groups for margin analysis`);
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
      setError('Failed to load carriers. Please check your Project44 connection.');
      setCarrierGroups([]);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach((carrier: any) => {
        newSelection[carrier.id] = selected;
      });
    });
    setSelectedCarriers(newSelection);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    const newSelection = { ...selectedCarriers };
    group.carriers.forEach((carrier: any) => {
      newSelection[carrier.id] = selected;
    });
    setSelectedCarriers(newSelection);
  };

  const applyRecommendation = async (recommendation: any) => {
    try {
      // Update the recommendation as applied
      const { error } = await supabase
        .from('MarginRecommendations')
        .update({
          applied: true,
          applied_at: new Date().toISOString(),
          applied_by: 'User' // TODO: Get actual user
        })
        .eq('id', recommendation.id);
      
      if (error) throw error;
      
      // Update CustomerCarriers table with new margin
      const { data: customerCarriers, error: ccError } = await supabase
        .from('CustomerCarriers')
        .select('*')
        .eq('InternalName', recommendation.customer_name)
        .ilike('P44CarrierCode', `%${recommendation.carrier_name}%`);
      
      if (ccError) throw ccError;
      
      if (customerCarriers && customerCarriers.length > 0) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('CustomerCarriers')
          .update({
            Percentage: recommendation.recommended_margin.toString()
          })
          .eq('MarkupId', customerCarriers[0].MarkupId);
        
        if (updateError) throw updateError;
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('CustomerCarriers')
          .insert([{
            InternalName: recommendation.customer_name,
            P44CarrierCode: recommendation.carrier_name,
            Percentage: recommendation.recommended_margin.toString()
          }]);
        
        if (insertError) throw insertError;
      }
      
      setSuccess(`Successfully applied recommendation for ${recommendation.customer_name} with ${recommendation.carrier_name}`);
      await loadRecommendations();
    } catch (err) {
      console.error('Failed to apply recommendation:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply recommendation');
    }
  };

  const runSecondPhaseAnalysis = async (jobId: string) => {
    if (!project44Client) {
      setError('Project44 client not available');
      return;
    }

    setIsRunningAnalysis(true);
    setIsSecondPhase(true);
    setError('');
    setSelectedJobId(jobId);

    try {
      console.log(`🔄 Starting second phase analysis for job: ${jobId}`);

      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('MarginAnalysisJobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      if (!job) throw new Error('Job not found');

      console.log('✅ Found job:', job);

      // Update job status to running
      const { error: updateError } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'running',
          second_phase_started_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Get valid shipments from phase one
      if (!job.phase_one_valid_shipments || job.phase_one_valid_shipments.length === 0) {
        throw new Error('No valid shipments found from phase one');
      }

      const validShipments = job.phase_one_valid_shipments;
      console.log(`📦 Found ${validShipments.length} valid shipments from phase one`);

      // Get carrier ID from job
      const selectedCarrierName = job.carrier_name;
      const selectedCarrier = carrierGroups
        .flatMap(group => group.carriers)
        .find((carrier: any) => carrier.name === selectedCarrierName);

      if (!selectedCarrier) {
        throw new Error(`Selected carrier not found: ${selectedCarrierName}`);
      }

      const selectedCarrierId = selectedCarrier.id;
      console.log(`🚛 Using carrier: ${selectedCarrierName} (ID: ${selectedCarrierId})`);

      // Initialize arrays to store API call data
      const phase2ApiCalls = [];
      const phase2ApiResponses = [];
      const phase2RateData = [];
      
      // Process each valid shipment with P44 API again
      console.log(`🔄 Making P44 API calls for ${validShipments.length} valid shipments...`);
      
      for (const shipment of validShipments) {
        try {
          console.log(`📦 Processing shipment: ${shipment["Invoice #"]}`);
          
          // Convert shipment to RFQ format
          const rfq = {
            fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
            fromZip: shipment["Zip"] || '',
            toZip: shipment["Zip_1"] || '',
            pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
            grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
            isStackable: false,
            accessorial: shipment["Accessorials"]?.split(';') || []
          };
          
          // Call P44 API to get current rates
          console.log(`🔍 Calling P44 API for current rates on shipment ${shipment["Invoice #"]}`);
          const quotes = await project44Client.getQuotes(rfq, [selectedCarrierId], false, false, false);
          
          console.log(`✅ Received ${quotes.length} quotes from P44`);
          
          // Store API call details
          phase2ApiCalls.push({
            shipmentId: shipment["Invoice #"],
            timestamp: new Date().toISOString(),
            request: rfq,
            responseCount: quotes.length
          });
          
          // Store API response
          phase2ApiResponses.push({
            shipmentId: shipment["Invoice #"],
            quotes: quotes
          });
          
          // If we got valid quotes, store the rate data
          if (quotes.length > 0) {
            const bestQuote = quotes.reduce((best, current) => {
              const bestTotal = best.rateQuoteDetail?.total || 
                (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
              
              const currentTotal = current.rateQuoteDetail?.total || 
                (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
              
              return currentTotal < bestTotal ? current : best;
            });
            
            const quoteTotal = bestQuote.rateQuoteDetail?.total || 
              (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts);
            
            phase2RateData.push({
              shipmentId: shipment["Invoice #"],
              customer: shipment["Customer"],
              carrier: selectedCarrierName,
              originalRevenue: parseFloat(shipment["Revenue"] || '0'),
              originalExpense: parseFloat(shipment["Carrier Expense"] || '0'),
              originalProfit: parseFloat(shipment["Profit"] || '0'),
              currentRate: quoteTotal,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`❌ Error processing shipment ${shipment["Invoice #"]}:`, error);
          // Continue with next shipment
        }
      }
      
      console.log(`✅ Completed ${phase2ApiCalls.length} API calls in phase two`);
      
      // Group shipments by customer
      const customerRateData = phase2RateData.reduce((groups, data) => {
        const customer = data.customer || 'Unknown';
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(data);
        return groups;
      }, {} as Record<string, any[]>);
      
      console.log(`👥 Found ${Object.keys(customerRateData).length} customers with rate data in phase two`);
      
      // Compare phase one and phase two data to detect discounts
      const phase1RateData = job.phase_one_rate_data || [];
      
      // Group phase one data by customer and shipment ID
      const phase1ByCustomerAndShipment = phase1RateData.reduce((acc, data) => {
        const customer = data.customer || 'Unknown';
        const shipmentId = data.shipmentId;
        
        if (!acc[customer]) {
          acc[customer] = {};
        }
        
        acc[customer][shipmentId] = data;
        return acc;
      }, {} as Record<string, Record<string, any>>);
      
      // Analyze discount patterns
      const discountAnalysis = [];
      const customerResults = [];
      
      for (const [customer, customerRates] of Object.entries(customerRateData)) {
        console.log(`🔍 Analyzing customer: ${customer} with ${customerRates.length} shipments`);
        
        // Get customer-specific margin from CustomerCarriers table
        const { data: customerCarriers, error: ccError } = await supabase
          .from('CustomerCarriers')
          .select('Percentage, P44CarrierCode')
          .eq('InternalName', customer)
          .ilike('P44CarrierCode', `%${selectedCarrierName}%`);
        
        if (ccError) {
          console.error(`Error fetching margin for ${customer}:`, ccError);
        }
        
        // Calculate current margin from rate data
        const totalRevenue = customerRates.reduce((sum, r) => sum + r.originalRevenue, 0);
        const totalExpense = customerRates.reduce((sum, r) => sum + r.originalExpense, 0);
        const totalProfit = customerRates.reduce((sum, r) => sum + r.originalProfit, 0);
        
        const avgRevenue = customerRates.length > 0 ? totalRevenue / customerRates.length : 0;
        const avgExpense = customerRates.length > 0 ? totalExpense / customerRates.length : 0;
        const avgProfit = customerRates.length > 0 ? totalProfit / customerRates.length : 0;
        
        // Calculate current P44 rates
        const totalCurrentRate = customerRates.reduce((sum, r) => sum + r.currentRate, 0);
        const avgCurrentRate = customerRates.length > 0 ? totalCurrentRate / customerRates.length : 0;
        
        // Calculate current margin as a percentage
        const currentMargin = avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0;
        
        // Get target margin from database or use default
        const targetMargin = customerCarriers && customerCarriers.length > 0 
          ? parseFloat(customerCarriers[0].Percentage || '15')
          : 15; // Default to 15% if no specific margin found
        
        // Calculate confidence score based on number of shipments
        const confidenceScore = Math.min(95, Math.max(60, 70 + (customerRates.length * 2)));
        
        // Calculate potential revenue impact
        const potentialImpact = ((targetMargin - currentMargin) / 100) * avgRevenue * customerRates.length;
        
        // Compare phase one and phase two rates for this customer
        const discountDetails = [];
        let totalDiscountPercentage = 0;
        let discountCount = 0;
        
        for (const phase2Rate of customerRates) {
          const shipmentId = phase2Rate.shipmentId;
          
          if (phase1ByCustomerAndShipment[customer] && 
              phase1ByCustomerAndShipment[customer][shipmentId]) {
            
            const phase1Rate = phase1ByCustomerAndShipment[customer][shipmentId];
            
            // Calculate discount percentage
            const discountPercentage = phase1Rate.currentRate > 0 
              ? ((phase1Rate.currentRate - phase2Rate.currentRate) / phase1Rate.currentRate) * 100
              : 0;
            
            if (Math.abs(discountPercentage) > 1) { // Only count significant discounts (>1%)
              discountDetails.push({
                shipmentId,
                phase1Rate: phase1Rate.currentRate,
                phase2Rate: phase2Rate.currentRate,
                discountPercentage,
                discountAmount: phase1Rate.currentRate - phase2Rate.currentRate
              });
              
              totalDiscountPercentage += discountPercentage;
              discountCount++;
            }
          }
        }
        
        const avgDiscountPercentage = discountCount > 0 ? totalDiscountPercentage / discountCount : 0;
        const hasDiscountPattern = discountCount >= 3 && Math.abs(avgDiscountPercentage) >= 3;
        
        if (hasDiscountPattern) {
          console.log(`💰 Detected discount pattern for ${customer}: ${avgDiscountPercentage.toFixed(2)}% average discount`);
          
          discountAnalysis.push({
            customer,
            avgDiscountPercentage,
            discountCount,
            totalShipments: customerRates.length,
            discountPercentage: (discountCount / customerRates.length) * 100,
            discountDetails,
            currentMargin,
            targetMargin,
            adjustedMargin: targetMargin - avgDiscountPercentage
          });
          
          // Update recommendation with discount information
          const { error: recUpdateError } = await supabase
            .from('MarginRecommendations')
            .update({
              discount_pattern_detected: true,
              avg_discount_percentage: avgDiscountPercentage,
              discount_confidence_score: Math.min(90, 60 + (discountCount * 5)),
              discount_data: {
                discountCount,
                totalShipments: customerRates.length,
                discountPercentage: (discountCount / customerRates.length) * 100,
                discountDetails
              }
            })
            .eq('customer_name', customer)
            .eq('carrier_name', selectedCarrierName);
          
          if (recUpdateError) {
            console.error(`Failed to update recommendation with discount data for ${customer}:`, recUpdateError);
          }
        }
        
        // Store results for this customer
        customerResults.push({
          customer,
          shipmentCount: customerRates.length,
          avgRevenue,
          avgExpense,
          avgProfit,
          avgCurrentRate,
          currentMargin,
          targetMargin,
          confidenceScore,
          potentialImpact,
          hasDiscountPattern,
          avgDiscountPercentage,
          discountCount
        });
      }

      // Update job with second phase results
      const { error: updateError2 } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'completed',
          second_phase_completed_at: new Date().toISOString(),
          phase_two_api_calls: phase2ApiCalls,
          phase_two_api_responses: phase2ApiResponses,
          phase_two_rate_data: phase2RateData,
          second_phase_data: {
            customer_count: Object.keys(customerRateData).length,
            total_shipments: phase2ApiCalls.length,
            matched_shipments: phase2RateData.length,
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

      // Initialize arrays to store API call data
      const apiCalls = [];
      const apiResponses = [];
      const rateData = [];
      const validShipments = [];
      
      // Process each shipment with P44 API
      console.log(`🔄 Making P44 API calls for ALL shipments...`);
      
      for (const shipment of allShipments) {
        try {
          console.log(`📦 Processing shipment: ${shipment["Invoice #"]}`);
          
          // Convert shipment to RFQ format
          const rfq = {
            fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
            fromZip: shipment["Zip"] || '',
            toZip: shipment["Zip_1"] || '',
            pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
            grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
            isStackable: false,
            accessorial: shipment["Accessorials"]?.split(';') || []
          };
          
          // Call P44 API to get current rates
          console.log(`🔍 Calling P44 API for current rates on shipment ${shipment["Invoice #"]}`);
          const quotes = await project44Client!.getQuotes(rfq, [selectedCarrierId], false, false, false);
          
          console.log(`✅ Received ${quotes.length} quotes from P44`);
          
          // Store API call details
          apiCalls.push({
            shipmentId: shipment["Invoice #"],
            timestamp: new Date().toISOString(),
            request: rfq,
            responseCount: quotes.length
          });
          
          // Store API response
          apiResponses.push({
            shipmentId: shipment["Invoice #"],
            quotes: quotes
          });
          
          // If we got valid quotes, store the shipment and rate data
          if (quotes.length > 0) {
            validShipments.push(shipment);
            
            const bestQuote = quotes.reduce((best, current) => {
              const bestTotal = best.rateQuoteDetail?.total || 
                (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
              
              const currentTotal = current.rateQuoteDetail?.total || 
                (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
              
              return currentTotal < bestTotal ? current : best;
            });
            
            const quoteTotal = bestQuote.rateQuoteDetail?.total || 
              (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts);
            
            rateData.push({
              shipmentId: shipment["Invoice #"],
              customer: shipment["Customer"],
              carrier: selectedCarrier.name,
              originalRevenue: parseFloat(shipment["Revenue"] || '0'),
              originalExpense: parseFloat(shipment["Carrier Expense"] || '0'),
              originalProfit: parseFloat(shipment["Profit"] || '0'),
              currentRate: quoteTotal,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`❌ Error processing shipment ${shipment["Invoice #"]}:`, error);
          // Continue with next shipment
        }
      }
      
      console.log(`✅ Completed ${apiCalls.length} API calls, found ${validShipments.length} valid shipments`);
      
      // Group shipments by customer
      const customerRateData = rateData.reduce((groups, data) => {
        const customer = data.customer || 'Unknown';
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(data);
        return groups;
      }, {} as Record<string, any[]>);
      
      console.log(`👥 Found ${Object.keys(customerRateData).length} customers with rate data`);
      
      // Process each customer separately
      const customerResults = [];
      
      for (const [customer, customerRates] of Object.entries(customerRateData)) {
        console.log(`🔍 Analyzing customer: ${customer} with ${customerRates.length} shipments`);
        
        // Get customer-specific margin from CustomerCarriers table
        const { data: customerCarriers, error: ccError } = await supabase
          .from('CustomerCarriers')
          .select('Percentage, P44CarrierCode')
          .eq('InternalName', customer)
          .ilike('P44CarrierCode', `%${selectedCarrier.name}%`);
        
        if (ccError) {
          console.error(`Error fetching margin for ${customer}:`, ccError);
        }
        
        // Calculate current margin from rate data
        const totalRevenue = customerRates.reduce((sum, r) => sum + r.originalRevenue, 0);
        const totalExpense = customerRates.reduce((sum, r) => sum + r.originalExpense, 0);
        const totalProfit = customerRates.reduce((sum, r) => sum + r.originalProfit, 0);
        
        const avgRevenue = customerRates.length > 0 ? totalRevenue / customerRates.length : 0;
        const avgExpense = customerRates.length > 0 ? totalExpense / customerRates.length : 0;
        const avgProfit = customerRates.length > 0 ? totalProfit / customerRates.length : 0;
        
        // Calculate current P44 rates
        const totalCurrentRate = customerRates.reduce((sum, r) => sum + r.currentRate, 0);
        const avgCurrentRate = customerRates.length > 0 ? totalCurrentRate / customerRates.length : 0;
        
        // Calculate current margin as a percentage
        const currentMargin = avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0;
        
        // Get target margin from database or use default
        const targetMargin = customerCarriers && customerCarriers.length > 0 
          ? parseFloat(customerCarriers[0].Percentage || '15')
          : 15; // Default to 15% if no specific margin found
        
        // Calculate confidence score based on number of shipments
        const confidenceScore = Math.min(95, Math.max(60, 70 + (customerRates.length * 2)));
        
        // Calculate potential revenue impact
        const potentialImpact = ((targetMargin - currentMargin) / 100) * avgRevenue * customerRates.length;
        
        console.log(`📊 Analysis for ${customer}:`, {
          shipmentCount: customerRates.length,
          avgRevenue: avgRevenue.toFixed(2),
          avgExpense: avgExpense.toFixed(2),
          avgProfit: avgProfit.toFixed(2),
          avgCurrentRate: avgCurrentRate.toFixed(2),
          currentMargin: currentMargin.toFixed(2),
          targetMargin: targetMargin.toFixed(2),
          confidenceScore,
          potentialImpact: potentialImpact.toFixed(2)
        });
        
        // Store results for this customer
        customerResults.push({
          customer,
          shipmentCount: customerRates.length,
          avgRevenue,
          avgExpense,
          avgProfit,
          avgCurrentRate,
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
              shipment_count: customerRates.length,
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
          phase_one_api_calls: apiCalls,
          phase_one_api_responses: apiResponses,
          phase_one_valid_shipments: validShipments,
          phase_one_rate_data: rateData,
          first_phase_data: {
            customer_count: Object.keys(customerRateData).length,
            total_shipments: allShipments.length,
            valid_shipments: validShipments.length,
            api_calls: apiCalls.length,
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
      {/* Analysis Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Margin Analysis</h2>
        
        <div className="space-y-6">
          {/* Analysis Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Type</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setAnalysisType('benchmark')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  analysisType === 'benchmark'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Target className="h-4 w-4" />
                <span>Benchmark Analysis</span>
              </button>
              <button
                onClick={() => setAnalysisType('comparison')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  analysisType === 'comparison'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Comparison Analysis</span>
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {analysisType === 'benchmark' 
                ? 'Benchmark analysis compares current margins to target margins for a single carrier'
                : 'Comparison analysis compares margins across multiple carriers'}
            </p>
          </div>
          
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
          
          {/* Carrier Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Carrier</label>
            {carrierGroups.length === 0 ? (
              <button
                onClick={loadCarriers}
                disabled={isLoadingCarriers}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {isLoadingCarriers ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Loading Carriers...</span>
                  </>
                ) : (
                  <>
                    <Truck className="h-5 w-5" />
                    <span>Load Carriers</span>
                  </>
                )}
              </button>
            ) : (
              <CarrierSelection
                carrierGroups={carrierGroups}
                selectedCarriers={selectedCarriers}
                onToggleCarrier={handleCarrierToggle}
                onSelectAll={handleSelectAll}
                onSelectAllInGroup={handleSelectAllInGroup}
                isLoading={isLoadingCarriers}
                singleSelect={true}
              />
            )}
          </div>
          
          {/* Run Analysis Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={runMarginAnalysis}
              disabled={isRunningAnalysis || Object.values(selectedCarriers).filter(Boolean).length !== 1 || !dateRange.start || !dateRange.end}
              className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isRunningAnalysis ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Running Analysis...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  <span>Run Margin Analysis</span>
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
            
            {success && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{success}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Analysis Explanation */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Target className="h-5 w-5 text-purple-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-purple-900 mb-2">
              Two-Phase Margin Analysis
            </h3>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <h4 className="font-medium text-purple-900">Phase One: Initial Rate Analysis</h4>
                </div>
                <p className="text-sm text-purple-800 ml-8">
                  The system analyzes all shipments in the selected date range, calling the Project44 API to get current rates for each shipment. It then compares these rates to historical data to calculate current margins and identify optimization opportunities.
                </p>
              </div>
              
              <div className="flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-purple-400" />
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <h4 className="font-medium text-purple-900">Phase Two: Discount Detection</h4>
                </div>
                <p className="text-sm text-purple-800 ml-8">
                  After phase one completes, you can run phase two to detect carrier discount patterns. This phase re-queries the same shipments to see if rates have changed, identifying customers receiving special pricing or dynamic discounts that may not be reflected in your margin settings.
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white rounded-lg border border-purple-100">
              <h4 className="font-medium text-purple-900 mb-2">Benefits:</h4>
              <ul className="list-disc list-inside text-sm text-purple-800 space-y-1">
                <li>Identify customers with suboptimal margins</li>
                <li>Detect hidden carrier discounts</li>
                <li>Quantify potential revenue impact</li>
                <li>Generate data-driven margin recommendations</li>
                <li>Optimize pricing strategies based on actual carrier rates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecommendationsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Margin Recommendations</h2>
              <p className="text-sm text-gray-600">
                AI-powered margin recommendations based on analysis results
              </p>
            </div>
          </div>
          <button
            onClick={loadRecommendations}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Recommendations Yet</h3>
            <p className="text-gray-600">Run a margin analysis to generate recommendations.</p>
          </div>
        ) : (
          recommendations.map(recommendation => (
            <div 
              key={recommendation.id} 
              className={`bg-white rounded-lg shadow-md border ${
                recommendation.applied ? 'border-green-200' : 'border-gray-200'
              } overflow-hidden`}
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-900">{recommendation.customer_name}</h3>
                    {recommendation.applied && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Applied
                      </span>
                    )}
                    {recommendation.discount_pattern_detected && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Discount Detected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Truck className="h-4 w-4" />
                      <span>{recommendation.carrier_name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Package className="h-4 w-4" />
                      <span>{recommendation.shipment_count} shipments</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Avg: {formatCurrency(recommendation.avg_shipment_value)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedRecommendationId(
                    expandedRecommendationId === recommendation.id ? null : recommendation.id
                  )}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {expandedRecommendationId === recommendation.id ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {/* Summary Stats */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Current Margin</div>
                    <div className="text-lg font-bold text-gray-900">{recommendation.current_margin.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Recommended</div>
                    <div className="text-lg font-bold text-green-600">{recommendation.recommended_margin.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Confidence</div>
                    <div className="text-lg font-bold text-blue-600">{recommendation.confidence_score.toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Potential Impact</div>
                    <div className="text-lg font-bold text-purple-600">{formatCurrency(recommendation.potential_revenue_impact)}</div>
                  </div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedRecommendationId === recommendation.id && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="space-y-4">
                    {/* Discount Analysis */}
                    {recommendation.discount_pattern_detected && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h4 className="font-medium text-orange-800 mb-2 flex items-center space-x-2">
                          <Zap className="h-4 w-4" />
                          <span>Discount Pattern Detected</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-orange-700">Avg Discount</div>
                            <div className="font-bold text-orange-900">{recommendation.avg_discount_percentage?.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-orange-700">Confidence</div>
                            <div className="font-bold text-orange-900">{recommendation.discount_confidence_score?.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-orange-700">Adjusted Margin</div>
                            <div className="font-bold text-orange-900">
                              {(recommendation.recommended_margin + (recommendation.avg_discount_percentage || 0)).toFixed(1)}%
                            </div>
                            <div className="text-xs text-orange-700">
                              (Recommended + Discount)
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-orange-700">
                          <p>This customer appears to be receiving dynamic discounts from the carrier. Consider adjusting your margin to account for these discounts.</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Recommendation Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900">Analysis Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Margin Variance</span>
                            <span className="font-medium text-gray-900">{recommendation.margin_variance.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg Shipment Value</span>
                            <span className="font-medium text-gray-900">{formatCurrency(recommendation.avg_shipment_value)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Last Updated</span>
                            <span className="font-medium text-gray-900">
                              {new Date(recommendation.last_updated).toLocaleDateString()}
                            </span>
                          </div>
                          {recommendation.applied && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Applied On</span>
                              <span className="font-medium text-gray-900">
                                {recommendation.applied_at ? new Date(recommendation.applied_at).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900">Impact Analysis</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Per Shipment Impact</span>
                            <span className="font-medium text-green-600">
                              {formatCurrency(recommendation.potential_revenue_impact / recommendation.shipment_count)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Annual Impact (est.)</span>
                            <span className="font-medium text-green-600">
                              {formatCurrency((recommendation.potential_revenue_impact / recommendation.shipment_count) * (recommendation.shipment_count * 12 / 3))}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Implementation Difficulty</span>
                            <span className="font-medium text-blue-600">
                              {recommendation.margin_variance > 5 ? 'High' : recommendation.margin_variance > 2 ? 'Medium' : 'Low'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    {!recommendation.applied && (
                      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                        <button
                          onClick={() => applyRecommendation(recommendation)}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Apply Recommendation</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Analysis History</h2>
              <p className="text-sm text-gray-600">
                View past margin analysis jobs and results
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={loadJobs}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Jobs Yet</h3>
            <p className="text-gray-600">Run a margin analysis to see results here.</p>
          </div>
        ) : (
          jobs.map(job => (
            <div 
              key={job.id} 
              className={`bg-white rounded-lg shadow-md border ${
                job.status === 'completed' ? 'border-green-200' : 
                job.status === 'running' ? 'border-blue-200' :
                job.status === 'failed' ? 'border-red-200' : 'border-gray-200'
              } overflow-hidden`}
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      job.status === 'completed' ? 'bg-green-500' : 
                      job.status === 'running' ? 'bg-blue-500' :
                      job.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {job.analysis_type === 'benchmark' ? 'Benchmark' : 'Comparison'} Analysis
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Truck className="h-4 w-4" />
                      <span>{job.carrier_name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(job.date_range_start).toLocaleDateString()} - {new Date(job.date_range_end).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Package className="h-4 w-4" />
                      <span>{job.shipment_count} shipments</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {job.first_phase_completed && !job.second_phase_started_at && (
                    <button
                      onClick={() => runSecondPhaseAnalysis(job.id)}
                      disabled={isRunningAnalysis}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                    >
                      {isRunningAnalysis && selectedJobId === job.id ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          <span>Running Phase 2...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          <span>Run Phase 2</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedJobId(
                      expandedJobId === job.id ? null : job.id
                    )}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expandedJobId === job.id ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Phase Status */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${job.first_phase_completed ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium text-gray-700">Phase 1</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        job.second_phase_completed_at ? 'bg-green-500' : 
                        job.second_phase_started_at ? 'bg-blue-500' : 'bg-gray-300'
                      }`} />
                      <span className="text-sm font-medium text-gray-700">Phase 2</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {job.created_at && (
                      <span>Created: {new Date(job.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedJobId === job.id && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="space-y-4">
                    {/* Phase 1 Results */}
                    {job.first_phase_completed && job.first_phase_data && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Phase 1 Results</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">Customers Analyzed</div>
                            <div className="text-xl font-bold text-gray-900">{job.first_phase_data.customer_count}</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">Total Shipments</div>
                            <div className="text-xl font-bold text-gray-900">{job.first_phase_data.total_shipments}</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">Valid Shipments</div>
                            <div className="text-xl font-bold text-gray-900">{job.first_phase_data.valid_shipments}</div>
                          </div>
                        </div>
                        
                        {/* Customer Results Summary */}
                        {job.first_phase_data.customer_results && job.first_phase_data.customer_results.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Top Customers by Impact</h5>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipments</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Margin</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Margin</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Impact</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {job.first_phase_data.customer_results
                                    .sort((a: any, b: any) => Math.abs(b.potentialImpact) - Math.abs(a.potentialImpact))
                                    .slice(0, 5)
                                    .map((result: any, index: number) => (
                                      <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.customer}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.shipmentCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.currentMargin.toFixed(1)}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.targetMargin.toFixed(1)}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(result.potentialImpact)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Phase 2 Results */}
                    {job.second_phase_completed_at && job.second_phase_data && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-3">Phase 2 Results</h4>
                        
                        {/* Discount Analysis */}
                        {job.discount_analysis_data && job.discount_analysis_data.discount_count > 0 && (
                          <div className="space-y-4">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                              <h5 className="text-sm font-medium text-orange-800 mb-2 flex items-center space-x-2">
                                <Zap className="h-4 w-4" />
                                <span>Discount Patterns Detected</span>
                              </h5>
                              <p className="text-sm text-orange-700 mb-3">
                                Found {job.discount_analysis_data.discount_count} customers with significant discount patterns between phase 1 and phase 2.
                              </p>
                              
                              <div className="bg-white rounded-lg border border-orange-100 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Discount</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipments</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Margin</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adjusted Margin</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {job.discount_analysis_data.discount_details
                                      .sort((a: any, b: any) => Math.abs(b.avgDiscountPercentage) - Math.abs(a.avgDiscountPercentage))
                                      .map((discount: any, index: number) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{discount.customer}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">{discount.avgDiscountPercentage.toFixed(1)}%</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{discount.discountCount} / {discount.totalShipments}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{discount.currentMargin.toFixed(1)}%</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{discount.adjustedMargin.toFixed(1)}%</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Customer Results Summary */}
                        {job.second_phase_data.customer_results && job.second_phase_data.customer_results.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Phase 2 Customer Results</h5>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipments</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Margin</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Margin</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {job.second_phase_data.customer_results
                                    .sort((a: any, b: any) => (b.hasDiscountPattern ? 1 : 0) - (a.hasDiscountPattern ? 1 : 0))
                                    .slice(0, 5)
                                    .map((result: any, index: number) => (
                                      <tr key={index} className={`hover:bg-gray-50 ${result.hasDiscountPattern ? 'bg-orange-50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.customer}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.shipmentCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.currentMargin.toFixed(1)}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.targetMargin.toFixed(1)}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                          {result.hasDiscountPattern ? (
                                            <span className="font-medium text-orange-600">{result.avgDiscountPercentage.toFixed(1)}%</span>
                                          ) : (
                                            <span className="text-gray-500">None detected</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Error Message */}
                    {job.error_message && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2 text-red-700">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">{job.error_message}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                      <button
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Full Report</span>
                      </button>
                      <button
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        <span>Export Data</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
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