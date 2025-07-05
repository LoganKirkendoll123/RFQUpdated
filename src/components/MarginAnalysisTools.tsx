import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Truck, 
  Users, 
  Building2, 
  RefreshCw, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp,
  Target,
  ArrowRight,
  BarChart3,
  Zap,
  Calendar,
  Package,
  Clock,
  Info,
  MapPin
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { loadProject44Config } from '../utils/credentialStorage';
import { supabase } from '../utils/supabase';
import { RFQRow } from '../types';

interface MarginAnalysisToolsProps {}

interface HistoricalShipment {
  id: number;
  date: string;
  origin: string;
  destination: string;
  weight: number;
  pallets: number;
  oldPrice: number;
  oldCost: number;
}

export const MarginAnalysisTools: React.FC<MarginAnalysisToolsProps> = () => {
  const [activeTab, setActiveTab] = useState<'carrier-vs-group' | 'negotiated-rates'>('carrier-vs-group');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Carrier data
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  
  // Customer data
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  
  // Date range
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Analysis results
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [negotiatedRatesResults, setNegotiatedRatesResults] = useState<any>(null);
  
  // Historical shipments
  const [historicalShipments, setHistoricalShipments] = useState<HistoricalShipment[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  
  // Project44 client
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);

  // Initialize Project44 client
  useEffect(() => {
    const savedConfig = loadProject44Config();
    if (savedConfig) {
      const client = new Project44APIClient(savedConfig);
      setProject44Client(client);
    }
  }, []);

  // Load customers from database
  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    setError('');
    
    try {
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null)
        .order('"Customer"');
      
      if (error) throw error;
      
      // Get unique customer names
      const uniqueCustomers = [...new Set(data?.map(d => d.Customer) || [])];
      setCustomers(uniqueCustomers.filter(Boolean));
      
      if (uniqueCustomers.length > 0) {
        setSelectedCustomer(uniqueCustomers[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  // Load historical shipments for a customer and carrier
  const loadHistoricalShipments = async (customer: string, carrier: string) => {
    setIsLoadingShipments(true);
    setError('');
    
    try {
      // Query Shipments table for matching customer and carrier
      const { data, error } = await supabase
        .from('Shipments')
        .select('*')
        .eq('"Customer"', customer)
        .or(`"Booked Carrier".eq.${carrier},"Quoted Carrier".eq.${carrier}`)
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end)
        .order('"Scheduled Pickup Date"', { ascending: false });
      
      if (error) throw error;
      
      // Transform to HistoricalShipment format
      const shipments: HistoricalShipment[] = data?.map((shipment, index) => {
        // Parse numeric values from string fields
        const parseNumeric = (value: string | null | undefined): number => {
          if (!value) return 0;
          const cleaned = value.toString().replace(/[^\d.-]/g, '');
          return parseFloat(cleaned) || 0;
        };
        
        return {
          id: index + 1,
          date: shipment["Scheduled Pickup Date"] || '',
          origin: shipment["Zip"] || '',
          destination: shipment["Zip_1"] || '',
          weight: parseNumeric(shipment["Tot Weight"]),
          pallets: shipment["Tot Packages"] || 0,
          oldPrice: parseNumeric(shipment["Revenue"]),
          oldCost: parseNumeric(shipment["Carrier Expense"])
        };
      }) || [];
      
      setHistoricalShipments(shipments);
      return shipments;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load historical shipments');
      return [];
    } finally {
      setIsLoadingShipments(false);
    }
  };

  // Load carrier groups from Project44 API
  const loadCarrierGroups = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    setIsLoadingCarriers(true);
    setError('');
    
    try {
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      if (groups.length > 0) {
        setSelectedGroup(groups[0].groupCode);
        
        // Set first carrier as selected by default
        if (groups[0].carriers.length > 0) {
          setSelectedCarrier(groups[0].carriers[0].id);
        }
      }
      
      // Also load customers
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carrier groups');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  // Run carrier margin analysis with real API calls
  const runMarginAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    if (!selectedGroup || !selectedCarrier || !selectedCustomer) {
      setError('Please select a carrier group, specific carrier, and customer to analyze');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Get the selected group
      const group = carrierGroups.find(g => g.groupCode === selectedGroup);
      if (!group) {
        throw new Error('Selected carrier group not found');
      }
      
      // Get the selected carrier
      const carrier = group.carriers.find(c => c.id === selectedCarrier);
      if (!carrier) {
        throw new Error('Selected carrier not found');
      }
      
      // Load historical shipments for this customer and carrier
      const shipments = await loadHistoricalShipments(selectedCustomer, carrier.name);
      
      if (shipments.length === 0) {
        throw new Error(`No historical shipments found for customer "${selectedCustomer}" and carrier "${carrier.name}"`);
      }
      
      // For each historical shipment, get current rates from Project44 API
      const processedShipments = [];
      
      for (const shipment of shipments) {
        // Create RFQ from historical shipment
        const rfq: RFQRow = {
          fromDate: new Date().toISOString().split('T')[0], // Use current date for quotes
          fromZip: shipment.origin,
          toZip: shipment.destination,
          pallets: shipment.pallets,
          grossWeight: shipment.weight,
          isStackable: false,
          isReefer: false,
          accessorial: []
        };
        
        try {
          // Get quotes from Project44 API for this shipment
          const quotes = await project44Client.getQuotes(rfq, [selectedCarrier], false, false, false);
          
          // Find the best (lowest) quote
          const bestQuote = quotes.length > 0 ? 
            quotes.reduce((best, current) => {
              const bestTotal = best.rateQuoteDetail?.total || 
                (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
              
              const currentTotal = current.rateQuoteDetail?.total || 
                (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
              
              return currentTotal < bestTotal ? current : best;
            }) : null;
          
          // Calculate the new cost from the quote
          const newCost = bestQuote ? 
            (bestQuote.rateQuoteDetail?.total || 
              (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts)) : 
            null;
          
          // Add to processed shipments with calculations
          if (newCost) {
            const savings = shipment.oldCost - newCost;
            const savingsPercentage = (savings / shipment.oldCost) * 100;
            const margin = ((shipment.oldPrice - newCost) / shipment.oldPrice) * 100;
            
            processedShipments.push({
              ...shipment,
              newCost,
              savings,
              savingsPercentage,
              margin,
              quoteDetails: bestQuote
            });
          } else {
            // No quote available, use old cost
            processedShipments.push({
              ...shipment,
              newCost: shipment.oldCost,
              savings: 0,
              savingsPercentage: 0,
              margin: ((shipment.oldPrice - shipment.oldCost) / shipment.oldPrice) * 100,
              quoteDetails: null
            });
          }
        } catch (quoteError) {
          console.error(`Failed to get quote for shipment ${shipment.id}:`, quoteError);
          
          // Add to processed shipments with error
          processedShipments.push({
            ...shipment,
            newCost: shipment.oldCost,
            savings: 0,
            savingsPercentage: 0,
            margin: ((shipment.oldPrice - shipment.oldCost) / shipment.oldPrice) * 100,
            quoteDetails: null,
            error: quoteError instanceof Error ? quoteError.message : 'Failed to get quote'
          });
        }
      }
      
      // Calculate summary statistics
      const summary = {
        totalOldPrice: processedShipments.reduce((sum, s) => sum + s.oldPrice, 0),
        totalOldCost: processedShipments.reduce((sum, s) => sum + s.oldCost, 0),
        totalNewCost: processedShipments.reduce((sum, s) => sum + s.newCost, 0),
        totalSavings: processedShipments.reduce((sum, s) => sum + s.savings, 0),
        avgSavingsPercentage: 0,
        overallMargin: 0
      };
      
      summary.avgSavingsPercentage = (summary.totalSavings / summary.totalOldCost) * 100;
      
      // Calculate overall margin - this is what the customer is asking for
      // (old price - new cost) / old price = margin
      summary.overallMargin = ((summary.totalOldPrice - summary.totalNewCost) / summary.totalOldPrice) * 100;
      
      setAnalysisResults({
        carrier: {
          id: carrier.id,
          name: carrier.name,
          scac: carrier.scac || 'N/A'
        },
        group: {
          code: group.groupCode,
          name: group.groupName,
          carrierCount: group.carriers.length
        },
        customer: selectedCustomer,
        dateRange,
        shipments: processedShipments,
        summary
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Run negotiated rates analysis with real API calls
  const runNegotiatedRatesAnalysis = async () => {
    if (!project44Client) {
      setError('Project44 client not available. Please configure your API credentials first.');
      return;
    }

    if (!selectedGroup || !selectedCarrier) {
      setError('Please select both a carrier group and a specific carrier to analyze');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Get the selected group
      const group = carrierGroups.find(g => g.groupCode === selectedGroup);
      if (!group) {
        throw new Error('Selected carrier group not found');
      }
      
      // Get the selected carrier
      const carrier = group.carriers.find(c => c.id === selectedCarrier);
      if (!carrier) {
        throw new Error('Selected carrier not found');
      }
      
      // Load all customers with shipments for this carrier
      const { data: customerData, error: customerError } = await supabase
        .from('Shipments')
        .select('DISTINCT "Customer"')
        .or(`"Booked Carrier".eq.${carrier.name},"Quoted Carrier".eq.${carrier.name}`)
        .not('"Customer"', 'is', null)
        .order('"Customer"');
      
      if (customerError) throw customerError;
      
      const customerNames = customerData?.map(d => d.Customer).filter(Boolean) || [];
      
      if (customerNames.length === 0) {
        throw new Error(`No customers found with shipments for carrier "${carrier.name}"`);
      }
      
      // Process each customer
      const customerResults = [];
      
      for (const customerName of customerNames) {
        // Load historical shipments for this customer and carrier
        const shipments = await loadHistoricalShipments(customerName, carrier.name);
        
        if (shipments.length === 0) continue;
        
        // For each historical shipment, get current rates from Project44 API
        const processedShipments = [];
        
        for (const shipment of shipments) {
          // Create RFQ from historical shipment
          const rfq: RFQRow = {
            fromDate: new Date().toISOString().split('T')[0], // Use current date for quotes
            fromZip: shipment.origin,
            toZip: shipment.destination,
            pallets: shipment.pallets,
            grossWeight: shipment.weight,
            isStackable: false,
            isReefer: false,
            accessorial: []
          };
          
          try {
            // Get quotes from Project44 API for this shipment
            const quotes = await project44Client.getQuotes(rfq, [selectedCarrier], false, false, false);
            
            // Find the best (lowest) quote
            const bestQuote = quotes.length > 0 ? 
              quotes.reduce((best, current) => {
                const bestTotal = best.rateQuoteDetail?.total || 
                  (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
                
                const currentTotal = current.rateQuoteDetail?.total || 
                  (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
                
                return currentTotal < bestTotal ? current : best;
              }) : null;
            
            // Calculate the new cost from the quote
            const newCost = bestQuote ? 
              (bestQuote.rateQuoteDetail?.total || 
                (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts)) : 
              null;
            
            // Add to processed shipments with calculations
            if (newCost) {
              const savings = shipment.oldCost - newCost;
              const savingsPercentage = (savings / shipment.oldCost) * 100;
              const margin = ((shipment.oldPrice - newCost) / shipment.oldPrice) * 100;
              
              processedShipments.push({
                ...shipment,
                newCost,
                savings,
                savingsPercentage,
                margin,
                quoteDetails: bestQuote
              });
            } else {
              // No quote available, use old cost
              processedShipments.push({
                ...shipment,
                newCost: shipment.oldCost,
                savings: 0,
                savingsPercentage: 0,
                margin: ((shipment.oldPrice - shipment.oldCost) / shipment.oldPrice) * 100,
                quoteDetails: null
              });
            }
          } catch (quoteError) {
            console.error(`Failed to get quote for shipment ${shipment.id}:`, quoteError);
            
            // Add to processed shipments with error
            processedShipments.push({
              ...shipment,
              newCost: shipment.oldCost,
              savings: 0,
              savingsPercentage: 0,
              margin: ((shipment.oldPrice - shipment.oldCost) / shipment.oldPrice) * 100,
              quoteDetails: null,
              error: quoteError instanceof Error ? quoteError.message : 'Failed to get quote'
            });
          }
        }
        
        // Calculate customer summary
        const customerSummary = {
          shipmentCount: processedShipments.length,
          totalOldPrice: processedShipments.reduce((sum, s) => sum + s.oldPrice, 0),
          totalOldCost: processedShipments.reduce((sum, s) => sum + s.oldCost, 0),
          totalNewCost: processedShipments.reduce((sum, s) => sum + s.newCost, 0),
          optimalMargin: 0
        };
        
        // Calculate optimal margin for this customer
        customerSummary.optimalMargin = ((customerSummary.totalOldPrice - customerSummary.totalNewCost) / customerSummary.totalOldPrice) * 100;
        
        customerResults.push({
          customer: { name: customerName },
          shipments: processedShipments,
          summary: customerSummary
        });
      }
      
      // Calculate overall summary
      const overallSummary = {
        totalShipments: customerResults.reduce((sum, c) => sum + c.summary.shipmentCount, 0),
        totalOldPrice: customerResults.reduce((sum, c) => sum + c.summary.totalOldPrice, 0),
        totalNewCost: customerResults.reduce((sum, c) => sum + c.summary.totalNewCost, 0),
        weightedAvgMargin: 0
      };
      
      overallSummary.weightedAvgMargin = ((overallSummary.totalOldPrice - overallSummary.totalNewCost) / overallSummary.totalOldPrice) * 100;
      
      setNegotiatedRatesResults({
        carrier: {
          id: carrier.id,
          name: carrier.name,
          scac: carrier.scac || 'N/A'
        },
        group: {
          code: group.groupCode,
          name: group.groupName
        },
        dateRange,
        customerShipments: customerResults,
        summary: overallSummary
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run negotiated rates analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCarrierVsGroupAnalysis = () => (
    <div className="space-y-6">
      {/* Carrier Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
              <p className="text-sm text-gray-600">
                Select a carrier to analyze historical shipments and calculate optimal margin
              </p>
            </div>
          </div>
          
          <button
            onClick={loadCarrierGroups}
            disabled={isLoadingCarriers || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingCarriers ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Load Carrier Groups</span>
          </button>
        </div>
        
        {!project44Client && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Project44 API not configured</p>
                <p className="mt-1">
                  Please configure your Project44 API credentials in the Setup tab before using this tool.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {carrierGroups.length > 0 ? (
          <div className="space-y-4">
            {/* Group Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Carrier Group
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  // Reset selected carrier when group changes
                  setSelectedCarrier('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {carrierGroups.map(group => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Carrier Dropdown */}
            {selectedGroup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Carrier to Analyze
                </label>
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a carrier --</option>
                  {carrierGroups
                    .find(g => g.groupCode === selectedGroup)
                    ?.carriers.map(carrier => (
                      <option key={carrier.id} value={carrier.id}>
                        {carrier.name} {carrier.scac ? `(${carrier.scac})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
            
            {/* Customer Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                disabled={isLoadingCustomers}
              >
                <option value="">-- Select a customer --</option>
                {customers.map(customer => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Run Analysis Button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={runMarginAnalysis}
                disabled={isLoading || !selectedGroup || !selectedCarrier || !selectedCustomer}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5" />
                )}
                <span>Run Margin Analysis</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No carrier groups loaded</p>
            <p className="text-sm mt-2">Click "Load Carrier Groups" to get started</p>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {analysisResults && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Margin Analysis Summary</h3>
                <p className="text-sm text-gray-600">
                  {analysisResults.carrier.name} - {analysisResults.customer} - {analysisResults.shipments.length} historical shipments analyzed
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Total Historical Revenue</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(analysisResults.summary.totalOldPrice)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Customer price across all shipments
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Total Current Cost</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(analysisResults.summary.totalNewCost)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Current market rates for same shipments
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Optimal Margin</div>
                <div className="text-2xl font-bold text-purple-800">
                  {analysisResults.summary.overallMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  (Old Price - New Cost) / Old Price
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-600 rounded-full p-2">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="text-green-800">
                  <p className="font-medium">Recommended Action</p>
                  <p className="mt-1">
                    Keep your current customer prices and switch to current market rates to achieve a 
                    <span className="font-bold text-green-700"> {analysisResults.summary.overallMargin.toFixed(1)}% </span> 
                    margin across all shipments.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Shipment Results Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Shipment-by-Shipment Analysis</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysisResults.shipments.map((shipment: any) => (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.origin} → {shipment.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shipment.weight.toLocaleString()} lbs, {shipment.pallets} pallets
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.oldPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.oldCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(shipment.newCost)}
                        {shipment.error && (
                          <div className="text-xs text-red-600 mt-1">
                            Error: Using old cost
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {shipment.margin.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Visualization */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Margin Visualization</h3>
                <p className="text-sm text-gray-600">
                  Visual representation of price vs cost and margin
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Price vs Cost Comparison</h4>
                <div className="h-64 flex items-end space-x-4 pt-6">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Historical</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-blue-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalOldPrice / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalOldPrice)}
                      </div>
                      <div className="text-xs text-gray-500">Price</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Historical</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-gray-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalOldCost / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalOldCost)}
                      </div>
                      <div className="text-xs text-gray-500">Cost</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Current</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-blue-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalOldPrice / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalOldPrice)}
                      </div>
                      <div className="text-xs text-gray-500">Price (Same)</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700 mb-2">Current</div>
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className="w-24 bg-green-500 rounded-t-lg" 
                        style={{ height: `${(analysisResults.summary.totalNewCost / (analysisResults.summary.totalOldPrice * 1.2)) * 200}px` }}
                      ></div>
                      <div className="mt-2 text-sm font-medium text-gray-900">
                        {formatCurrency(analysisResults.summary.totalNewCost)}
                      </div>
                      <div className="text-xs text-gray-500">Cost</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Margin Breakdown</h4>
                <div className="h-64 flex flex-col justify-center items-center">
                  <div className="w-full max-w-xs">
                    <div className="mb-6 text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {analysisResults.summary.overallMargin.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Optimal Margin</div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Historical Margin</span>
                          <span className="font-medium text-gray-900">
                            {((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gray-500 h-2 rounded-full" 
                            style={{ width: `${((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Optimal Margin</span>
                          <span className="font-medium text-green-600">
                            {analysisResults.summary.overallMargin.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${analysisResults.summary.overallMargin}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Margin Increase</span>
                          <span className="font-medium text-blue-600">
                            +{(analysisResults.summary.overallMargin - ((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${(analysisResults.summary.overallMargin - ((analysisResults.summary.totalOldPrice - analysisResults.summary.totalOldCost) / analysisResults.summary.totalOldPrice * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderNegotiatedRatesAnalysis = () => {
    return (
      <div className="space-y-6">
        {/* Carrier Selection */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Carrier vs Group Analysis</h3>
                <p className="text-sm text-gray-600">
                  Compare a carrier's rates against its group to determine optimal margin
                </p>
              </div>
            </div>
            
            <button
              onClick={loadCarrierGroups}
              disabled={isLoadingCarriers || !project44Client}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoadingCarriers ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Load Carrier Groups</span>
            </button>
          </div>
          
          {!project44Client && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Project44 API not configured</p>
                  <p className="mt-1">
                    Please configure your Project44 API credentials in the Setup tab before using this tool.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {carrierGroups.length > 0 ? (
            <div className="space-y-4">
              {/* Group Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Carrier Group
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    // Reset selected carrier when group changes
                    setSelectedCarrier('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {carrierGroups.map(group => (
                    <option key={group.groupCode} value={group.groupCode}>
                      {group.groupName} ({group.carriers.length} carriers)
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Carrier Dropdown */}
              {selectedGroup && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Carrier to Analyze
                  </label>
                  <select
                    value={selectedCarrier}
                    onChange={(e) => setSelectedCarrier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a carrier --</option>
                    {carrierGroups
                      .find(g => g.groupCode === selectedGroup)
                      ?.carriers.map(carrier => (
                        <option key={carrier.id} value={carrier.id}>
                          {carrier.name} {carrier.scac ? `(${carrier.scac})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Run Analysis Button */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={runNegotiatedRatesAnalysis}
                  disabled={isLoading || !selectedGroup || !selectedCarrier}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    <Calculator className="h-5 w-5" />
                  )}
                  <span>Run Carrier vs Group Analysis</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No carrier groups loaded</p>
              <p className="text-sm mt-2">Click "Load Carrier Groups" to get started</p>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {negotiatedRatesResults && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-green-600 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Carrier vs Group Analysis</h3>
                  <p className="text-sm text-gray-600">
                    {negotiatedRatesResults.carrier.name} vs {negotiatedRatesResults.group.name}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm text-blue-700 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-blue-800">
                    {formatCurrency(negotiatedRatesResults.summary.totalOldPrice)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Across {negotiatedRatesResults.summary.totalShipments} shipments
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm text-green-700 mb-1">Total New Cost</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatCurrency(negotiatedRatesResults.summary.totalNewCost)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Current market rates for same shipments
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="text-sm text-purple-700 mb-1">Weighted Avg Margin</div>
                  <div className="text-2xl font-bold text-purple-800">
                    {negotiatedRatesResults.summary.weightedAvgMargin.toFixed(1)}%
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    Optimal margin to maintain revenue
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-600 rounded-full p-2">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-green-800">
                    <p className="font-medium">Recommended Action</p>
                    <p className="mt-1">
                      Set a <span className="font-bold text-green-700">{negotiatedRatesResults.summary.weightedAvgMargin.toFixed(1)}% margin</span> for {negotiatedRatesResults.carrier.name} to maintain current revenue levels with new market rates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Customer Breakdown */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Customer-Level Analysis</h3>
                <p className="text-sm text-gray-600">
                  Margin analysis broken down by customer
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shipments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total New Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Optimal Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {negotiatedRatesResults.customerShipments.map((customerData: any) => (
                      <tr key={customerData.customer.name} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customerData.customer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {customerData.summary.shipmentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customerData.summary.totalOldPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customerData.summary.totalNewCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-600">
                            {customerData.summary.optimalMargin.toFixed(1)}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Shipment Details (Expandable) */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Shipment Details</h3>
                  <button
                    onClick={() => {
                      // Toggle expansion logic would go here
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="text-sm text-gray-600 mb-4">
                  This analysis reprocesses historical shipments through the Project44 API to get current market rates.
                </div>
                
                <div className="space-y-4">
                  {negotiatedRatesResults.customerShipments.slice(0, 1).map((customerData: any) => (
                    <div key={customerData.customer.name} className="space-y-3">
                      <div className="font-medium text-gray-900">{customerData.customer.name}</div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Route</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Old Price</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">New Cost</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Margin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {customerData.shipments.slice(0, 3).map((shipment: any) => (
                              <tr key={shipment.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap">{shipment.date}</td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="h-3 w-3 text-gray-400" />
                                    <span>{shipment.origin} → {shipment.destination}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(shipment.oldPrice)}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(shipment.newCost)}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-green-600 font-medium">
                                  {shipment.margin.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {customerData.shipments.length > 3 && (
                        <div className="text-center text-sm text-gray-500">
                          + {customerData.shipments.length - 3} more shipments
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {negotiatedRatesResults.customerShipments.length > 1 && (
                  <div className="mt-4 text-center text-sm text-gray-500">
                    + {negotiatedRatesResults.customerShipments.length - 1} more customers
                  </div>
                )}
                
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">How This Works</p>
                      <p className="mt-1">
                        This tool reprocesses historical shipments through the Project44 API to get current market rates. 
                        It then calculates the exact margin needed to maintain your current revenue levels.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Carrier Margin Analysis</h1>
            <p className="text-sm text-gray-600">
              Analyze historical shipments and calculate optimal margins
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('carrier-vs-group')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'carrier-vs-group'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>Carrier vs Group</span>
            </button>
            <button
              onClick={() => setActiveTab('negotiated-rates')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'negotiated-rates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Negotiated Rates Analysis</span>
            </button>
          </nav>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'carrier-vs-group' ? renderCarrierVsGroupAnalysis() : renderNegotiatedRatesAnalysis()}
        </div>
      </div>
    </div>
  );
};