import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Truck, 
  Users, 
  Building2, 
  Calendar, 
  RefreshCw, 
  Play, 
  Loader, 
  CheckCircle, 
  AlertCircle, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  Clock,
  MapPin,
  Package,
  Filter,
  Search,
  Save,
  Download
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { CarrierSelection } from './CarrierSelection';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQCard } from './RFQCard';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { PricingSettings, RFQRow, ProcessingResult, QuoteWithPricing } from '../types';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import * as XLSX from 'xlsx';

export const MarginAnalysisTools: React.FC = () => {
  // UI state
  const [activeTab, setActiveTab] = useState<'setup' | 'processing' | 'results'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Data state
  const [customerList, setCustomerList] = useState<string[]>([]);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  
  // Shipment data state
  const [shipments, setShipments] = useState<any[]>([]);
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentCustomer, setCurrentCustomer] = useState<string>('');
  const [currentCarrier, setCurrentCarrier] = useState<string>('');
  
  // Results state
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [customerResults, setCustomerResults] = useState<{[customer: string]: ProcessingResult[]}>({});
  const [customerSummary, setCustomerSummary] = useState<{[customer: string]: {
    totalShipments: number;
    totalCarrierCost: number;
    totalRevenue: number;
    totalProfit: number;
    avgMargin: number;
  }}>({});
  
  // Pricing settings
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 23,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: true,
    fallbackMarkupPercentage: 23
  });

  // Initialize on component mount
  useEffect(() => {
    loadCustomerList();
    initializeProject44Client();
  }, []);

  const initializeProject44Client = () => {
    const savedConfig = loadProject44Config();
    if (savedConfig) {
      console.log('✅ Loaded saved Project44 config');
      const client = new Project44APIClient(savedConfig);
      setProject44Client(client);
    }
  };

  const loadCustomerList = async () => {
    try {
      console.log('🔍 Loading customer list...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select('Customer')
        .not('Customer', 'is', null)
        .not('Customer', 'eq', '');
      
      if (error) {
        console.error('❌ Error loading customers:', error);
        return;
      }
      
      // Get unique customers
      const uniqueCustomers = [...new Set(data.map(row => row.Customer))].sort();
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers`);
      setCustomerList(uniqueCustomers);
    } catch (err) {
      console.error('❌ Failed to load customer list:', err);
    }
  };

  const loadCarriers = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please check your API configuration.');
      return;
    }

    setIsLoadingCarriers(true);
    setCarriersLoaded(false);
    try {
      console.log('🚛 Loading carriers for margin analysis...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      setCarriersLoaded(true);
      console.log(`✅ Loaded ${groups.length} carrier groups for margin analysis`);
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
      setCarrierGroups([]);
      setCarriersLoaded(false);
      setError('Failed to load carriers from Project44. Please check your API configuration.');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const loadShipments = async () => {
    if (!selectedCustomer) {
      setError('Please select a customer to analyze');
      return;
    }

    setLoading(true);
    setError('');
    try {
      console.log(`🔍 Loading shipments for customer: ${selectedCustomer}`);
      
      // Query shipments for the selected customer and date range
      const { data, error } = await supabase
        .from('Shipments')
        .select('*')
        .eq('Customer', selectedCustomer)
        .gte('Scheduled Pickup Date', dateRange.start)
        .lte('Scheduled Pickup Date', dateRange.end)
        .order('Scheduled Pickup Date', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Loaded ${data.length} shipments for ${selectedCustomer}`);
      setShipments(data || []);
      
      // Convert shipments to RFQ format
      const rfqs = convertShipmentsToRFQs(data || []);
      setRfqData(rfqs);
      console.log(`✅ Converted ${rfqs.length} shipments to RFQ format`);
      
      setActiveTab('processing');
    } catch (err) {
      console.error('❌ Failed to load shipments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const convertShipmentsToRFQs = (shipments: any[]): RFQRow[] => {
    return shipments.map(shipment => {
      // Parse weight from string format
      const weightStr = shipment['Tot Weight'] || '0';
      const weight = parseInt(weightStr.replace(/[^\d]/g, '')) || 1000;
      
      // Parse pallets
      const pallets = shipment['Tot Packages'] || 1;
      
      // Determine if this is a VLTL shipment
      const isVLTL = shipment['Is VLTL'] === 'TRUE';
      
      return {
        fromDate: shipment['Scheduled Pickup Date'] || new Date().toISOString().split('T')[0],
        fromZip: shipment['Zip'] || '',
        toZip: shipment['Zip_1'] || '',
        pallets: pallets,
        grossWeight: weight,
        isStackable: false,
        accessorial: [],
        originCity: shipment['Origin City'] || '',
        originState: shipment['State'] || '',
        destinationCity: shipment['Destination City'] || '',
        destinationState: shipment['State_1'] || '',
        freightClass: shipment['Max Freight Class'] || '70',
        commodityDescription: shipment['Commodities'] || 'General Freight',
        totalLinearFeet: isVLTL ? Math.ceil((pallets * 48) / 12) : undefined // Calculate linear feet for VLTL
      };
    });
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };
  
  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
    });
    setSelectedCarriers(newSelection);
  };
  
  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    const newSelection = { ...selectedCarriers };
    group.carriers.forEach(carrier => {
      newSelection[carrier.id] = selected;
    });
    setSelectedCarriers(newSelection);
  };

  const processRFQs = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please check your API configuration.');
      return;
    }

    if (rfqData.length === 0) {
      setError('No shipment data to process');
      return;
    }

    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier to analyze');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setCustomerResults({});
    setCustomerSummary({});
    setTotalSteps(rfqData.length);
    setCurrentStep(0);
    setError('');

    console.log(`🧠 Starting margin analysis for ${rfqData.length} shipments with ${selectedCarrierIds.length} selected carriers`);

    const allResults: ProcessingResult[] = [];
    const customerResultsMap: {[customer: string]: ProcessingResult[]} = {};

    for (let i = 0; i < rfqData.length; i++) {
      const rfq = rfqData[i];
      setCurrentStep(i + 1);
      setCurrentCustomer(selectedCustomer);
      
      const result: ProcessingResult = {
        rowIndex: i,
        originalData: rfq,
        quotes: [],
        status: 'processing'
      };

      try {
        // Determine if this is a VLTL shipment
        const isVolumeMode = rfq.pallets >= 10 || rfq.grossWeight >= 15000;
        setCurrentCarrier(`Shipment ${i + 1}/${rfqData.length}: ${isVolumeMode ? 'Volume LTL' : 'Standard LTL'}`);
        
        console.log(`📦 Processing shipment ${i + 1}/${rfqData.length}: ${rfq.fromZip} → ${rfq.toZip}, ${rfq.pallets} pallets, ${rfq.grossWeight} lbs`);
        
        // Get quotes from Project44
        const quotes = await project44Client.getQuotes(rfq, selectedCarrierIds, isVolumeMode);
        
        if (quotes.length > 0) {
          // Apply pricing to quotes
          const quotesWithPricing = await Promise.all(
            quotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
            )
          );
          
          result.quotes = quotesWithPricing;
          result.status = 'success';
          console.log(`✅ Shipment ${i + 1} completed: ${quotes.length} quotes received`);
        } else {
          result.status = 'success'; // No error, just no quotes
          console.log(`ℹ️ Shipment ${i + 1} completed: No quotes received`);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        result.status = 'error';
        console.error(`❌ Shipment ${i + 1} failed:`, error);
      }

      allResults.push(result);
      
      // Group by customer
      if (!customerResultsMap[selectedCustomer]) {
        customerResultsMap[selectedCustomer] = [];
      }
      customerResultsMap[selectedCustomer].push(result);
      
      setResults([...allResults]);
      setCustomerResults({...customerResultsMap});

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate summary statistics for each customer
    const summaryMap: {[customer: string]: {
      totalShipments: number;
      totalCarrierCost: number;
      totalRevenue: number;
      totalProfit: number;
      avgMargin: number;
    }} = {};

    Object.entries(customerResultsMap).forEach(([customer, results]) => {
      const successfulResults = results.filter(r => r.status === 'success' && r.quotes.length > 0);
      
      if (successfulResults.length === 0) {
        summaryMap[customer] = {
          totalShipments: results.length,
          totalCarrierCost: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgMargin: 0
        };
        return;
      }
      
      // Get all quotes from successful results
      const allQuotes = successfulResults.flatMap(r => r.quotes as QuoteWithPricing[]);
      
      // Calculate totals
      const totalCarrierCost = allQuotes.reduce((sum, q) => sum + q.carrierTotalRate, 0);
      const totalRevenue = allQuotes.reduce((sum, q) => sum + q.customerPrice, 0);
      const totalProfit = allQuotes.reduce((sum, q) => sum + q.profit, 0);
      
      summaryMap[customer] = {
        totalShipments: successfulResults.length,
        totalCarrierCost,
        totalRevenue,
        totalProfit,
        avgMargin: totalCarrierCost > 0 ? (totalProfit / totalCarrierCost) * 100 : 0
      };
    });

    setCustomerSummary(summaryMap);
    setIsProcessing(false);
    setCurrentCarrier('');
    setActiveTab('results');
    console.log(`🏁 Margin analysis completed: ${allResults.length} total results`);
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      const result = newResults[resultIndex];
      
      if (result && result.quotes) {
        const updatedQuotes = result.quotes.map(quote => {
          if (quote.quoteId === quoteId) {
            return calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer, newPrice);
          }
          return quote;
        });
        
        newResults[resultIndex] = {
          ...result,
          quotes: updatedQuotes
        };
      }
      
      return newResults;
    });
    
    // Also update in customer results
    setCustomerResults(prevResults => {
      const newResults = {...prevResults};
      
      Object.keys(newResults).forEach(customer => {
        newResults[customer] = newResults[customer].map((result, idx) => {
          if (idx === resultIndex) {
            return {
              ...result,
              quotes: result.quotes.map(quote => {
                if (quote.quoteId === quoteId) {
                  return calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer, newPrice);
                }
                return quote;
              })
            };
          }
          return result;
        });
      });
      
      return newResults;
    });
  };

  const exportResults = () => {
    if (Object.keys(customerResults).length === 0) return;

    const exportData: any[] = [];
    
    // Flatten all results by customer
    Object.entries(customerResults).forEach(([customer, results]) => {
      results.forEach(result => {
        result.quotes.forEach(quote => {
          const quoteWithPricing = quote as QuoteWithPricing;
          
          exportData.push({
            'Customer': customer,
            'Origin ZIP': result.originalData.fromZip,
            'Destination ZIP': result.originalData.toZip,
            'Pallets': result.originalData.pallets,
            'Weight (lbs)': result.originalData.grossWeight,
            'Pickup Date': result.originalData.fromDate,
            'Carrier Name': quote.carrier.name,
            'Carrier SCAC': quote.carrier.scac || '',
            'Service Level': quote.serviceLevel?.description || quote.serviceLevel?.code || '',
            'Transit Days': quote.transitDays || '',
            'Carrier Rate': quoteWithPricing.carrierTotalRate || 0,
            'Customer Price': quoteWithPricing.customerPrice || 0,
            'Profit Margin': quoteWithPricing.profit || 0,
            'Profit %': quoteWithPricing.carrierTotalRate > 0 ? 
              ((quoteWithPricing.profit / quoteWithPricing.carrierTotalRate) * 100).toFixed(1) + '%' : '0%',
            'Applied Margin %': quoteWithPricing.appliedMarginPercentage?.toFixed(1) + '%' || '',
            'Margin Type': quoteWithPricing.appliedMarginType || 'flat'
          });
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Margin Analysis');
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 20 }, // Customer
      { wch: 12 }, // Origin ZIP
      { wch: 12 }, // Destination ZIP
      { wch: 10 }, // Pallets
      { wch: 12 }, // Weight
      { wch: 12 }, // Pickup Date
      { wch: 25 }, // Carrier Name
      { wch: 12 }, // Carrier SCAC
      { wch: 20 }, // Service Level
      { wch: 12 }, // Transit Days
      { wch: 15 }, // Carrier Rate
      { wch: 15 }, // Customer Price
      { wch: 15 }, // Profit Margin
      { wch: 10 }, // Profit %
      { wch: 15 }, // Applied Margin %
      { wch: 15 }  // Margin Type
    ];
    
    ws['!cols'] = colWidths;
    
    const fileName = `margin-analysis-${selectedCustomer}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const saveToDatabase = async () => {
    if (Object.keys(customerResults).length === 0) return;
    
    try {
      setLoading(true);
      
      // Create a new analysis job
      const { data: jobData, error: jobError } = await supabase
        .from('MarginAnalysisJobs')
        .insert({
          customer_name: selectedCustomer,
          carrier_name: Object.entries(selectedCarriers)
            .filter(([_, selected]) => selected)
            .map(([id, _]) => {
              const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
              return carrier?.name || id;
            })[0] || 'Multiple Carriers',
          analysis_type: 'benchmark',
          status: 'completed',
          shipment_count: rfqData.length,
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          selected_carriers: Object.entries(selectedCarriers)
            .filter(([_, selected]) => selected)
            .map(([id, _]) => id),
          first_phase_completed: true,
          completed_at: new Date().toISOString(),
          phase_one_valid_shipments: JSON.stringify(
            results.map(r => ({
              shipment_id: r.rowIndex,
              rfq_data: r.originalData,
              original_shipment: shipments[r.rowIndex],
              quotes: r.quotes
            }))
          )
        })
        .select()
        .single();
      
      if (jobError) throw jobError;
      
      console.log('✅ Analysis job saved to database:', jobData.id);
      
      // For each customer, create a margin recommendation
      for (const [customer, summary] of Object.entries(customerSummary)) {
        if (summary.totalCarrierCost > 0) {
          const { data: recData, error: recError } = await supabase
            .from('MarginRecommendations')
            .insert({
              customer_name: customer,
              carrier_name: Object.entries(selectedCarriers)
                .filter(([_, selected]) => selected)
                .map(([id, _]) => {
                  const carrier = carrierGroups.flatMap(g => g.carriers).find(c => c.id === id);
                  return carrier?.name || id;
                })[0] || 'Multiple Carriers',
              current_margin: summary.avgMargin,
              recommended_margin: summary.avgMargin < 15 ? 23 : summary.avgMargin,
              confidence_score: 85,
              potential_revenue_impact: summary.totalCarrierCost * 0.05, // 5% potential improvement
              shipment_count: summary.totalShipments,
              avg_shipment_value: summary.totalShipments > 0 ? summary.totalRevenue / summary.totalShipments : 0,
              margin_variance: 5 // 5% variance in margin
            });
          
          if (recError) throw recError;
        }
      }
      
      alert('Analysis results saved to database successfully!');
    } catch (err) {
      console.error('❌ Failed to save analysis results:', err);
      setError(err instanceof Error ? err.message : 'Failed to save analysis results');
    } finally {
      setLoading(false);
    }
  };

  const renderSetupTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Margin Analysis - Phase 1</h2>
            <p className="text-sm text-gray-600">
              Analyze carrier margins by comparing historical shipments with current Project44 rates
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a customer</option>
              {customerList.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier Selection</label>
            {carrierGroups.length === 0 ? (
              <button
                onClick={loadCarriers}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Truck className="h-4 w-4" />
                  <span>Load Available Carriers</span>
                </div>
              </button>
            ) : (
              <div className="text-sm text-gray-600">
                {Object.values(selectedCarriers).filter(Boolean).length} carriers selected
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      {/* Carrier Selection */}
      {carrierGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Select Carriers for Analysis</h3>
            <p className="text-sm text-gray-600">Choose carriers to analyze margin performance</p>
          </div>
          <div className="p-6">
            <CarrierSelection
              carrierGroups={carrierGroups}
              selectedCarriers={selectedCarriers}
              onToggleCarrier={handleCarrierToggle}
              onSelectAll={handleSelectAll}
              onSelectAllInGroup={handleSelectAllInGroup}
              isLoading={isLoadingCarriers}
            />
          </div>
        </div>
      )}

      {/* Analysis Summary */}
      {selectedCustomer && Object.values(selectedCarriers).some(Boolean) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {selectedCustomer}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {Object.values(selectedCarriers).filter(Boolean).length} carriers selected
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {dateRange.start} to {dateRange.end}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={loadShipments}
                  disabled={!selectedCustomer || !Object.values(selectedCarriers).some(Boolean)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Search className="h-4 w-4" />
                  <span>Load Shipments</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderProcessingTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Processing Shipments</h2>
            <p className="text-sm text-gray-600">
              {rfqData.length} shipments loaded for {selectedCustomer}
            </p>
          </div>
        </div>
      </div>

      {/* Shipment Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                <p className="text-2xl font-bold text-gray-900">{rfqData.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Date Range</p>
                <p className="text-lg font-bold text-gray-900">{dateRange.start}</p>
                <p className="text-sm text-gray-600">to {dateRange.end}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Selected Carriers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(selectedCarriers).filter(Boolean).length}
                </p>
              </div>
              <Truck className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-center">
          <button
            onClick={processRFQs}
            disabled={isProcessing || rfqData.length === 0}
            className="flex items-center space-x-3 px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Processing {currentStep}/{totalSteps}...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Start Processing {rfqData.length} Shipments</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="h-5 w-5 text-blue-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Progress</span>
                <span>{currentStep} of {totalSteps} shipments</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
            
            {currentCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Processing customer: {currentCustomer}
                  </span>
                </div>
              </div>
            )}
            
            {currentCarrier && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {currentCarrier}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderResultsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Analysis Results</h2>
              <p className="text-sm text-gray-600">
                {results.length} shipments processed for {selectedCustomer}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={saveToDatabase}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="h-4 w-4" />
              <span>Save to Database</span>
            </button>
            
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customer Summary */}
      {Object.keys(customerSummary).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Summary</h3>
          
          <div className="space-y-4">
            {Object.entries(customerSummary).map(([customer, summary]) => (
              <div key={customer} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h4 className="text-lg font-semibold text-gray-900">{customer}</h4>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    summary.avgMargin < 15 ? 'bg-red-100 text-red-800' :
                    summary.avgMargin < 25 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {summary.avgMargin.toFixed(1)}% Margin
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Shipments</p>
                    <p className="text-lg font-bold text-gray-900">{summary.totalShipments}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Carrier Cost</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalCarrierCost)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Revenue</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Profit</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(summary.totalProfit)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipment Results */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Shipment Details</h3>
        
        {results.map((result, index) => (
          <RFQCard
            key={index}
            result={result}
            onPriceUpdate={(quoteId, newPrice) => handlePriceUpdate(index, quoteId, newPrice)}
          />
        ))}
        
        {results.length === 0 && !isProcessing && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
            <p className="text-gray-600">Process shipments to see results here.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'setup', label: 'Setup', icon: Calculator },
            { id: 'processing', label: 'Processing', icon: Clock, count: rfqData.length },
            { id: 'results', label: 'Results', icon: CheckCircle, count: results.length }
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
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    activeTab === tab.id 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'setup' && renderSetupTab()}
      {activeTab === 'processing' && renderProcessingTab()}
      {activeTab === 'results' && renderResultsTab()}
    </div>
  );
};