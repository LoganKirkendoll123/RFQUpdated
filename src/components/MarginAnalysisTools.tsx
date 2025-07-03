import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Truck,
  Play,
  Download,
  Loader,
  AlertCircle,
  CheckCircle,
  Info,
  DollarSign,
  Target,
  BarChart3,
  RefreshCw,
  Calendar,
  Filter,
  Search,
  X
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQRow } from '../types';
import { supabase } from '../utils/supabase';

interface MarginAnalysisResult {
  customerName: string;
  targetCarrierRate: number;
  competitorRates: Array<{
    carrierId: string;
    carrierName: string;
    rate: number;
    margin: number;
    customerPrice: number;
  }>;
  competitorRatesWithoutOutliers: Array<{
    carrierId: string;
    carrierName: string;
    rate: number;
    margin: number;
    customerPrice: number;
  }>;
  averageCompetitorCostWithoutOutliers: number;
  targetPrice: number;
  recommendedMargin: number;
  targetCarrierMargin: number; // Add this to track what margin was used
  shipmentCount: number;
}

// Updated interface matching your exact database schema
interface ShipmentData {
  "Invoice #": number;
  "Customer"?: string;
  "Zip"?: string;
  "Zip_1"?: string;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Scheduled Pickup Date"?: string;
  "Service Level"?: string;
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Revenue"?: string;
  "Carrier Expense"?: string;
}

interface CustomerCarrierMargin {
  "InternalName": string;
  "P44CarrierCode": string;
  "Percentage": string;
}

export const MarginAnalysisTools: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedTargetGroup, setSelectedTargetGroup] = useState('');
  const [selectedTargetCarrier, setSelectedTargetCarrier] = useState('');
  const [selectedCompetitorGroup, setSelectedCompetitorGroup] = useState('');
  const [results, setResults] = useState<MarginAnalysisResult[]>([]);
  const [error, setError] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [isCarriersLoading, setIsCarriersLoading] = useState(false);
  
  // Date range and customer filtering
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);

  // Customer carrier margins
  const [customerCarrierMargins, setCustomerCarrierMargins] = useState<CustomerCarrierMargin[]>([]);

  useEffect(() => {
    initializeClient();
    loadCustomers();
    loadCustomerCarrierMargins();
    
    // Set default date range to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    setEndDate(endDate.toISOString().split('T')[0]);
    setStartDate(startDate.toISOString().split('T')[0]);
  }, []);

  // Filter customers based on search term - FIXED to handle all customers
  useEffect(() => {
    if (customerSearchTerm.trim() === '') {
      // Show first 100 customers when no search term
      setFilteredCustomers(availableCustomers.slice(0, 100));
    } else {
      // Show ALL matching customers, no limit
      const filtered = availableCustomers.filter(customer =>
        customer.toLowerCase().includes(customerSearchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
  }, [customerSearchTerm, availableCustomers]);

  const initializeClient = async () => {
    const config = loadProject44Config();
    if (config) {
      const client = new Project44APIClient(config);
      setProject44Client(client);
      await loadCarrierGroups(client);
    } else {
      setError('Project44 configuration not found. Please configure your API credentials first.');
    }
  };

  const loadCarrierGroups = async (client: Project44APIClient) => {
    try {
      setIsCarriersLoading(true);
      setProcessingStatus('Loading carrier groups...');
      
      // Load all carrier groups (both standard and volume)
      const groups = await client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      console.log(`✅ Loaded ${groups.length} carrier groups for margin analysis`);
      setProcessingStatus(`Loaded ${groups.length} carrier groups`);
    } catch (error) {
      console.error('❌ Failed to load carrier groups:', error);
      setError(`Failed to load carrier groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCarriersLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      console.log('📋 Loading ALL customers from database...');
      
      // Load ALL customers without limit
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null)
        .order('"Customer"');
      
      if (error) {
        console.error('Error loading customers:', error);
        return;
      }
      
      const uniqueCustomers = [...new Set(data?.map(s => s.Customer).filter(Boolean))];
      setAvailableCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} customers from database`);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadCustomerCarrierMargins = async () => {
    try {
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('"InternalName", "P44CarrierCode", "Percentage"')
        .not('"InternalName"', 'is', null)
        .not('"P44CarrierCode"', 'is', null)
        .not('"Percentage"', 'is', null);
      
      if (error) {
        console.error('Error loading customer carrier margins:', error);
        return;
      }
      
      setCustomerCarrierMargins(data || []);
      console.log(`✅ Loaded ${data?.length || 0} customer carrier margin configurations`);
    } catch (err) {
      console.error('Failed to load customer carrier margins:', err);
    }
  };

  const loadShipmentData = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      setIsLoadingShipments(true);
      setProcessingStatus('Loading shipment data from database...');
      
      let query = supabase
        .from('Shipments')
        .select(`
          "Invoice #",
          "Customer",
          "Zip",
          "Zip_1", 
          "Tot Packages",
          "Tot Weight",
          "Scheduled Pickup Date",
          "Service Level",
          "Booked Carrier",
          "Quoted Carrier",
          "Revenue",
          "Carrier Expense"
        `)
        .gte('"Scheduled Pickup Date"', startDate)
        .lte('"Scheduled Pickup Date"', endDate)
        .not('"Customer"', 'is', null)
        .not('"Zip"', 'is', null)
        .not('"Zip_1"', 'is', null)
        .not('"Tot Packages"', 'is', null)
        .not('"Tot Weight"', 'is', null);

      if (selectedCustomer) {
        query = query.eq('"Customer"', selectedCustomer);
      }

      const { data, error } = await query.order('"Scheduled Pickup Date"', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setShipmentData(data || []);
      setProcessingStatus(`Loaded ${data?.length || 0} shipments from database`);
      console.log(`✅ Loaded ${data?.length || 0} shipments for analysis`);
      
    } catch (err) {
      console.error('Failed to load shipment data:', err);
      setError(`Failed to load shipment data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoadingShipments(false);
    }
  };

  const getCarriersInGroup = (groupCode: string): Array<{id: string, name: string}> => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    return group ? group.carriers : [];
  };

  const convertShipmentToRFQ = (shipment: ShipmentData): RFQRow => {
    // Parse weight - handle string format like "2,500 lbs"
    const weightStr = shipment["Tot Weight"]?.toString() || '0';
    const weightMatch = weightStr.match(/[\d,]+/);
    const weight = weightMatch ? parseInt(weightMatch[0].replace(/,/g, '')) : 0;
    
    // Use pallets from Tot Packages, default to 1 if not available
    const pallets = shipment["Tot Packages"] || 1;
    
    return {
      fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
      fromZip: shipment["Zip"] || '',
      toZip: shipment["Zip_1"] || '',
      pallets: pallets,
      grossWeight: weight,
      isStackable: false,
      accessorial: [],
      isReefer: false,
      freightClass: '70', // Default freight class
      // Include service level from historical data
      requestedServiceLevels: shipment["Service Level"] ? [shipment["Service Level"]] : undefined
    };
  };

  // Function to remove outliers using IQR method
  const removeOutliers = (rates: number[]): number[] => {
    if (rates.length < 4) return rates; // Need at least 4 data points for meaningful outlier detection
    
    const sorted = [...rates].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return rates.filter(rate => rate >= lowerBound && rate <= upperBound);
  };

  // FIXED: Function to get customer margin for a specific carrier from database
  const getCustomerMarginForCarrier = (customerName: string, carrierCode: string): number => {
    console.log(`🔍 Looking up margin for customer: "${customerName}", carrier: "${carrierCode}"`);
    
    // First try exact match with carrier code
    let margin = customerCarrierMargins.find(
      m => m["InternalName"] === customerName && m["P44CarrierCode"] === carrierCode
    );
    
    if (margin) {
      const percentage = parseFloat(margin["Percentage"] || '15');
      console.log(`✅ Found exact match: ${customerName} + ${carrierCode} = ${percentage}%`);
      return percentage;
    }
    
    // Try to find by carrier name if no exact code match
    const targetCarrier = getCarriersInGroup(selectedTargetGroup).find(c => c.id === carrierCode);
    if (targetCarrier) {
      margin = customerCarrierMargins.find(
        m => m["InternalName"] === customerName && 
        (m["P44CarrierCode"] === targetCarrier.name || 
         m["P44CarrierCode"]?.toLowerCase().includes(targetCarrier.name.toLowerCase()) ||
         targetCarrier.name.toLowerCase().includes(m["P44CarrierCode"]?.toLowerCase() || ''))
      );
      
      if (margin) {
        const percentage = parseFloat(margin["Percentage"] || '15');
        console.log(`✅ Found name match: ${customerName} + ${targetCarrier.name} = ${percentage}%`);
        return percentage;
      }
    }
    
    console.log(`⚠️ No margin found for ${customerName} + ${carrierCode}, using default 15%`);
    return 15; // Default to 15% if not found
  };

  const runMarginAnalysis = async () => {
    if (!project44Client || !selectedTargetGroup || !selectedTargetCarrier || !selectedCompetitorGroup) {
      setError('Please select target carrier group, target carrier, and competitor group');
      return;
    }

    if (shipmentData.length === 0) {
      setError('No shipment data loaded. Please load shipments first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);
    
    try {
      setProcessingStatus('Starting margin analysis...');
      
      // Get all carriers in the competitor group
      const competitorGroup = carrierGroups.find(g => g.groupCode === selectedCompetitorGroup);
      if (!competitorGroup) {
        throw new Error(`Competitor group not found: ${selectedCompetitorGroup}`);
      }
      
      console.log(`🎯 Analyzing against competitor group: ${competitorGroup.groupName}`);
      
      const customerResults: {[key: string]: MarginAnalysisResult} = {};

      // Process each shipment from the database
      for (let i = 0; i < shipmentData.length; i++) {
        const shipment = shipmentData[i];
        const customerName = shipment["Customer"];
        
        if (!customerName) continue;
        
        setProcessingStatus(`Processing shipment ${i + 1} of ${shipmentData.length} for ${customerName}...`);
        
        console.log(`📦 Processing shipment: ${shipment["Zip"]} → ${shipment["Zip_1"]} for ${customerName}`);

        // Convert shipment to RFQ format
        const rfqData = convertShipmentToRFQ(shipment);
        
        // Skip if essential data is missing
        if (!rfqData.fromZip || !rfqData.toZip || rfqData.grossWeight === 0) {
          console.warn(`⚠️ Skipping shipment ${i + 1} - missing essential data`);
          continue;
        }

        try {
          // Get target carrier rate
          setProcessingStatus(`Getting target carrier rate for shipment ${i + 1}...`);
          const targetRates = await project44Client.getQuotes(rfqData, [selectedTargetCarrier], false, false, false);
          
          if (targetRates.length === 0) {
            console.warn(`⚠️ No rate from target carrier ${selectedTargetCarrier} for shipment ${i + 1}`);
            continue;
          }

          const targetRate = targetRates[0].baseRate + targetRates[0].fuelSurcharge + targetRates[0].premiumsAndDiscounts;
          console.log(`🎯 Target carrier rate: ${formatCurrency(targetRate)}`);

          // Get competitor rates using the new method for entire account group
          setProcessingStatus(`Getting competitor rates for shipment ${i + 1}...`);
          
          // Use the new method to get quotes for the entire account group
          const competitorQuotes = await project44Client.getQuotesForAccountGroup(
            rfqData, 
            selectedCompetitorGroup, 
            false, 
            false, 
            false
          );
          
          console.log(`📊 Got ${competitorQuotes.length} competitor quotes from group ${selectedCompetitorGroup}`);
          
          if (competitorQuotes.length === 0) {
            console.warn(`⚠️ No competitor quotes for shipment ${i + 1}`);
            continue;
          }
          
          // Process competitor quotes with proper customer margins
          const competitorRates = competitorQuotes.map(quote => {
            const rate = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
            const carrierCode = quote.carrierCode || quote.carrier.name;
            
            // Get the specific customer margin for this carrier
            const margin = getCustomerMarginForCarrier(customerName, carrierCode);
            
            // FIXED: Use correct formula cost / (1 - margin)
            const customerPrice = rate / (1 - margin / 100);
            
            return {
              carrierId: carrierCode,
              carrierName: quote.carrier.name,
              rate: rate,
              margin: margin,
              customerPrice: customerPrice
            };
          });
          
          // Remove outliers from competitor costs
          const competitorCosts = competitorRates.map(cr => cr.rate);
          const costsWithoutOutliers = removeOutliers(competitorCosts);
          
          // Filter competitor rates to only include those without outliers
          const competitorRatesWithoutOutliers = competitorRates.filter(cr => 
            costsWithoutOutliers.includes(cr.rate)
          );
          
          console.log(`📊 Removed ${competitorRates.length - competitorRatesWithoutOutliers.length} outliers from competitor rates`);
          
          if (competitorRatesWithoutOutliers.length === 0) {
            console.warn(`⚠️ No competitor rates remaining after outlier removal for shipment ${i + 1}`);
            continue;
          }
          
          // Calculate average competitor cost without outliers
          const averageCompetitorCostWithoutOutliers = costsWithoutOutliers.reduce((sum, cost) => sum + cost, 0) / costsWithoutOutliers.length;
          
          // FIXED: Get the target carrier margin from database lookup
          const targetCarrierMargin = getCustomerMarginForCarrier(customerName, selectedTargetCarrier);
          
          // FIXED: Mark up the average competitor cost using proper formula cost / (1 - margin)
          const targetPrice = averageCompetitorCostWithoutOutliers / (1 - targetCarrierMargin / 100);
          
          // Calculate recommended margin: (Target Price - Target Carrier Cost) / Target Price
          const recommendedMargin = targetPrice > targetRate ? 
            ((targetPrice - targetRate) / targetPrice) * 100 : 0;
          
          console.log(`💰 Analysis for ${customerName}:`, {
            targetRate: formatCurrency(targetRate),
            avgCompetitorCost: formatCurrency(averageCompetitorCostWithoutOutliers),
            targetCarrierMargin: `${targetCarrierMargin}%`,
            targetPrice: formatCurrency(targetPrice),
            recommendedMargin: `${recommendedMargin.toFixed(1)}%`,
            formula: `${formatCurrency(averageCompetitorCostWithoutOutliers)} / (1 - ${targetCarrierMargin}%) = ${formatCurrency(targetPrice)}`
          });
          
          // Add to or update customer results
          if (!customerResults[customerName]) {
            customerResults[customerName] = {
              customerName,
              targetCarrierRate: targetRate,
              competitorRates: competitorRates,
              competitorRatesWithoutOutliers: competitorRatesWithoutOutliers,
              averageCompetitorCostWithoutOutliers: averageCompetitorCostWithoutOutliers,
              targetPrice: targetPrice,
              recommendedMargin: recommendedMargin,
              targetCarrierMargin: targetCarrierMargin, // Store the actual margin used
              shipmentCount: 1
            };
          } else {
            // Update existing customer with average values
            const existing = customerResults[customerName];
            const newCount = existing.shipmentCount + 1;
            
            existing.targetCarrierRate = (existing.targetCarrierRate * existing.shipmentCount + targetRate) / newCount;
            existing.averageCompetitorCostWithoutOutliers = (existing.averageCompetitorCostWithoutOutliers * existing.shipmentCount + averageCompetitorCostWithoutOutliers) / newCount;
            existing.targetPrice = (existing.targetPrice * existing.shipmentCount + targetPrice) / newCount;
            existing.recommendedMargin = (existing.recommendedMargin * existing.shipmentCount + recommendedMargin) / newCount;
            existing.targetCarrierMargin = targetCarrierMargin; // Keep the margin (should be consistent per customer/carrier)
            existing.shipmentCount = newCount;
            
            // Merge competitor rates
            const allCompetitorRates = [...existing.competitorRates];
            competitorRates.forEach(newRate => {
              const existingRateIndex = allCompetitorRates.findIndex(r => r.carrierId === newRate.carrierId);
              if (existingRateIndex >= 0) {
                const existingRate = allCompetitorRates[existingRateIndex];
                allCompetitorRates[existingRateIndex] = {
                  ...existingRate,
                  rate: (existingRate.rate + newRate.rate) / 2,
                  customerPrice: (existingRate.customerPrice + newRate.customerPrice) / 2
                };
              } else {
                allCompetitorRates.push(newRate);
              }
            });
            existing.competitorRates = allCompetitorRates;
            existing.competitorRatesWithoutOutliers = competitorRatesWithoutOutliers;
          }
          
        } catch (error) {
          console.warn(`⚠️ Failed to get rates for shipment ${i + 1}:`, error);
          // Continue with other shipments
        }
      }

      // Convert customer results to array
      const finalResults = Object.values(customerResults);
      setResults(finalResults);
      
      if (finalResults.length === 0) {
        setProcessingStatus('Analysis complete, but no valid results were found.');
      } else {
        setProcessingStatus(`Analysis complete! Processed ${finalResults.length} customers with competitor data.`);
      }
      
      console.log(`✅ Margin analysis complete: ${finalResults.length} results`);
      
    } catch (error) {
      console.error('❌ Margin analysis failed:', error);
      setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingStatus('Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    // Create CSV content
    const headers = [
      'Customer Name',
      'Target Carrier Rate',
      'Target Carrier Margin %',
      'Avg Competitor Cost (No Outliers)',
      'Target Price',
      'Recommended Margin %',
      'Competitor Count',
      'Competitors After Outlier Removal',
      'Shipment Count'
    ];
    
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.customerName,
        result.targetCarrierRate.toFixed(2),
        result.targetCarrierMargin.toFixed(2),
        result.averageCompetitorCostWithoutOutliers.toFixed(2),
        result.targetPrice.toFixed(2),
        result.recommendedMargin.toFixed(2),
        result.competitorRates.length,
        result.competitorRatesWithoutOutliers.length,
        result.shipmentCount
      ].join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `margin-analysis-${selectedCustomer || 'all-customers'}-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCustomerSelect = (customer: string) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(customer);
    setShowCustomerDropdown(false);
  };

  const clearCustomerSelection = () => {
    setSelectedCustomer('');
    setCustomerSearchTerm('');
    setShowCustomerDropdown(false);
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
            <h1 className="text-xl font-semibold text-gray-900">Database-Driven Carrier Margin Discovery</h1>
            <p className="text-sm text-gray-600">
              Analyze competitor pricing using historical shipment data with database margin lookup and correct formula: cost/(1-margin)
            </p>
          </div>
        </div>
      </div>

      {/* Date Range and Customer Filter */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Shipment Data Filters</h2>
          <button
            onClick={loadShipmentData}
            disabled={isLoadingShipments || !startDate || !endDate}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingShipments ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Filter className="h-4 w-4" />
            )}
            <span>Load Shipments</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Searchable Customer Filter */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Customer (Optional) - {availableCustomers.length} total
            </label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={customerSearchTerm}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder={`Search ${availableCustomers.length} customers...`}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                />
                {selectedCustomer && (
                  <button
                    onClick={clearCustomerSelection}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Dropdown */}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredCustomers.map((customer, index) => (
                    <button
                      key={index}
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-sm"
                    >
                      {customer}
                    </button>
                  ))}
                  {customerSearchTerm && filteredCustomers.length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">
                      No customers found matching "{customerSearchTerm}"
                    </div>
                  )}
                  {customerSearchTerm === '' && availableCustomers.length > 100 && (
                    <div className="px-3 py-2 text-gray-500 text-xs border-t">
                      Showing first 100 customers. Type to search all {availableCustomers.length} customers.
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="mt-1 text-sm text-green-600">
                Selected: {selectedCustomer}
              </div>
            )}
          </div>
        </div>

        {/* Shipment Data Status */}
        {shipmentData.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                Loaded {shipmentData.length} shipments from {startDate} to {endDate}
                {selectedCustomer && ` for ${selectedCustomer}`}
              </span>
            </div>
          </div>
        )}

        {/* Customer Carrier Margins Status */}
        {customerCarrierMargins.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                Using {customerCarrierMargins.length} customer-carrier margin configurations from database
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Analysis Configuration</h2>
          
          <button
            onClick={() => loadCarrierGroups(project44Client!)}
            disabled={isCarriersLoading || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCarriersLoading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Refresh Carrier Groups</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Carrier Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Carrier Group
            </label>
            <select
              value={selectedTargetGroup}
              onChange={(e) => {
                setSelectedTargetGroup(e.target.value);
                setSelectedTargetCarrier(''); // Reset carrier selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              disabled={isCarriersLoading}
            >
              <option value="">Select target group...</option>
              {carrierGroups.map(group => (
                <option key={group.groupCode} value={group.groupCode}>
                  {group.groupName} ({group.carriers.length} carriers)
                </option>
              ))}
            </select>
          </div>

          {/* Target Carrier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Carrier
            </label>
            <select
              value={selectedTargetCarrier}
              onChange={(e) => setSelectedTargetCarrier(e.target.value)}
              disabled={!selectedTargetGroup || isCarriersLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="">Select target carrier...</option>
              {getCarriersInGroup(selectedTargetGroup).map(carrier => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Competitor Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Competitor Group
            </label>
            <select
              value={selectedCompetitorGroup}
              onChange={(e) => setSelectedCompetitorGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              disabled={isCarriersLoading}
            >
              <option value="">Select competitor group...</option>
              {carrierGroups
                .filter(group => group.groupCode !== selectedTargetGroup)
                .map(group => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Analysis Info */}
        {selectedTargetGroup && selectedCompetitorGroup && shipmentData.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Database-Driven Margin Calculation Method:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Get rates from target carrier: <strong>{getCarriersInGroup(selectedTargetGroup).find(c => c.id === selectedTargetCarrier)?.name || 'Not selected'}</strong></li>
                  <li>Get rates from <strong>ALL carriers</strong> in competitor group: {carrierGroups.find(g => g.groupCode === selectedCompetitorGroup)?.groupName}</li>
                  <li><strong>Remove outliers</strong> from competitor costs using IQR method</li>
                  <li><strong>Look up customer-carrier margins</strong> from CustomerCarriers database table</li>
                  <li>Mark up remaining competitor costs using <strong>database margins and CORRECT formula: cost / (1 - margin)</strong></li>
                  <li>Calculate average of marked-up competitor prices as <strong>target price</strong></li>
                  <li>Calculate recommended margin: <strong>(Target Price - Target Carrier Cost) / Target Price</strong></li>
                  <li>Process <strong>{shipmentData.length} historical shipments</strong> with actual service levels</li>
                  <li>Date range: <strong>{startDate} to {endDate}</strong></li>
                  {selectedCustomer && <li>Customer filter: <strong>{selectedCustomer}</strong></li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Run Analysis Button */}
        <div className="mt-6">
          <button
            onClick={runMarginAnalysis}
            disabled={isLoading || !selectedTargetGroup || !selectedTargetCarrier || !selectedCompetitorGroup || shipmentData.length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            <span>{isLoading ? 'Analyzing...' : 'Run Database-Driven Margin Analysis'}</span>
          </button>
          
          {shipmentData.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Please load shipment data first using the "Load Shipments" button above.
            </p>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {(isLoading || processingStatus) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3">
            {isLoading && <Loader className="h-5 w-5 animate-spin text-blue-500" />}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
              <p className="text-sm text-gray-600">{processingStatus}</p>
            </div>
          </div>
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

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Database-Driven Margin Analysis Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                {results.length} customer{results.length !== 1 ? 's' : ''} analyzed with database margin lookup and correct formula: cost/(1-margin)
              </p>
            </div>
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Margin %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Competitor Cost (No Outliers)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competitors</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {result.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.targetCarrierRate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.targetCarrierMargin > 15 ? 'bg-green-100 text-green-800' :
                        result.targetCarrierMargin > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.targetCarrierMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.averageCompetitorCostWithoutOutliers)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.targetPrice)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.recommendedMargin > 15 ? 'bg-green-100 text-green-800' :
                        result.recommendedMargin > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.recommendedMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {result.competitorRatesWithoutOutliers.length} after outlier removal
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          ({result.competitorRates.length} total)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {result.shipmentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Target Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(results.reduce((sum, r) => sum + r.targetCarrierRate, 0) / results.length)}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Database Margin</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(results.reduce((sum, r) => sum + r.targetCarrierMargin, 0) / results.length).toFixed(1)}%
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Recommended Margin</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(results.reduce((sum, r) => sum + r.recommendedMargin, 0) / results.length).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                <p className="text-2xl font-bold text-gray-900">
                  {results.reduce((sum, r) => sum + r.shipmentCount, 0)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showCustomerDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowCustomerDropdown(false)}
        />
      )}
    </div>
  );
};