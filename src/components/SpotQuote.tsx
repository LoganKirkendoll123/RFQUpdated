import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  MapPin, 
  Package, 
  Calendar, 
  Clock, 
  Thermometer, 
  ChevronDown, 
  ChevronUp,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Loader,
  Users,
  Building2,
  DollarSign,
  Calculator,
  Percent,
  Search,
  RefreshCw
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow, PricingSettings, QuoteWithPricing } from '../types';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { supabase } from '../utils/supabase';

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

interface CustomerMarginSettings {
  useCustomerMargins: boolean;
  selectedCustomer: string;
  marginType: 'percentage' | 'fixed';
  marginValue: number;
  minimumProfit: number;
}

export const SpotQuote: React.FC<SpotQuoteProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer: globalSelectedCustomer
}) => {
  // Core form state
  const [formData, setFormData] = useState<Partial<RFQRow>>({
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    isStackable: false,
    isReefer: false,
    temperature: 'AMBIENT',
    freightClass: '70',
    packageType: 'PLT',
    lengthUnit: 'IN',
    weightUnit: 'LB',
    preferredCurrency: 'USD',
    paymentTerms: 'PREPAID'
  });

  // Customer and margin state
  const [customers, setCustomers] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerPage, setCustomerPage] = useState(0);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [marginSettings, setMarginSettings] = useState<CustomerMarginSettings>({
    useCustomerMargins: false,
    selectedCustomer: globalSelectedCustomer || '',
    marginType: 'percentage',
    marginValue: 15,
    minimumProfit: 100
  });

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: 1,
      description: 'Standard Freight',
      totalWeight: 1000,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      stackable: false,
      nmfcItemCode: '',
      totalValue: 0
    }
  ]);

  // Accessorial state
  const [accessorials, setAccessorials] = useState<{ [key: string]: boolean }>({
    LGPU: false,
    LGDEL: false,
    INPU: false,
    INDEL: false,
    RESPU: false,
    RESDEL: false,
    APPTPU: false,
    APPTDEL: false,
    LTDPU: false,
    LTDDEL: false,
    SATPU: false,
    SATDEL: false,
    NOTIFY: false,
    NBPU: false,
    NBDEL: false
  });

  // UI state
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    basic: true,
    items: false,
    accessorials: false,
    contacts: false,
    hazmat: false,
    advanced: false,
    margins: true
  });

  // Quote state
  const [isQuoting, setIsQuoting] = useState(false);
  const [quotes, setQuotes] = useState<QuoteWithPricing[]>([]);
  const [error, setError] = useState<string>('');
  const [routingDecision, setRoutingDecision] = useState<string>('');

  // Load customers on component mount
  useEffect(() => {
    loadCustomers(true);
  }, []);

  // Filter customers based on search term
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

  // Update margin settings when global customer changes
  useEffect(() => {
    if (globalSelectedCustomer && globalSelectedCustomer !== marginSettings.selectedCustomer) {
      setMarginSettings(prev => ({
        ...prev,
        selectedCustomer: globalSelectedCustomer
      }));
    }
  }, [globalSelectedCustomer]);

  const loadCustomers = async (reset: boolean = false) => {
    if (loadingCustomers) return;
    
    setLoadingCustomers(true);
    try {
      const page = reset ? 0 : customerPage;
      const from = page * 1000;
      const to = from + 999;

      console.log(`🔍 Loading customers batch ${page + 1} (${from}-${to})`);

      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null)
        .range(from, to)
        .order('InternalName');

      if (error) {
        throw error;
      }

      const newCustomers = [...new Set(data?.map(d => d.InternalName).filter(Boolean))] as string[];
      
      if (reset) {
        setCustomers(newCustomers);
        setCustomerPage(0);
      } else {
        setCustomers(prev => [...prev, ...newCustomers]);
      }

      setHasMoreCustomers(data?.length === 1000);
      setCustomerPage(page + 1);

      console.log(`✅ Loaded ${newCustomers.length} customers (total: ${reset ? newCustomers.length : customers.length + newCustomers.length})`);
    } catch (err) {
      console.error('❌ Failed to load customers:', err);
      setError('Failed to load customers from database');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadMoreCustomers = () => {
    if (hasMoreCustomers && !loadingCustomers) {
      loadCustomers(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateMarginSettings = (field: keyof CustomerMarginSettings, value: any) => {
    setMarginSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id)) + 1;
    setLineItems(prev => [...prev, {
      id: newId,
      description: `Item ${newId}`,
      totalWeight: 500,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      stackable: false,
      nmfcItemCode: '',
      totalValue: 0
    }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const toggleAccessorial = (code: string) => {
    setAccessorials(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const calculateTotalWeight = () => {
    return lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
  };

  const calculateLinearFeet = () => {
    return lineItems.reduce((sum, item) => {
      const itemLinearFeet = (item.packageLength / 12) * item.totalPackages;
      return sum + itemLinearFeet;
    }, 0);
  };

  const determineRoutingDecision = () => {
    const totalWeight = calculateTotalWeight();
    const pallets = formData.pallets || 1;
    
    if (formData.isReefer) {
      return 'FreshX Reefer Network';
    } else if (pallets >= 10 || totalWeight >= 15000) {
      return 'Project44 Dual Mode (Volume LTL + Standard LTL)';
    } else {
      return 'Project44 Standard LTL';
    }
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.fromZip || !/^\d{5}$/.test(formData.fromZip)) {
      errors.push('Valid origin ZIP code is required');
    }
    if (!formData.toZip || !/^\d{5}$/.test(formData.toZip)) {
      errors.push('Valid destination ZIP code is required');
    }
    if (!formData.fromDate) {
      errors.push('Pickup date is required');
    }
    if (!formData.pallets || formData.pallets < 1) {
      errors.push('At least 1 pallet is required');
    }
    
    const totalWeight = calculateTotalWeight();
    if (totalWeight !== formData.grossWeight) {
      errors.push(`Total weight (${formData.grossWeight}) must equal sum of line item weights (${totalWeight})`);
    }
    
    lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        errors.push(`Line item ${index + 1} description is required`);
      }
      if (item.totalWeight <= 0) {
        errors.push(`Line item ${index + 1} weight must be greater than 0`);
      }
      if (!item.freightClass) {
        errors.push(`Line item ${index + 1} freight class is required`);
      }
    });
    
    return errors;
  };

  const calculateCustomerPrice = (carrierRate: number): { customerPrice: number; profit: number } => {
    let customerPrice: number;
    let profit: number;

    if (marginSettings.marginType === 'percentage') {
      // Percentage margin: price = cost / (1 - margin%)
      customerPrice = carrierRate / (1 - (marginSettings.marginValue / 100));
      profit = customerPrice - carrierRate;
    } else {
      // Fixed margin: price = cost + fixed amount
      customerPrice = carrierRate + marginSettings.marginValue;
      profit = marginSettings.marginValue;
    }

    // Enforce minimum profit
    if (profit < marginSettings.minimumProfit) {
      profit = marginSettings.minimumProfit;
      customerPrice = carrierRate + marginSettings.minimumProfit;
    }

    return { customerPrice, profit };
  };

  const getSpotQuote = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setIsQuoting(true);
    setError('');
    setQuotes([]);

    try {
      // Build RFQ data
      const totalWeight = calculateTotalWeight();
      const selectedAccessorials = Object.entries(accessorials)
        .filter(([_, selected]) => selected)
        .map(([code, _]) => code);

      const rfqData: RFQRow = {
        ...formData,
        grossWeight: totalWeight,
        accessorial: selectedAccessorials,
        totalLinearFeet: Math.ceil(calculateLinearFeet()),
        lineItems: lineItems.map(item => ({
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
      } as RFQRow;

      const decision = determineRoutingDecision();
      setRoutingDecision(decision);

      console.log('🎯 Spot Quote Request:', {
        decision,
        weight: totalWeight,
        pallets: rfqData.pallets,
        isReefer: rfqData.isReefer,
        lineItems: rfqData.lineItems?.length
      });

      let allQuotes: any[] = [];

      // Get selected carrier IDs
      const selectedCarrierIds = Object.entries(selectedCarriers)
        .filter(([_, selected]) => selected)
        .map(([carrierId, _]) => carrierId);

      if (rfqData.isReefer && freshxClient) {
        // FreshX reefer quotes
        console.log('🌡️ Getting FreshX reefer quotes...');
        allQuotes = await freshxClient.getQuotes(rfqData);
      } else if (project44Client) {
        if (decision.includes('Dual Mode')) {
          // Get both Volume LTL and Standard LTL
          console.log('📦 Getting dual mode quotes...');
          const [volumeQuotes, standardQuotes] = await Promise.all([
            project44Client.getQuotes(rfqData, selectedCarrierIds, true, false, false),
            project44Client.getQuotes(rfqData, selectedCarrierIds, false, false, false)
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
          
          allQuotes = [...taggedVolumeQuotes, ...taggedStandardQuotes];
        } else {
          // Standard LTL only
          console.log('🚛 Getting standard LTL quotes...');
          allQuotes = await project44Client.getQuotes(rfqData, selectedCarrierIds, false, false, false);
        }
      }

      if (allQuotes.length === 0) {
        setError('No quotes received. Please check your carrier selection and try again.');
        return;
      }

      // Apply pricing with custom margin settings
      const quotesWithPricing = await Promise.all(
        allQuotes.map(async (quote) => {
          if (marginSettings.useCustomerMargins && marginSettings.selectedCustomer) {
            // Use customer-specific margins from database
            return await calculatePricingWithCustomerMargins(
              quote, 
              {
                ...pricingSettings,
                usesCustomerMargins: true,
                fallbackMarkupPercentage: marginSettings.marginValue
              },
              marginSettings.selectedCustomer
            );
          } else {
            // Use manual margin settings
            const carrierRate = quote.rateQuoteDetail?.total || 
                              (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts);
            
            const { customerPrice, profit } = calculateCustomerPrice(carrierRate);
            
            return {
              ...quote,
              carrierTotalRate: carrierRate,
              customerPrice,
              profit,
              markupApplied: profit,
              isCustomPrice: false,
              appliedMarginType: 'manual' as any,
              appliedMarginPercentage: marginSettings.marginType === 'percentage' ? 
                marginSettings.marginValue : 
                (profit / carrierRate) * 100,
              chargeBreakdown: {
                baseCharges: [],
                fuelCharges: [],
                accessorialCharges: [],
                discountCharges: [],
                premiumCharges: [],
                otherCharges: quote.rateQuoteDetail?.charges || []
              }
            } as QuoteWithPricing;
          }
        })
      );

      // Sort by customer price
      quotesWithPricing.sort((a, b) => a.customerPrice - b.customerPrice);
      
      setQuotes(quotesWithPricing);
      console.log(`✅ Received ${quotesWithPricing.length} quotes with pricing applied`);

    } catch (err) {
      console.error('❌ Spot quote failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to get quotes');
    } finally {
      setIsQuoting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderSection = (title: string, icon: React.ReactNode, sectionKey: string, children: React.ReactNode) => (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="text-blue-600">{icon}</div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {expandedSections[sectionKey] ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {expandedSections[sectionKey] && (
        <div className="px-6 py-4 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-3 rounded-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Spot Quote</h1>
            <p className="text-sm text-gray-600">Get instant freight quotes with comprehensive options</p>
          </div>
        </div>
      </div>

      {/* Customer Selection & Margin Settings */}
      {renderSection(
        'Customer & Margin Settings',
        <Building2 className="h-5 w-5" />,
        'margins',
        <div className="space-y-6">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Selection
            </label>
            <div className="relative">
              <button
                onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className={marginSettings.selectedCustomer ? 'text-gray-900' : 'text-gray-500'}>
                    {marginSettings.selectedCustomer || 'Select a customer...'}
                  </span>
                  <div className="flex items-center space-x-2">
                    {marginSettings.selectedCustomer && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </button>

              {showCustomerDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                  {/* Search Input */}
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

                  {/* Customer List */}
                  <div className="max-h-48 overflow-y-auto">
                    {loadingCustomers && customers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <Loader className="h-4 w-4 animate-spin mx-auto mb-2" />
                        Loading customers...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {customerSearchTerm ? 'No customers found' : 'No customers available'}
                      </div>
                    ) : (
                      <>
                        {/* Clear Selection Option */}
                        <button
                          onClick={() => {
                            updateMarginSettings('selectedCustomer', '');
                            setShowCustomerDropdown(false);
                            setCustomerSearchTerm('');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b border-gray-100"
                        >
                          <span className="text-gray-500 italic">No customer selected</span>
                        </button>
                        
                        {/* Customer Options */}
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer}
                            onClick={() => {
                              updateMarginSettings('selectedCustomer', customer);
                              setShowCustomerDropdown(false);
                              setCustomerSearchTerm('');
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors ${
                              marginSettings.selectedCustomer === customer ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{customer}</span>
                              {marginSettings.selectedCustomer === customer && (
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                          </button>
                        ))}

                        {/* Load More Button */}
                        {hasMoreCustomers && (
                          <button
                            onClick={loadMoreCustomers}
                            disabled={loadingCustomers}
                            className="w-full px-4 py-2 text-center text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
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
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Margin Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Margin Application Method
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => updateMarginSettings('useCustomerMargins', false)}
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
                onClick={() => updateMarginSettings('useCustomerMargins', true)}
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

          {/* Manual Margin Settings */}
          {!marginSettings.useCustomerMargins && (
            <div className="space-y-4">
              {/* Margin Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Margin Type
                </label>
                <div className="flex space-x-4">
                  <button
                    onClick={() => updateMarginSettings('marginType', 'percentage')}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      marginSettings.marginType === 'percentage'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Percent className="h-5 w-5" />
                    <span>Percentage</span>
                  </button>
                  <button
                    onClick={() => updateMarginSettings('marginType', 'fixed')}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      marginSettings.marginType === 'fixed'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <DollarSign className="h-5 w-5" />
                    <span>Fixed Amount</span>
                  </button>
                </div>
              </div>

              {/* Margin Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {marginSettings.marginType === 'percentage' ? 'Margin Percentage' : 'Fixed Margin Amount'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step={marginSettings.marginType === 'percentage' ? '0.1' : '1'}
                    value={marginSettings.marginValue}
                    onChange={(e) => updateMarginSettings('marginValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={marginSettings.marginType === 'percentage' ? '15.0' : '500'}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {marginSettings.marginType === 'percentage' ? '%' : '$'}
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {marginSettings.marginType === 'percentage' 
                    ? 'Customer price = Carrier cost ÷ (1 - margin%)'
                    : 'Customer price = Carrier cost + fixed amount'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Minimum Profit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Profit per Shipment
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={marginSettings.minimumProfit}
                onChange={(e) => updateMarginSettings('minimumProfit', parseFloat(e.target.value) || 0)}
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
              <div>Carrier Rate: $1,000</div>
              {marginSettings.useCustomerMargins ? (
                <>
                  <div>Customer: {marginSettings.selectedCustomer || 'No customer selected'}</div>
                  <div>Method: Database lookup with fallback</div>
                </>
              ) : (
                <>
                  <div>
                    {marginSettings.marginType === 'percentage' 
                      ? `Margin (${marginSettings.marginValue}%): $${(1000 / (1 - marginSettings.marginValue / 100) - 1000).toFixed(0)}`
                      : `Fixed Margin: $${marginSettings.marginValue}`
                    }
                  </div>
                  <div className="border-t pt-1 font-medium">
                    Customer Price: $
                    {marginSettings.marginType === 'percentage' 
                      ? Math.max(1000 / (1 - marginSettings.marginValue / 100), 1000 + marginSettings.minimumProfit).toFixed(0)
                      : Math.max(1000 + marginSettings.marginValue, 1000 + marginSettings.minimumProfit).toFixed(0)
                    }
                  </div>
                  <div className="text-green-600">
                    Profit: $
                    {marginSettings.marginType === 'percentage' 
                      ? Math.max((1000 / (1 - marginSettings.marginValue / 100) - 1000), marginSettings.minimumProfit).toFixed(0)
                      : Math.max(marginSettings.marginValue, marginSettings.minimumProfit).toFixed(0)
                    }
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Basic Shipment Information */}
      {renderSection(
        'Basic Shipment Information',
        <MapPin className="h-5 w-5" />,
        'basic',
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin ZIP *</label>
            <input
              type="text"
              value={formData.fromZip || ''}
              onChange={(e) => updateFormData('fromZip', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="60607"
              maxLength={5}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination ZIP *</label>
            <input
              type="text"
              value={formData.toZip || ''}
              onChange={(e) => updateFormData('toZip', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="30033"
              maxLength={5}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date *</label>
            <input
              type="date"
              value={formData.fromDate || ''}
              onChange={(e) => updateFormData('fromDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pallets *</label>
            <input
              type="number"
              min="1"
              value={formData.pallets || ''}
              onChange={(e) => updateFormData('pallets', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Weight (lbs) *</label>
            <input
              type="number"
              min="1"
              value={formData.grossWeight || ''}
              onChange={(e) => updateFormData('grossWeight', parseInt(e.target.value) || 1000)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current line items total: {calculateTotalWeight()} lbs
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Smart Routing</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="isReefer"
                  checked={!formData.isReefer}
                  onChange={() => updateFormData('isReefer', false)}
                  className="mr-2"
                />
                <span className="text-sm">Project44</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="isReefer"
                  checked={formData.isReefer}
                  onChange={() => updateFormData('isReefer', true)}
                  className="mr-2"
                />
                <span className="text-sm">FreshX Reefer</span>
              </label>
            </div>
          </div>
          
          {formData.isReefer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <select
                value={formData.temperature || 'AMBIENT'}
                onChange={(e) => updateFormData('temperature', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="AMBIENT">Ambient</option>
                <option value="CHILLED">Chilled</option>
                <option value="FROZEN">Frozen</option>
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
            <select
              value={formData.freightClass || '70'}
              onChange={(e) => updateFormData('freightClass', e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Stackable</label>
            <select
              value={formData.isStackable ? 'true' : 'false'}
              onChange={(e) => updateFormData('isStackable', e.target.value === 'true')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>
      )}

      {/* Line Items */}
      {renderSection(
        'Line Items',
        <Package className="h-5 w-5" />,
        'items',
        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900">Item {index + 1}</h4>
                {lineItems.length > 1 && (
                  <button
                    onClick={() => removeLineItem(item.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Item description"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs) *</label>
                  <input
                    type="number"
                    min="1"
                    value={item.totalWeight}
                    onChange={(e) => updateLineItem(item.id, 'totalWeight', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class *</label>
                  <select
                    value={item.freightClass}
                    onChange={(e) => updateLineItem(item.id, 'freightClass', e.target.value)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length (in) *</label>
                  <input
                    type="number"
                    min="1"
                    value={item.packageLength}
                    onChange={(e) => updateLineItem(item.id, 'packageLength', parseInt(e.target.value) || 48)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (in) *</label>
                  <input
                    type="number"
                    min="1"
                    value={item.packageWidth}
                    onChange={(e) => updateLineItem(item.id, 'packageWidth', parseInt(e.target.value) || 40)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (in) *</label>
                  <input
                    type="number"
                    min="1"
                    value={item.packageHeight}
                    onChange={(e) => updateLineItem(item.id, 'packageHeight', parseInt(e.target.value) || 48)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Type</label>
                  <select
                    value={item.packageType}
                    onChange={(e) => updateLineItem(item.id, 'packageType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PLT">Pallet</option>
                    <option value="BOX">Box</option>
                    <option value="CRATE">Crate</option>
                    <option value="CARTON">Carton</option>
                    <option value="CASE">Case</option>
                    <option value="DRUM">Drum</option>
                    <option value="PIECES">Pieces</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          
          <button
            onClick={addLineItem}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Line Item</span>
          </button>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Summary:</p>
              <p>Total Weight: {calculateTotalWeight()} lbs</p>
              <p>Linear Feet: {calculateLinearFeet().toFixed(1)} ft</p>
              <p>Routing Decision: {determineRoutingDecision()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Accessorial Services */}
      {renderSection(
        'Accessorial Services',
        <CheckCircle className="h-5 w-5" />,
        'accessorials',
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries({
            LGPU: 'Liftgate Pickup',
            LGDEL: 'Liftgate Delivery',
            INPU: 'Inside Pickup',
            INDEL: 'Inside Delivery',
            RESPU: 'Residential Pickup',
            RESDEL: 'Residential Delivery',
            APPTPU: 'Appointment Pickup',
            APPTDEL: 'Appointment Delivery',
            LTDPU: 'Limited Access Pickup',
            LTDDEL: 'Limited Access Delivery',
            SATPU: 'Saturday Pickup',
            SATDEL: 'Saturday Delivery',
            NOTIFY: 'Delivery Notification',
            NBPU: 'Non-Business Hours Pickup',
            NBDEL: 'Non-Business Hours Delivery'
          }).map(([code, label]) => (
            <label key={code} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={accessorials[code] || false}
                onChange={() => toggleAccessorial(code)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Quote Button */}
      <div className="flex justify-center">
        <button
          onClick={getSpotQuote}
          disabled={isQuoting || !project44Client}
          className={`flex items-center space-x-3 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 ${
            isQuoting || !project44Client
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
          }`}
        >
          {isQuoting ? (
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

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Routing Decision */}
      {routingDecision && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800 font-medium">Routing Decision: {routingDecision}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {quotes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Spot Quote Results ({quotes.length} quotes)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quotes.map((quote, index) => (
                  <tr key={index} className={index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{quote.carrier.name}</div>
                      {quote.carrier.scac && (
                        <div className="text-xs text-gray-500">SCAC: {quote.carrier.scac}</div>
                      )}
                      {(quote as any).quoteModeLabel && (
                        <div className="text-xs text-blue-600">{(quote as any).quoteModeLabel}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {quote.serviceLevel?.description || quote.serviceLevel?.code || 'Standard'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {quote.transitDays ? `${quote.transitDays} days` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(quote.carrierTotalRate)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">
                      {formatCurrency(quote.customerPrice)}
                      {index === 0 && (
                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          BEST
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      {formatCurrency(quote.profit)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {quote.appliedMarginPercentage?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};