import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  Users,
  Package,
  Play,
  Loader,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  BarChart3,
  Truck,
  DollarSign,
  Clock,
  AlertCircle,
  RefreshCw,
  Target,
  TrendingUp,
  Building2,
  MapPin
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { PricingSettings, RFQRow, ProcessingResult, QuoteWithPricing } from '../types';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQCard } from './RFQCard';
import * as XLSX from 'xlsx';

interface MassRFQFromShipmentsProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

interface CustomerShipmentSummary {
  customerName: string;
  shipmentCount: number;
  totalWeight: number;
  totalRevenue: number;
  avgRevenue: number;
  dateRange: { start: string; end: string };
  topLanes: Array<{ lane: string; count: number }>;
  topCarriers: Array<{ carrier: string; count: number }>;
}

interface MassRFQJob {
  id: string;
  customerName: string;
  shipmentCount: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  results?: ProcessingResult[];
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export const MassRFQFromShipments: React.FC<MassRFQFromShipmentsProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  
  const [customerSummaries, setCustomerSummaries] = useState<CustomerShipmentSummary[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<{ [customer: string]: boolean }>({});
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [massRFQJobs, setMassRFQJobs] = useState<MassRFQJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Filters
  const [minShipments, setMinShipments] = useState(5);
  const [minRevenue, setMinRevenue] = useState(1000);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSalesRep, setSelectedSalesRep] = useState('');
  
  // Filter options
  const [branches, setBranches] = useState<string[]>([]);
  const [salesReps, setSalesReps] = useState<string[]>([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadCustomerShipments();
    }
  }, [dateRange, minShipments, minRevenue, selectedBranch, selectedSalesRep]);

  const loadFilterOptions = async () => {
    try {
      // Load unique branches
      const { data: branchData, error: branchError } = await supabase
        .from('Shipments')
        .select('"Branch"')
        .not('"Branch"', 'is', null);
      
      if (!branchError && branchData) {
        const uniqueBranches = [...new Set(branchData.map(d => d.Branch).filter(Boolean))];
        setBranches(uniqueBranches);
      }
      
      // Load unique sales reps
      const { data: salesRepData, error: salesRepError } = await supabase
        .from('Shipments')
        .select('"Sales Rep"')
        .not('"Sales Rep"', 'is', null);
      
      if (!salesRepError && salesRepData) {
        const uniqueSalesReps = [...new Set(salesRepData.map(d => d["Sales Rep"]).filter(Boolean))];
        setSalesReps(uniqueSalesReps);
      }
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadCustomerShipments = async () => {
    setIsLoadingShipments(true);
    setError('');
    
    try {
      console.log('🔍 Loading customer shipments for mass RFQ analysis...');
      
      let query = supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .not('"Customer"', 'is', null);
      
      // Apply filters
      if (selectedBranch) {
        query = query.eq('"Branch"', selectedBranch);
      }
      
      if (selectedSalesRep) {
        query = query.eq('"Sales Rep"', selectedSalesRep);
      }
      
      const { data: shipments, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (!shipments || shipments.length === 0) {
        setCustomerSummaries([]);
        return;
      }
      
      console.log(`📦 Loaded ${shipments.length} shipments for analysis`);
      
      // Group shipments by customer
      const customerGroups = shipments.reduce((groups, shipment) => {
        const customer = shipment.Customer;
        if (!customer) return groups;
        
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(shipment);
        return groups;
      }, {} as Record<string, any[]>);
      
      // Create customer summaries
      const summaries: CustomerShipmentSummary[] = Object.entries(customerGroups)
        .map(([customerName, customerShipments]) => {
          const parseNumeric = (value: string | null | undefined): number => {
            if (!value) return 0;
            const cleaned = value.toString().replace(/[^\d.-]/g, '');
            return parseFloat(cleaned) || 0;
          };
          
          const totalWeight = customerShipments.reduce((sum, s) => {
            const weight = parseNumeric(s["Tot Weight"]);
            return sum + weight;
          }, 0);
          
          const totalRevenue = customerShipments.reduce((sum, s) => {
            const revenue = parseNumeric(s["Revenue"]);
            return sum + revenue;
          }, 0);
          
          // Get date range for this customer
          const dates = customerShipments
            .map(s => s["Scheduled Pickup Date"])
            .filter(Boolean)
            .sort();
          
          // Top lanes
          const laneCounts = customerShipments.reduce((acc, s) => {
            const originZip = s["Zip"];
            const destZip = s["Zip_1"];
            if (originZip && destZip) {
              const lane = `${originZip} → ${destZip}`;
              acc[lane] = (acc[lane] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);
          
          const topLanes = Object.entries(laneCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([lane, count]) => ({ lane, count }));
          
          // Top carriers
          const carrierCounts = customerShipments.reduce((acc, s) => {
            const carrier = s["Booked Carrier"] || s["Quoted Carrier"];
            if (carrier) {
              acc[carrier] = (acc[carrier] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);
          
          const topCarriers = Object.entries(carrierCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([carrier, count]) => ({ carrier, count }));
          
          return {
            customerName,
            shipmentCount: customerShipments.length,
            totalWeight,
            totalRevenue,
            avgRevenue: totalRevenue / customerShipments.length,
            dateRange: {
              start: dates[0] || dateRange.start,
              end: dates[dates.length - 1] || dateRange.end
            },
            topLanes,
            topCarriers
          };
        })
        .filter(summary => 
          summary.shipmentCount >= minShipments && 
          summary.totalRevenue >= minRevenue
        )
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      setCustomerSummaries(summaries);
      console.log(`✅ Created summaries for ${summaries.length} customers meeting criteria`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load customer shipments';
      setError(errorMsg);
      console.error('❌ Failed to load customer shipments:', err);
    } finally {
      setIsLoadingShipments(false);
    }
  };

  const handleCustomerToggle = (customerName: string, selected: boolean) => {
    setSelectedCustomers(prev => ({
      ...prev,
      [customerName]: selected
    }));
  };

  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [customer: string]: boolean } = {};
    customerSummaries.forEach(summary => {
      newSelection[summary.customerName] = selected;
    });
    setSelectedCustomers(newSelection);
  };

  const convertShipmentToRFQ = (shipment: any): RFQRow => {
    const parseNumeric = (value: string | null | undefined): number => {
      if (!value) return 0;
      const cleaned = value.toString().replace(/[^\d.-]/g, '');
      return parseFloat(cleaned) || 0;
    };
    
    // Estimate pallets from weight if not available
    const weight = parseNumeric(shipment["Tot Weight"]);
    const packages = parseNumeric(shipment["Tot Packages"]) || 1;
    const estimatedPallets = Math.max(1, Math.ceil(packages / 4)); // Rough estimate
    
    return {
      fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
      fromZip: shipment["Zip"] || '00000',
      toZip: shipment["Zip_1"] || '00000',
      pallets: estimatedPallets,
      grossWeight: weight,
      isStackable: false, // Conservative default
      isReefer: false, // Default to dry goods
      accessorial: shipment["Accessorials"] ? shipment["Accessorials"].split(';').filter(Boolean) : [],
      freightClass: shipment["Max Freight Class"] || '70',
      commodityDescription: shipment["Commodities"] || 'General Freight',
      originCity: shipment["Origin City"],
      originState: shipment["State"],
      destinationCity: shipment["Destination City"],
      destinationState: shipment["State_1"],
      totalLinearFeet: shipment["Tot Linear Ft"] ? parseNumeric(shipment["Tot Linear Ft"]) : undefined
    };
  };

  const processMassRFQ = async () => {
    const selectedCustomerNames = Object.entries(selectedCustomers)
      .filter(([_, selected]) => selected)
      .map(([customer, _]) => customer);
    
    if (selectedCustomerNames.length === 0) {
      setError('Please select at least one customer');
      return;
    }
    
    if (!project44Client) {
      setError('Project44 client not available');
      return;
    }
    
    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
    
    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    // Initialize jobs
    const jobs: MassRFQJob[] = selectedCustomerNames.map(customerName => ({
      id: `${customerName}-${Date.now()}`,
      customerName,
      shipmentCount: customerSummaries.find(s => s.customerName === customerName)?.shipmentCount || 0,
      status: 'pending',
      progress: 0
    }));
    
    setMassRFQJobs(jobs);
    
    try {
      console.log(`🚀 Starting mass RFQ for ${selectedCustomerNames.length} customers`);
      
      // Process each customer sequentially
      for (let i = 0; i < selectedCustomerNames.length; i++) {
        const customerName = selectedCustomerNames[i];
        const jobId = jobs[i].id;
        
        // Update job status
        setMassRFQJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'processing', startTime: new Date() }
            : job
        ));
        
        try {
          console.log(`📋 Processing customer ${i + 1}/${selectedCustomerNames.length}: ${customerName}`);
          
          // Load shipments for this customer
          let query = supabase
            .from('Shipments')
            .select('*')
            .eq('"Customer"', customerName)
            .gte('"Scheduled Pickup Date"', dateRange.start)
            .lte('"Scheduled Pickup Date"', dateRange.end);
          
          if (selectedBranch) {
            query = query.eq('"Branch"', selectedBranch);
          }
          
          if (selectedSalesRep) {
            query = query.eq('"Sales Rep"', selectedSalesRep);
          }
          
          const { data: customerShipments, error: shipmentError } = await query;
          
          if (shipmentError) {
            throw shipmentError;
          }
          
          if (!customerShipments || customerShipments.length === 0) {
            throw new Error('No shipments found for customer');
          }
          
          console.log(`📦 Found ${customerShipments.length} shipments for ${customerName}`);
          
          // Convert shipments to RFQs
          const rfqs: RFQRow[] = customerShipments.map(convertShipmentToRFQ);
          
          // Process RFQs
          const customerResults: ProcessingResult[] = [];
          
          for (let rfqIndex = 0; rfqIndex < rfqs.length; rfqIndex++) {
            const rfq = rfqs[rfqIndex];
            
            // Update progress
            const progress = ((rfqIndex + 1) / rfqs.length) * 100;
            setMassRFQJobs(prev => prev.map(job => 
              job.id === jobId 
                ? { ...job, progress }
                : job
            ));
            
            try {
              // Classify shipment for smart routing
              const classification = classifyShipment(rfq);
              
              let quotes: any[] = [];
              
              if (classification.quoting === 'freshx' && freshxClient) {
                quotes = await freshxClient.getQuotes(rfq);
              } else if (classification.quoting === 'project44-dual') {
                const [volumeQuotes, standardQuotes] = await Promise.all([
                  project44Client.getQuotes(rfq, selectedCarrierIds, true, false, false),
                  project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false)
                ]);
                
                const taggedVolumeQuotes = volumeQuotes.map(quote => ({
                  ...quote,
                  quoteMode: 'volume',
                  quoteModeLabel: 'Volume LTL'
                }));
                
                const taggedStandardQuotes = standardQuotes.map(quote => ({
                  ...quote,
                  quoteMode: 'standard',
                  quoteModeLabel: 'Standard LTL'
                }));
                
                quotes = [...taggedVolumeQuotes, ...taggedStandardQuotes];
              } else {
                quotes = await project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false);
              }
              
              // Apply pricing
              const quotesWithPricing = await Promise.all(
                quotes.map(quote => 
                  calculatePricingWithCustomerMargins(quote, pricingSettings, customerName)
                )
              );
              
              const result: ProcessingResult = {
                rowIndex: rfqIndex,
                originalData: rfq,
                quotes: quotesWithPricing,
                status: 'success'
              };
              
              // Add smart quoting metadata
              (result as any).quotingDecision = classification.quoting;
              (result as any).quotingReason = classification.reason;
              
              customerResults.push(result);
              
            } catch (rfqError) {
              console.error(`❌ RFQ ${rfqIndex + 1} failed for ${customerName}:`, rfqError);
              
              const result: ProcessingResult = {
                rowIndex: rfqIndex,
                originalData: rfq,
                quotes: [],
                status: 'error',
                error: rfqError instanceof Error ? rfqError.message : 'Unknown error'
              };
              
              customerResults.push(result);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Update job completion
          setMassRFQJobs(prev => prev.map(job => 
            job.id === jobId 
              ? { 
                  ...job, 
                  status: 'completed', 
                  progress: 100, 
                  results: customerResults,
                  endTime: new Date()
                }
              : job
          ));
          
          console.log(`✅ Completed customer ${customerName}: ${customerResults.length} results`);
          
        } catch (customerError) {
          console.error(`❌ Customer ${customerName} failed:`, customerError);
          
          setMassRFQJobs(prev => prev.map(job => 
            job.id === jobId 
              ? { 
                  ...job, 
                  status: 'error', 
                  error: customerError instanceof Error ? customerError.message : 'Unknown error',
                  endTime: new Date()
                }
              : job
          ));
        }
      }
      
      console.log('🏁 Mass RFQ processing completed');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Mass RFQ processing failed';
      setError(errorMsg);
      console.error('❌ Mass RFQ processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const classifyShipment = (rfq: RFQRow): {quoting: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual', reason: string} => {
    if (rfq.isReefer === true) {
      return {
        quoting: 'freshx',
        reason: `Marked as reefer shipment - quoted through FreshX reefer network`
      };
    }
    
    if (rfq.pallets >= 10 || rfq.grossWeight >= 15000) {
      return {
        quoting: 'project44-dual',
        reason: `Large shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through both Project44 Volume LTL and Standard LTL`
      };
    } else {
      return {
        quoting: 'project44-standard',
        reason: `Standard shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through Project44 Standard LTL`
      };
    }
  };

  const exportAllResults = () => {
    const completedJobs = massRFQJobs.filter(job => job.status === 'completed' && job.results);
    
    if (completedJobs.length === 0) {
      alert('No completed jobs to export');
      return;
    }
    
    const exportData = completedJobs.flatMap(job => 
      job.results!.flatMap(result => 
        result.quotes.map(quote => {
          const quoteWithPricing = quote as QuoteWithPricing;
          
          return {
            'Customer': job.customerName,
            'RFQ Number': result.rowIndex + 1,
            'Origin ZIP': result.originalData.fromZip,
            'Destination ZIP': result.originalData.toZip,
            'Pallets': result.originalData.pallets,
            'Weight (lbs)': result.originalData.grossWeight,
            'Pickup Date': result.originalData.fromDate,
            'Carrier Name': quote.carrier.name,
            'Carrier SCAC': quote.carrier.scac || '',
            'Service Level': quote.serviceLevel?.description || '',
            'Transit Days': quote.transitDays || '',
            'Carrier Rate': quoteWithPricing.carrierTotalRate || 0,
            'Customer Price': quoteWithPricing.customerPrice || 0,
            'Profit Margin': quoteWithPricing.profit || 0,
            'Processing Status': result.status.toUpperCase(),
            'Error Message': result.error || ''
          };
        })
      )
    );
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mass RFQ Results');
    
    const fileName = `mass-rfq-results-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const selectedCount = Object.values(selectedCustomers).filter(Boolean).length;
  const totalShipments = customerSummaries
    .filter(summary => selectedCustomers[summary.customerName])
    .reduce((sum, summary) => sum + summary.shipmentCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Mass RFQ from Shipments</h1>
            <p className="text-sm text-gray-600">
              Analyze historical shipments and generate bulk RFQs by customer for competitive pricing analysis
            </p>
          </div>
        </div>
      </div>

      {/* Date Range and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Shipments</label>
            <input
              type="number"
              min="1"
              value={minShipments}
              onChange={(e) => setMinShipments(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Revenue</label>
            <input
              type="number"
              min="0"
              value={minRevenue}
              onChange={(e) => setMinRevenue(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch Filter</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep Filter</label>
            <select
              value={selectedSalesRep}
              onChange={(e) => setSelectedSalesRep(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Sales Reps</option>
              {salesReps.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex items-center space-x-4">
          <button
            onClick={loadCustomerShipments}
            disabled={isLoadingShipments}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isLoadingShipments ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Analyze Shipments</span>
          </button>
          
          {customerSummaries.length > 0 && (
            <div className="text-sm text-gray-600">
              Found {customerSummaries.length} customers with {customerSummaries.reduce((sum, s) => sum + s.shipmentCount, 0)} total shipments
            </div>
          )}
        </div>
      </div>

      {/* Customer Selection */}
      {customerSummaries.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Customer Selection</h3>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {customerSummaries.map((summary) => (
                <div
                  key={summary.customerName}
                  className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                    selectedCustomers[summary.customerName]
                      ? 'border-purple-500 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleCustomerToggle(summary.customerName, !selectedCustomers[summary.customerName])}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedCustomers[summary.customerName] || false}
                        onChange={() => {}}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900">{summary.customerName}</h4>
                        <p className="text-sm text-gray-600">
                          {summary.dateRange.start} to {summary.dateRange.end}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(summary.totalRevenue)}
                      </div>
                      <div className="text-sm text-gray-500">Total Revenue</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {summary.shipmentCount} shipments
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {formatCurrency(summary.avgRevenue)} avg
                      </span>
                    </div>
                  </div>
                  
                  {summary.topLanes.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-gray-700 mb-1">Top Lanes:</div>
                      <div className="text-xs text-gray-600">
                        {summary.topLanes.map(lane => `${lane.lane} (${lane.count})`).join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {summary.topCarriers.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Top Carriers:</div>
                      <div className="text-xs text-gray-600">
                        {summary.topCarriers.map(carrier => `${carrier.carrier} (${carrier.count})`).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {selectedCount > 0 && (
            <div className="px-6 py-4 bg-purple-50 border-t border-purple-200">
              <div className="flex items-center justify-between">
                <div className="text-purple-800">
                  <span className="font-medium">{selectedCount} customers selected</span>
                  <span className="ml-2 text-sm">({totalShipments} total shipments)</span>
                </div>
                <button
                  onClick={processMassRFQ}
                  disabled={isProcessing || !project44Client}
                  className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      <span>Start Mass RFQ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing Jobs */}
      {massRFQJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Mass RFQ Jobs</h3>
              {massRFQJobs.some(job => job.status === 'completed') && (
                <button
                  onClick={exportAllResults}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Export All Results</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {massRFQJobs.map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        job.status === 'completed' ? 'bg-green-100' :
                        job.status === 'processing' ? 'bg-blue-100' :
                        job.status === 'error' ? 'bg-red-100' :
                        'bg-gray-100'
                      }`}>
                        {job.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : job.status === 'processing' ? (
                          <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                        ) : job.status === 'error' ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{job.customerName}</h4>
                        <p className="text-sm text-gray-600">
                          {job.shipmentCount} shipments • Status: {job.status}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {job.status === 'processing' && (
                        <div className="text-sm text-blue-600 font-medium">
                          {job.progress.toFixed(0)}% complete
                        </div>
                      )}
                      {job.status === 'completed' && job.results && (
                        <div className="text-sm text-green-600 font-medium">
                          {job.results.filter(r => r.status === 'success').length} successful
                        </div>
                      )}
                      {job.endTime && job.startTime && (
                        <div className="text-xs text-gray-500">
                          {Math.round((job.endTime.getTime() - job.startTime.getTime()) / 1000)}s
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {job.status === 'processing' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                  
                  {job.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{job.error}</span>
                      </div>
                    </div>
                  )}
                  
                  {job.status === 'completed' && job.results && (
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-green-600">
                          {job.results.filter(r => r.status === 'success').length}
                        </div>
                        <div className="text-gray-600">Successful</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-red-600">
                          {job.results.filter(r => r.status === 'error').length}
                        </div>
                        <div className="text-gray-600">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">
                          {job.results.reduce((sum, r) => sum + r.quotes.length, 0)}
                        </div>
                        <div className="text-gray-600">Total Quotes</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {massRFQJobs.some(job => job.status === 'completed' && job.results) && (
        <div className="space-y-6">
          {massRFQJobs
            .filter(job => job.status === 'completed' && job.results)
            .map(job => (
              <div key={job.id} className="space-y-4">
                <div className="bg-white rounded-lg shadow-md p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Results for {job.customerName}
                  </h3>
                  <div className="text-sm text-gray-600">
                    {job.results!.filter(r => r.status === 'success').length} successful RFQs • 
                    {job.results!.reduce((sum, r) => sum + r.quotes.length, 0)} total quotes received
                  </div>
                </div>
                
                {job.results!
                  .filter(result => result.status === 'success' && result.quotes.length > 0)
                  .slice(0, 3) // Show first 3 results
                  .map((result, index) => (
                    <RFQCard
                      key={`${job.id}-${index}`}
                      result={result}
                      onPriceUpdate={() => {}} // Read-only for mass results
                    />
                  ))}
                
                {job.results!.filter(r => r.status === 'success' && r.quotes.length > 0).length > 3 && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-gray-600">
                      Showing 3 of {job.results!.filter(r => r.status === 'success' && r.quotes.length > 0).length} successful results.
                      Export all results to see complete data.
                    </p>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};