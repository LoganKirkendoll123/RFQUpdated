import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  MapPin, 
  Package, 
  Calendar, 
  DollarSign, 
  Users, 
  Calculator, 
  Truck,
  Building2,
  Thermometer,
  Plus,
  Minus,
  Search,
  Loader,
  CheckCircle,
  AlertCircle,
  Target,
  Settings,
  Award,
  Shield,
  TrendingUp
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient, CarrierGroup } from '../utils/apiClient';
import { PricingSettings, RFQRow, QuoteWithPricing } from '../types';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { supabase } from '../utils/supabase';
import { CarrierSelection } from './CarrierSelection';
import { QuotePricingCard } from './QuotePricingCard';

interface SpotQuoteProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

interface LineItem {
  id: number;
  description: string;
  totalWeight: number;
  freightClass: string;
  packageLength: number;
  packageWidth: number;
  packageHeight: number;
  packageType: string;
  totalPackages: number;
  stackable: boolean;
  nmfcItemCode: string;
  totalValue: number;
}

interface SpotQuoteForm {
  // Core shipment details
  fromDate: string;
  fromZip: string;
  toZip: string;
  pallets: number;
  grossWeight: number;
  isStackable: boolean;
  isReefer: boolean;
  
  // Enhanced details
  temperature: string;
  commodity: string;
  isFoodGrade: boolean;
  freightClass: string;
  commodityDescription: string;
  
  // Address details
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  
  // Line items
  lineItems: LineItem[];
  
  // Accessorial services
  accessorial: string[];
}

export const SpotQuote: React.FC<SpotQuoteProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  // Form state
  const [formData, setFormData] = useState<SpotQuoteForm>({
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    isStackable: false,
    isReefer: false,
    temperature: 'AMBIENT',
    commodity: '',
    isFoodGrade: false,
    freightClass: '70',
    commodityDescription: '',
    originCity: '',
    originState: '',
    destinationCity: '',
    destinationState: '',
    lineItems: [],
    accessorial: []
  });

  // Customer selection state
  const [customers, setCustomers] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedSpotCustomer, setSelectedSpotCustomer] = useState<string>(selectedCustomer || '');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerOffset, setCustomerOffset] = useState(0);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);

  // Carrier selection state
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [spotSelectedCarriers, setSpotSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);

  // Margin settings state
  const [marginSettings, setMarginSettings] = useState({
    useCustomerMargins: pricingSettings.usesCustomerMargins || false,
    manualMarginType: 'percentage' as 'percentage' | 'fixed',
    manualMarginValue: pricingSettings.markupPercentage || 15,
    minimumProfit: pricingSettings.minimumProfit || 100,
    fallbackMarginPercentage: pricingSettings.fallbackMarkupPercentage || 23
  });

  // Quote results state
  const [quotes, setQuotes] = useState<QuoteWithPricing[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Filter customers based on search
  useEffect(() => {
    if (customerSearchTerm) {
      const filtered = customers.filter(customer =>
        customer.toLowerCase().includes(customerSearchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [customerSearchTerm, customers]);

  // Load carriers when project44Client is available
  useEffect(() => {
    if (project44Client && !carriersLoaded) {
      loadCarriers();
    }
  }, [project44Client, carriersLoaded]);

  const loadCustomers = async (offset = 0) => {
    setLoadingCustomers(true);
    try {
      console.log(`🔍 Loading customers batch starting at offset ${offset}...`);
      
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null)
        .range(offset, offset + 999) // Load 1000 customers per batch
        .order('InternalName');
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        const newCustomers = [...new Set(data.map(d => d.InternalName).filter(Boolean))];
        
        if (offset === 0) {
          setCustomers(newCustomers);
          setFilteredCustomers(newCustomers);
        } else {
          setCustomers(prev => {
            const combined = [...prev, ...newCustomers];
            const unique = [...new Set(combined)].sort();
            return unique;
          });
        }
        
        setHasMoreCustomers(data.length === 1000);
        setCustomerOffset(offset + 1000);
        console.log(`✅ Loaded ${newCustomers.length} customers (batch ${Math.floor(offset/1000) + 1})`);
      } else {
        setHasMoreCustomers(false);
      }
    } catch (err) {
      console.error('❌ Failed to load customers:', err);
      setError('Failed to load customers from database');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadMoreCustomers = () => {
    if (!loadingCustomers && hasMoreCustomers) {
      loadCustomers(customerOffset);
    }
  };

  const loadCarriers = async () => {
    if (!project44Client) return;

    setIsLoadingCarriers(true);
    setCarriersLoaded(false);
    try {
      console.log('🚛 Loading carriers for spot quote...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      setCarriersLoaded(true);
      console.log(`✅ Loaded ${groups.length} carrier groups for spot quote`);
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
      setCarrierGroups([]);
      setCarriersLoaded(false);
      setError('Failed to load carriers');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSpotSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  const handleSelectAllCarriers = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
    });
    setSpotSelectedCarriers(newSelection);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    const newSelection = { ...spotSelectedCarriers };
    group.carriers.forEach(carrier => {
      newSelection[carrier.id] = selected;
    });
    setSpotSelectedCarriers(newSelection);
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now(),
      description: '',
      totalWeight: 0,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      stackable: false,
      nmfcItemCode: '',
      totalValue: 0
    };
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem]
    }));
  };

  const removeLineItem = (id: number) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.id !== id)
    }));
  };

  const updateLineItem = (id: number, updates: Partial<LineItem>) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  };

  const calculateTotalWeight = () => {
    return formData.lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.fromZip || !/^\d{5}$/.test(formData.fromZip)) {
      errors.push('Valid origin ZIP code is required');
    }
    if (!formData.toZip || !/^\d{5}$/.test(formData.toZip)) {
      errors.push('Valid destination ZIP code is required');
    }
    if (formData.pallets < 1 || formData.pallets > 100) {
      errors.push('Pallets must be between 1 and 100');
    }
    if (formData.grossWeight < 1 || formData.grossWeight > 100000) {
      errors.push('Gross weight must be between 1 and 100,000 lbs');
    }
    
    // Validate line items if present
    if (formData.lineItems.length > 0) {
      const itemTotalWeight = calculateTotalWeight();
      if (Math.abs(formData.grossWeight - itemTotalWeight) > 10) {
        errors.push(`Gross weight (${formData.grossWeight}) must equal sum of item weights (${itemTotalWeight})`);
      }
      
      formData.lineItems.forEach((item, index) => {
        if (!item.description) errors.push(`Item ${index + 1}: Description is required`);
        if (item.totalWeight <= 0) errors.push(`Item ${index + 1}: Weight must be greater than 0`);
        if (!item.freightClass) errors.push(`Item ${index + 1}: Freight class is required`);
        if (item.packageLength <= 0 || item.packageWidth <= 0 || item.packageHeight <= 0) {
          errors.push(`Item ${index + 1}: All dimensions must be greater than 0`);
        }
      });
    }
    
    return errors;
  };

  const getQuotes = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    const selectedCarrierIds = Object.entries(spotSelectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier');
      return;
    }

    setIsProcessing(true);
    setError('');
    setQuotes([]);

    try {
      // Convert form data to RFQRow format
      const rfqData: RFQRow = {
        fromDate: formData.fromDate,
        fromZip: formData.fromZip,
        toZip: formData.toZip,
        pallets: formData.pallets,
        grossWeight: formData.grossWeight,
        isStackable: formData.isStackable,
        isReefer: formData.isReefer,
        temperature: formData.temperature as any,
        commodity: formData.commodity as any,
        isFoodGrade: formData.isFoodGrade,
        freightClass: formData.freightClass,
        commodityDescription: formData.commodityDescription,
        originCity: formData.originCity,
        originState: formData.originState,
        destinationCity: formData.destinationCity,
        destinationState: formData.destinationState,
        accessorial: formData.accessorial,
        lineItems: formData.lineItems.map(item => ({
          id: item.id,
          description: item.description,
          totalWeight: item.totalWeight,
          freightClass: item.freightClass,
          packageLength: item.packageLength,
          packageWidth: item.packageWidth,
          packageHeight: item.packageHeight,
          packageType: item.packageType as any,
          totalPackages: item.totalPackages,
          stackable: item.stackable,
          nmfcItemCode: item.nmfcItemCode,
          totalValue: item.totalValue
        }))
      };

      let rawQuotes: any[] = [];

      // Determine routing based on isReefer
      if (formData.isReefer && freshxClient) {
        console.log('🌡️ Getting FreshX reefer quotes...');
        rawQuotes = await freshxClient.getQuotes(rfqData);
      } else if (project44Client) {
        // Determine if this should be Volume LTL
        const isVolumeMode = formData.pallets >= 10 || formData.grossWeight >= 15000;
        console.log(`🚛 Getting Project44 ${isVolumeMode ? 'Volume LTL' : 'Standard LTL'} quotes...`);
        rawQuotes = await project44Client.getQuotes(rfqData, selectedCarrierIds, isVolumeMode, false, false);
      }

      if (rawQuotes.length === 0) {
        setError('No quotes received from carriers');
        return;
      }

      // Apply pricing with current margin settings
      const currentPricingSettings = {
        markupPercentage: marginSettings.manualMarginValue,
        minimumProfit: marginSettings.minimumProfit,
        markupType: marginSettings.manualMarginType,
        usesCustomerMargins: marginSettings.useCustomerMargins,
        fallbackMarkupPercentage: marginSettings.fallbackMarginPercentage
      };

      const quotesWithPricing = await Promise.all(
        rawQuotes.map(quote => 
          calculatePricingWithCustomerMargins(
            quote, 
            currentPricingSettings, 
            selectedSpotCustomer
          )
        )
      );

      setQuotes(quotesWithPricing);
      console.log(`✅ Processed ${quotesWithPricing.length} quotes with pricing`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get quotes';
      setError(errorMessage);
      console.error('❌ Spot quote failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePriceUpdate = (quoteId: number, newPrice: number) => {
    setQuotes(prevQuotes => {
      return prevQuotes.map(quote => {
        if (quote.quoteId === quoteId) {
          return calculatePricingWithCustomerMargins(
            quote, 
            {
              markupPercentage: marginSettings.manualMarginValue,
              minimumProfit: marginSettings.minimumProfit,
              markupType: marginSettings.manualMarginType,
              usesCustomerMargins: marginSettings.useCustomerMargins,
              fallbackMarkupPercentage: marginSettings.fallbackMarginPercentage
            }, 
            selectedSpotCustomer, 
            newPrice
          );
        }
        return quote;
      });
    });
  };

  const getExamplePricing = () => {
    const carrierRate = 1000;
    let customerPrice: number;
    let profit: number;

    if (marginSettings.useCustomerMargins) {
      // Use fallback margin for example
      customerPrice = carrierRate / (1 - (marginSettings.fallbackMarginPercentage / 100));
      profit = Math.max(customerPrice - carrierRate, marginSettings.minimumProfit);
      if (profit === marginSettings.minimumProfit) {
        customerPrice = carrierRate + marginSettings.minimumProfit;
      }
    } else {
      if (marginSettings.manualMarginType === 'percentage') {
        customerPrice = carrierRate / (1 - (marginSettings.manualMarginValue / 100));
        profit = customerPrice - carrierRate;
      } else {
        profit = marginSettings.manualMarginValue;
        customerPrice = carrierRate + profit;
      }
      
      if (profit < marginSettings.minimumProfit) {
        profit = marginSettings.minimumProfit;
        customerPrice = carrierRate + marginSettings.minimumProfit;
      }
    }

    return { carrierRate, customerPrice, profit };
  };

  const example = getExamplePricing();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Spot Quote</h1>
            <p className="text-sm text-gray-600">
              Get instant freight quotes with manual shipment entry
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Basic Shipment Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Package className="h-5 w-5 text-blue-600" />
              <span>Shipment Details</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={formData.fromDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={formData.isReefer}
                    onChange={(e) => setFormData(prev => ({ ...prev, isReefer: e.target.checked }))}
                    className="mr-2"
                  />
                  Reefer Shipment
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Routes to {formData.isReefer ? 'FreshX reefer network' : 'Project44 LTL networks'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin ZIP</label>
                <input
                  type="text"
                  value={formData.fromZip}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromZip: e.target.value }))}
                  placeholder="60607"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination ZIP</label>
                <input
                  type="text"
                  value={formData.toZip}
                  onChange={(e) => setFormData(prev => ({ ...prev, toZip: e.target.value }))}
                  placeholder="30033"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pallets</label>
                <input
                  type="number"
                  value={formData.pallets}
                  onChange={(e) => setFormData(prev => ({ ...prev, pallets: parseInt(e.target.value) || 0 }))}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gross Weight (lbs)</label>
                <input
                  type="number"
                  value={formData.grossWeight}
                  onChange={(e) => setFormData(prev => ({ ...prev, grossWeight: parseInt(e.target.value) || 0 }))}
                  min="1"
                  max="100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
                <select
                  value={formData.freightClass}
                  onChange={(e) => setFormData(prev => ({ ...prev, freightClass: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="50">50</option>
                  <option value="55">55</option>
                  <option value="60">60</option>
                  <option value="65">65</option>
                  <option value="70">70</option>
                  <option value="77.5">77.5</option>
                  <option value="85">85</option>
                  <option value="92.5">92.5</option>
                  <option value="100">100</option>
                  <option value="110">110</option>
                  <option value="125">125</option>
                  <option value="150">150</option>
                  <option value="175">175</option>
                  <option value="200">200</option>
                  <option value="250">250</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={formData.isStackable}
                    onChange={(e) => setFormData(prev => ({ ...prev, isStackable: e.target.checked }))}
                    className="mr-2"
                  />
                  Stackable
                </label>
              </div>
            </div>

            {formData.isReefer && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  <select
                    value={formData.temperature}
                    onChange={(e) => setFormData(prev => ({ ...prev, temperature: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AMBIENT">Ambient</option>
                    <option value="CHILLED">Chilled</option>
                    <option value="FROZEN">Frozen</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
                  <select
                    value={formData.commodity}
                    onChange={(e) => setFormData(prev => ({ ...prev, commodity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select commodity</option>
                    <option value="FOODSTUFFS">Foodstuffs</option>
                    <option value="PRODUCE">Produce</option>
                    <option value="FROZEN_SEAFOOD">Frozen Seafood</option>
                    <option value="FRESH_SEAFOOD">Fresh Seafood</option>
                    <option value="ICE_CREAM">Ice Cream</option>
                    <option value="ALCOHOL">Alcohol</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Customer Selection */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-green-600" />
              <span>Customer Selection</span>
            </h3>
            
            <div className="relative">
              <button
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className={selectedSpotCustomer ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedSpotCustomer || 'Select a customer...'}
                  </span>
                  <div className="flex items-center space-x-2">
                    {selectedSpotCustomer && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </button>

              {isCustomerDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        placeholder="Search customers..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedSpotCustomer('');
                        setIsCustomerDropdownOpen(false);
                        setCustomerSearchTerm('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b border-gray-100"
                    >
                      <span className="text-gray-500 italic">No customer selected</span>
                    </button>
                    
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer}
                        onClick={() => {
                          setSelectedSpotCustomer(customer);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearchTerm('');
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors ${
                          selectedSpotCustomer === customer ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{customer}</span>
                          {selectedSpotCustomer === customer && (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                    
                    {hasMoreCustomers && (
                      <button
                        onClick={loadMoreCustomers}
                        disabled={loadingCustomers}
                        className="w-full px-4 py-3 text-center text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
                      >
                        {loadingCustomers ? (
                          <div className="flex items-center justify-center space-x-2">
                            <Loader className="h-4 w-4 animate-spin" />
                            <span>Loading more...</span>
                          </div>
                        ) : (
                          `Load more customers (${customers.length} loaded)`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedSpotCustomer && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Customer selected: {selectedSpotCustomer}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Margin Settings */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Calculator className="h-5 w-5 text-purple-600" />
              <span>Margin Settings</span>
            </h3>
            
            {/* Margin Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Margin Application Method
              </label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setMarginSettings(prev => ({ ...prev, useCustomerMargins: false }))}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    !marginSettings.useCustomerMargins
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Calculator className="h-5 w-5" />
                  <span>Manual Margin</span>
                </button>
                <button
                  onClick={() => setMarginSettings(prev => ({ ...prev, useCustomerMargins: true }))}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    marginSettings.useCustomerMargins
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Users className="h-5 w-5" />
                  <span>Customer Database Margins</span>
                </button>
              </div>
            </div>

            {!marginSettings.useCustomerMargins && (
              <>
                {/* Manual Margin Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Manual Margin Type
                  </label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setMarginSettings(prev => ({ ...prev, manualMarginType: 'percentage' }))}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        marginSettings.manualMarginType === 'percentage'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      <span>Percentage</span>
                    </button>
                    <button
                      onClick={() => setMarginSettings(prev => ({ ...prev, manualMarginType: 'fixed' }))}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        marginSettings.manualMarginType === 'fixed'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <DollarSign className="h-4 w-4" />
                      <span>Fixed Amount</span>
                    </button>
                  </div>
                </div>

                {/* Manual Margin Value */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {marginSettings.manualMarginType === 'percentage' ? 'Margin Percentage' : 'Fixed Margin Amount'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step={marginSettings.manualMarginType === 'percentage' ? '0.1' : '1'}
                      value={marginSettings.manualMarginValue}
                      onChange={(e) => setMarginSettings(prev => ({ 
                        ...prev, 
                        manualMarginValue: parseFloat(e.target.value) || 0 
                      }))}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder={marginSettings.manualMarginType === 'percentage' ? '15.0' : '500'}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      {marginSettings.manualMarginType === 'percentage' ? '%' : '$'}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {marginSettings.manualMarginType === 'percentage' 
                      ? 'Formula: price = cost ÷ (1 - margin%)'
                      : 'Formula: price = cost + fixed amount'
                    }
                  </p>
                </div>
              </>
            )}

            {marginSettings.useCustomerMargins && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fallback Margin for Unmatched Carriers
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={marginSettings.fallbackMarginPercentage}
                    onChange={(e) => setMarginSettings(prev => ({ 
                      ...prev, 
                      fallbackMarginPercentage: parseFloat(e.target.value) || 23 
                    }))}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="23.0"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    %
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Applied when no customer-carrier match is found
                </p>
              </div>
            )}

            {/* Minimum Profit */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Profit per Shipment
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={marginSettings.minimumProfit}
                  onChange={(e) => setMarginSettings(prev => ({ 
                    ...prev, 
                    minimumProfit: parseFloat(e.target.value) || 0 
                  }))}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="100"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Minimum profit margin that must be maintained on each shipment
              </p>
            </div>

            {/* Example Calculation */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Example Calculation</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Carrier Rate: ${example.carrierRate.toLocaleString()}</div>
                <div>Customer: {selectedSpotCustomer || 'No customer selected'}</div>
                {marginSettings.useCustomerMargins ? (
                  <>
                    <div>Customer Margin: {selectedSpotCustomer ? 'Lookup from database' : 'N/A'}</div>
                    <div>Fallback Margin ({marginSettings.fallbackMarginPercentage}%): ${(example.customerPrice - example.carrierRate).toFixed(0)}</div>
                  </>
                ) : (
                  <div>
                    {marginSettings.manualMarginType === 'percentage' 
                      ? `Margin (${marginSettings.manualMarginValue}%): $${(example.customerPrice - example.carrierRate).toFixed(0)}`
                      : `Fixed Margin: $${marginSettings.manualMarginValue}`
                    }
                  </div>
                )}
                <div className="border-t pt-1 font-medium">
                  Customer Price: ${example.customerPrice.toFixed(0)}
                </div>
                <div className="text-green-600">
                  Profit: ${example.profit.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          {/* Carrier Selection */}
          {carriersLoaded && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <span>Carrier Selection</span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Select carriers to include in your spot quote
                </p>
              </div>
              <div className="p-6">
                <CarrierSelection
                  carrierGroups={carrierGroups}
                  selectedCarriers={spotSelectedCarriers}
                  onToggleCarrier={handleCarrierToggle}
                  onSelectAll={handleSelectAllCarriers}
                  onSelectAllInGroup={handleSelectAllInGroup}
                  isLoading={isLoadingCarriers}
                />
              </div>
            </div>
          )}

          {/* Load Carriers Button */}
          {!carriersLoaded && !isLoadingCarriers && project44Client && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center">
                <div className="bg-blue-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Truck className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-blue-900">
                  Load Carrier Network
                </h3>
                <p className="mb-6 text-blue-700 max-w-md mx-auto">
                  Connect to Project44's carrier network to select carriers for your spot quote.
                </p>
                <button
                  onClick={loadCarriers}
                  className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Truck className="h-5 w-5" />
                  <span>Load Carriers</span>
                </button>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Package className="h-5 w-5 text-green-600" />
                <span>Line Items (Optional)</span>
              </h3>
              <button
                onClick={addLineItem}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>

            {formData.lineItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No line items added. Add items for detailed dimensional quoting.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.lineItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Item {index + 1}</h4>
                      <button
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          placeholder="Item description"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                        <input
                          type="number"
                          value={item.totalWeight}
                          onChange={(e) => updateLineItem(item.id, { totalWeight: parseFloat(e.target.value) || 0 })}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
                        <select
                          value={item.freightClass}
                          onChange={(e) => updateLineItem(item.id, { freightClass: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="50">50</option>
                          <option value="55">55</option>
                          <option value="60">60</option>
                          <option value="65">65</option>
                          <option value="70">70</option>
                          <option value="77.5">77.5</option>
                          <option value="85">85</option>
                          <option value="92.5">92.5</option>
                          <option value="100">100</option>
                          <option value="110">110</option>
                          <option value="125">125</option>
                          <option value="150">150</option>
                          <option value="175">175</option>
                          <option value="200">200</option>
                          <option value="250">250</option>
                          <option value="300">300</option>
                          <option value="400">400</option>
                          <option value="500">500</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Packages</label>
                        <input
                          type="number"
                          value={item.totalPackages}
                          onChange={(e) => updateLineItem(item.id, { totalPackages: parseInt(e.target.value) || 1 })}
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Length (in)</label>
                        <input
                          type="number"
                          value={item.packageLength}
                          onChange={(e) => updateLineItem(item.id, { packageLength: parseFloat(e.target.value) || 0 })}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width (in)</label>
                        <input
                          type="number"
                          value={item.packageWidth}
                          onChange={(e) => updateLineItem(item.id, { packageWidth: parseFloat(e.target.value) || 0 })}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                        <input
                          type="number"
                          value={item.packageHeight}
                          onChange={(e) => updateLineItem(item.id, { packageHeight: parseFloat(e.target.value) || 0 })}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {formData.lineItems.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium">Line Items Summary:</div>
                      <div>Total Weight: {calculateTotalWeight()} lbs</div>
                      <div>Gross Weight: {formData.grossWeight} lbs</div>
                      {Math.abs(formData.grossWeight - calculateTotalWeight()) > 10 && (
                        <div className="text-red-600 font-medium">
                          ⚠️ Weight mismatch: Gross weight should equal sum of item weights
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Get Quotes Button */}
          <div className="text-center">
            <button
              onClick={getQuotes}
              disabled={isProcessing || !carriersLoaded || Object.values(spotSelectedCarriers).every(v => !v)}
              className={`inline-flex items-center space-x-3 px-8 py-4 font-bold rounded-xl transition-all duration-200 text-lg shadow-lg ${
                isProcessing || !carriersLoaded || Object.values(spotSelectedCarriers).every(v => !v)
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:shadow-xl transform hover:scale-105'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader className="h-6 w-6 animate-spin" />
                  <span>Getting Quotes...</span>
                </>
              ) : (
                <>
                  <Zap className="h-6 w-6" />
                  <span>Get Spot Quote</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Shipment Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span>Shipment Summary</span>
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Route:</span>
                <span className="font-medium">{formData.fromZip || '?'} → {formData.toZip || '?'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pallets:</span>
                <span className="font-medium">{formData.pallets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium">{formData.grossWeight.toLocaleString()} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Freight Class:</span>
                <span className="font-medium">{formData.freightClass}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Routing:</span>
                <span className={`font-medium ${formData.isReefer ? 'text-green-600' : 'text-blue-600'}`}>
                  {formData.isReefer ? 'FreshX Reefer' : 
                   (formData.pallets >= 10 || formData.grossWeight >= 15000) ? 'Project44 Volume LTL' : 'Project44 Standard LTL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{selectedSpotCustomer || 'None selected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Carriers Selected:</span>
                <span className="font-medium">{Object.values(spotSelectedCarriers).filter(Boolean).length}</span>
              </div>
            </div>
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

          {/* Quote Results */}
          {quotes.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <span>Quote Results</span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {quotes.length} quote{quotes.length !== 1 ? 's' : ''} received
                </p>
              </div>
              <div className="p-6 space-y-4">
                {quotes.map((quote) => (
                  <QuotePricingCard
                    key={quote.quoteId}
                    quote={quote}
                    onPriceUpdate={handlePriceUpdate}
                    isExpanded={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {!isProcessing && quotes.length === 0 && !error && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Spot Quote</h3>
              <p className="text-gray-600">
                Fill out the shipment details and click "Get Spot Quote" to see instant pricing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};