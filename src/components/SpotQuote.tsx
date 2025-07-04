import React, { useState } from 'react';
import { 
  Zap, MapPin, Package, Calendar, DollarSign, Truck, Clock, AlertCircle, CheckCircle, Loader,
  User, Phone, Mail, Building2, Shield, Thermometer, Wrench, Plus, Minus, ChevronDown, ChevronUp,
  Info, Settings, Globe, CreditCard, Scale, Ruler, Box, FileText, AlertTriangle
} from 'lucide-react';
import { RFQRow, ProcessingResult, LineItemData } from '../types';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { PricingSettings } from '../types';
import { ResultsTable } from './ResultsTable';

interface SpotQuoteProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

// Project44 accessorial codes
const PROJECT44_ACCESSORIALS = [
  { code: 'LGPU', label: 'Liftgate Pickup' },
  { code: 'LGDEL', label: 'Liftgate Delivery' },
  { code: 'INPU', label: 'Inside Pickup' },
  { code: 'INDEL', label: 'Inside Delivery' },
  { code: 'RESPU', label: 'Residential Pickup' },
  { code: 'RESDEL', label: 'Residential Delivery' },
  { code: 'APPTPU', label: 'Appointment Pickup' },
  { code: 'APPTDEL', label: 'Appointment Delivery' },
  { code: 'LTDPU', label: 'Limited Access Pickup' },
  { code: 'LTDDEL', label: 'Limited Access Delivery' },
  { code: 'SATPU', label: 'Saturday Pickup' },
  { code: 'SATDEL', label: 'Saturday Delivery' },
  { code: 'NOTIFY', label: 'Delivery Notification' },
  { code: 'SORTPU', label: 'Sort/Segregate Pickup' },
  { code: 'SORTDEL', label: 'Sort/Segregate Delivery' }
];

export const SpotQuote: React.FC<SpotQuoteProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  const [formData, setFormData] = useState({
    // Core shipment details
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    fromDate: new Date().toISOString().split('T')[0],
    isReefer: false,
    temperature: 'AMBIENT' as const,
    commodity: 'FOODSTUFFS' as const,
    freightClass: '70',
    isStackable: false,
    isFoodGrade: false,
    
    // Enhanced shipment details
    deliveryDate: '',
    deliveryStartTime: '',
    deliveryEndTime: '',
    pickupStartTime: '',
    pickupEndTime: '',
    nmfcCode: '',
    nmfcSubCode: '',
    commodityDescription: '',
    commodityType: '',
    packageType: 'PLT' as const,
    totalPackages: 0,
    totalPieces: 0,
    totalValue: 0,
    insuranceAmount: 0,
    harmonizedCode: '',
    countryOfManufacture: 'US' as const,
    
    // Hazmat information
    hazmat: false,
    hazmatClass: '',
    hazmatIdNumber: '',
    hazmatPackingGroup: 'III' as const,
    hazmatProperShippingName: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactCompany: '',
    
    // Address details
    originAddressLines: '',
    originCity: '',
    originState: '',
    originCountry: 'US',
    destinationAddressLines: '',
    destinationCity: '',
    destinationState: '',
    destinationCountry: 'US',
    
    // Contact information
    pickupContactName: '',
    pickupContactPhone: '',
    pickupContactEmail: '',
    pickupCompanyName: '',
    deliveryContactName: '',
    deliveryContactPhone: '',
    deliveryContactEmail: '',
    deliveryCompanyName: '',
    
    // API configuration
    preferredCurrency: 'USD' as const,
    paymentTerms: 'PREPAID' as const,
    direction: 'SHIPPER' as const,
    preferredSystemOfMeasurement: 'IMPERIAL' as const,
    lengthUnit: 'IN' as const,
    weightUnit: 'LB' as const,
    allowUnacceptedAccessorials: true,
    fetchAllGuaranteed: true,
    fetchAllInsideDelivery: true,
    fetchAllServiceLevels: true,
    enableUnitConversion: true,
    fallBackToDefaultAccountGroup: true,
    apiTimeout: 30,
    totalLinearFeet: 0,
    
    // Accessorial services
    accessorials: {} as { [code: string]: boolean }
  });
  
  const [lineItems, setLineItems] = useState<LineItemData[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLineItems, setShowLineItems] = useState(false);
  const [showAccessorials, setShowAccessorials] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showHazmat, setShowHazmat] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [error, setError] = useState<string>('');

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAccessorialChange = (code: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      accessorials: {
        ...prev.accessorials,
        [code]: checked
      }
    }));
  };

  const addLineItem = () => {
    const newItem: LineItemData = {
      id: lineItems.length + 1,
      description: '',
      totalWeight: 0,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      totalPieces: 1,
      stackable: false
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItemData, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSpotQuote = async () => {
    if (!formData.fromZip || !formData.toZip) {
      setError('Please enter both origin and destination ZIP codes');
      return;
    }

    if (!project44Client && !freshxClient) {
      setError('No API clients available. Please configure your API keys.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults([]);

    try {
      // Create comprehensive RFQ data from form
      const rfqData: RFQRow = {
        fromDate: formData.fromDate,
        fromZip: formData.fromZip,
        toZip: formData.toZip,
        pallets: formData.pallets,
        grossWeight: formData.grossWeight,
        isStackable: formData.isStackable,
        accessorial: Object.entries(formData.accessorials)
          .filter(([_, checked]) => checked)
          .map(([code, _]) => code),
        isReefer: formData.isReefer,
        temperature: formData.temperature,
        commodity: formData.commodity,
        isFoodGrade: formData.isFoodGrade,
        freightClass: formData.freightClass,
        
        // Enhanced fields
        deliveryDate: formData.deliveryDate || undefined,
        deliveryStartTime: formData.deliveryStartTime || undefined,
        deliveryEndTime: formData.deliveryEndTime || undefined,
        pickupStartTime: formData.pickupStartTime || undefined,
        pickupEndTime: formData.pickupEndTime || undefined,
        nmfcCode: formData.nmfcCode || undefined,
        nmfcSubCode: formData.nmfcSubCode || undefined,
        commodityDescription: formData.commodityDescription || undefined,
        commodityType: formData.commodityType || undefined,
        packageType: formData.packageType,
        totalPackages: formData.totalPackages || undefined,
        totalPieces: formData.totalPieces || undefined,
        totalValue: formData.totalValue || undefined,
        insuranceAmount: formData.insuranceAmount || undefined,
        harmonizedCode: formData.harmonizedCode || undefined,
        countryOfManufacture: formData.countryOfManufacture,
        
        // Hazmat
        hazmat: formData.hazmat,
        hazmatClass: formData.hazmatClass || undefined,
        hazmatIdNumber: formData.hazmatIdNumber || undefined,
        hazmatPackingGroup: formData.hazmatPackingGroup,
        hazmatProperShippingName: formData.hazmatProperShippingName || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactCompany: formData.emergencyContactCompany || undefined,
        
        // Addresses
        originAddressLines: formData.originAddressLines ? [formData.originAddressLines] : undefined,
        originCity: formData.originCity || undefined,
        originState: formData.originState || undefined,
        originCountry: formData.originCountry || undefined,
        destinationAddressLines: formData.destinationAddressLines ? [formData.destinationAddressLines] : undefined,
        destinationCity: formData.destinationCity || undefined,
        destinationState: formData.destinationState || undefined,
        destinationCountry: formData.destinationCountry || undefined,
        
        // Contacts
        pickupContactName: formData.pickupContactName || undefined,
        pickupContactPhone: formData.pickupContactPhone || undefined,
        pickupContactEmail: formData.pickupContactEmail || undefined,
        pickupCompanyName: formData.pickupCompanyName || undefined,
        deliveryContactName: formData.deliveryContactName || undefined,
        deliveryContactPhone: formData.deliveryContactPhone || undefined,
        deliveryContactEmail: formData.deliveryContactEmail || undefined,
        deliveryCompanyName: formData.deliveryCompanyName || undefined,
        
        // API config
        preferredCurrency: formData.preferredCurrency,
        paymentTerms: formData.paymentTerms,
        direction: formData.direction,
        preferredSystemOfMeasurement: formData.preferredSystemOfMeasurement,
        lengthUnit: formData.lengthUnit,
        weightUnit: formData.weightUnit,
        allowUnacceptedAccessorials: formData.allowUnacceptedAccessorials,
        fetchAllGuaranteed: formData.fetchAllGuaranteed,
        fetchAllInsideDelivery: formData.fetchAllInsideDelivery,
        fetchAllServiceLevels: formData.fetchAllServiceLevels,
        enableUnitConversion: formData.enableUnitConversion,
        fallBackToDefaultAccountGroup: formData.fallBackToDefaultAccountGroup,
        apiTimeout: formData.apiTimeout,
        totalLinearFeet: formData.totalLinearFeet || undefined,
        
        // Line items
        lineItems: lineItems.length > 0 ? lineItems : undefined
      };

      const result: ProcessingResult = {
        rowIndex: 0,
        originalData: rfqData,
        quotes: [],
        status: 'processing'
      };

      // Determine routing based on isReefer field
      if (formData.isReefer && freshxClient) {
        console.log('🌡️ Getting FreshX spot quote...');
        const quotes = await freshxClient.getQuotes(rfqData);
        
        // Apply pricing to quotes
        const quotesWithPricing = await Promise.all(
          quotes.map(quote => 
            calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
          )
        );
        
        result.quotes = quotesWithPricing;
        result.status = 'success';
      } else if (!formData.isReefer && project44Client) {
        console.log('🚛 Getting Project44 spot quote...');
        
        const selectedCarrierIds = Object.entries(selectedCarriers)
          .filter(([_, selected]) => selected)
          .map(([carrierId, _]) => carrierId);

        // Determine if this should be Volume LTL
        const isVolumeMode = formData.pallets >= 10 || formData.grossWeight >= 15000;
        
        const quotes = await project44Client.getQuotes(
          rfqData, 
          selectedCarrierIds, 
          isVolumeMode, 
          false, 
          false
        );
        
        // Apply pricing to quotes
        const quotesWithPricing = await Promise.all(
          quotes.map(quote => 
            calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
          )
        );
        
        result.quotes = quotesWithPricing;
        result.status = 'success';
      } else {
        throw new Error('No suitable API client available for this quote type');
      }

      setResults([result]);
      console.log(`✅ Spot quote completed: ${result.quotes.length} quotes received`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get spot quote';
      setError(errorMessage);
      console.error('❌ Spot quote failed:', err);
    } finally {
      setIsProcessing(false);
    }
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
  };

  const exportResults = () => {
    console.log('📊 Exporting spot quote results...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Comprehensive Spot Quote</h2>
            <p className="text-sm text-gray-600">
              Full-featured quote form with all RFQ template options and smart routing
            </p>
          </div>
        </div>
      </div>

      {/* Main Quote Form */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Shipment Details</h3>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Core Shipment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Origin ZIP *
              </label>
              <input
                type="text"
                value={formData.fromZip}
                onChange={(e) => handleInputChange('fromZip', e.target.value)}
                placeholder="60607"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                maxLength={5}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Destination ZIP *
              </label>
              <input
                type="text"
                value={formData.toZip}
                onChange={(e) => handleInputChange('toZip', e.target.value)}
                placeholder="30033"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                maxLength={5}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Pickup Date *
              </label>
              <input
                type="date"
                value={formData.fromDate}
                onChange={(e) => handleInputChange('fromDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="inline h-4 w-4 mr-1" />
                Pallets *
              </label>
              <input
                type="number"
                value={formData.pallets}
                onChange={(e) => handleInputChange('pallets', parseInt(e.target.value) || 1)}
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Scale className="inline h-4 w-4 mr-1" />
                Weight (lbs) *
              </label>
              <input
                type="number"
                value={formData.grossWeight}
                onChange={(e) => handleInputChange('grossWeight', parseInt(e.target.value) || 1000)}
                min="1"
                max="100000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Freight Class
              </label>
              <select
                value={formData.freightClass}
                onChange={(e) => handleInputChange('freightClass', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
          </div>

          {/* Smart Routing Section */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              Smart Routing Control
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isReefer"
                  checked={formData.isReefer}
                  onChange={(e) => handleInputChange('isReefer', e.target.checked)}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="isReefer" className="text-sm font-medium text-blue-900">
                  Route to FreshX Reefer Network (isReefer = TRUE)
                </label>
              </div>

              {formData.isReefer && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                      <Thermometer className="inline h-4 w-4 mr-1" />
                      Temperature
                    </label>
                    <select
                      value={formData.temperature}
                      onChange={(e) => handleInputChange('temperature', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="AMBIENT">Ambient</option>
                      <option value="CHILLED">Chilled</option>
                      <option value="FROZEN">Frozen</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                      Commodity
                    </label>
                    <select
                      value={formData.commodity}
                      onChange={(e) => handleInputChange('commodity', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="FOODSTUFFS">Foodstuffs</option>
                      <option value="FRESH_SEAFOOD">Fresh Seafood</option>
                      <option value="FROZEN_SEAFOOD">Frozen Seafood</option>
                      <option value="ICE_CREAM">Ice Cream</option>
                      <option value="PRODUCE">Produce</option>
                      <option value="ALCOHOL">Alcohol</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-3 pt-6">
                    <input
                      type="checkbox"
                      id="isFoodGrade"
                      checked={formData.isFoodGrade}
                      onChange={(e) => handleInputChange('isFoodGrade', e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isFoodGrade" className="text-sm font-medium text-blue-900">
                      Food Grade
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="isStackable"
                    checked={formData.isStackable}
                    onChange={(e) => handleInputChange('isStackable', e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isStackable" className="text-sm font-medium text-blue-900">
                    Stackable
                  </label>
                </div>
              </div>

              <div className="mt-3 p-3 bg-white border border-blue-200 rounded-md">
                <div className="text-sm text-blue-800">
                  <strong>Routing Decision:</strong>
                  {formData.isReefer ? (
                    <span className="ml-2 text-green-600">
                      FreshX Reefer Network ({formData.temperature})
                    </span>
                  ) : (
                    <span className="ml-2 text-blue-600">
                      Project44 {formData.pallets >= 10 || formData.grossWeight >= 15000 ? 'Volume LTL' : 'Standard LTL'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Shipment Details */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>Enhanced Shipment Details</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.pickupStartTime}
                    onChange={(e) => handleInputChange('pickupStartTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup End Time
                  </label>
                  <input
                    type="time"
                    value={formData.pickupEndTime}
                    onChange={(e) => handleInputChange('pickupEndTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NMFC Code
                  </label>
                  <input
                    type="text"
                    value={formData.nmfcCode}
                    onChange={(e) => handleInputChange('nmfcCode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Package Type
                  </label>
                  <select
                    value={formData.packageType}
                    onChange={(e) => handleInputChange('packageType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Value ($)
                  </label>
                  <input
                    type="number"
                    value={formData.totalValue}
                    onChange={(e) => handleInputChange('totalValue', parseFloat(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commodity Description
                  </label>
                  <input
                    type="text"
                    value={formData.commodityDescription}
                    onChange={(e) => handleInputChange('commodityDescription', e.target.value)}
                    placeholder="General freight"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Packages
                  </label>
                  <input
                    type="number"
                    value={formData.totalPackages}
                    onChange={(e) => handleInputChange('totalPackages', parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Linear Feet
                  </label>
                  <input
                    type="number"
                    value={formData.totalLinearFeet}
                    onChange={(e) => handleInputChange('totalLinearFeet', parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Line Items Section */}
          <div>
            <button
              type="button"
              onClick={() => setShowLineItems(!showLineItems)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showLineItems ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <Box className="h-4 w-4" />
              <span>Line Items ({lineItems.length})</span>
            </button>

            {showLineItems && (
              <div className="mt-4 space-y-4">
                {lineItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900">Item {index + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Weight (lbs)</label>
                        <input
                          type="number"
                          value={item.totalWeight}
                          onChange={(e) => updateLineItem(index, 'totalWeight', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Freight Class</label>
                        <select
                          value={item.freightClass}
                          onChange={(e) => updateLineItem(index, 'freightClass', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        >
                          <option value="50">50</option>
                          <option value="70">70</option>
                          <option value="85">85</option>
                          <option value="92.5">92.5</option>
                          <option value="100">100</option>
                          <option value="125">125</option>
                          <option value="150">150</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Packages</label>
                        <input
                          type="number"
                          value={item.totalPackages}
                          onChange={(e) => updateLineItem(index, 'totalPackages', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Length (in)</label>
                        <input
                          type="number"
                          value={item.packageLength}
                          onChange={(e) => updateLineItem(index, 'packageLength', parseFloat(e.target.value) || 48)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Width (in)</label>
                        <input
                          type="number"
                          value={item.packageWidth}
                          onChange={(e) => updateLineItem(index, 'packageWidth', parseFloat(e.target.value) || 40)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Height (in)</label>
                        <input
                          type="number"
                          value={item.packageHeight}
                          onChange={(e) => updateLineItem(index, 'packageHeight', parseFloat(e.target.value) || 48)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div className="flex items-center pt-4">
                        <input
                          type="checkbox"
                          checked={item.stackable}
                          onChange={(e) => updateLineItem(index, 'stackable', e.target.checked)}
                          className="h-3 w-3 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-xs font-medium text-gray-600">Stackable</label>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Line Item</span>
                </button>
              </div>
            )}
          </div>

          {/* Accessorial Services */}
          <div>
            <button
              type="button"
              onClick={() => setShowAccessorials(!showAccessorials)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showAccessorials ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <Wrench className="h-4 w-4" />
              <span>Accessorial Services</span>
            </button>

            {showAccessorials && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {PROJECT44_ACCESSORIALS.map((acc) => (
                  <div key={acc.code} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={acc.code}
                      checked={formData.accessorials[acc.code] || false}
                      onChange={(e) => handleAccessorialChange(acc.code, e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor={acc.code} className="text-sm text-gray-700">
                      {acc.label}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div>
            <button
              type="button"
              onClick={() => setShowContacts(!showContacts)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showContacts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <User className="h-4 w-4" />
              <span>Contact Information</span>
            </button>

            {showContacts && (
              <div className="mt-4 space-y-4">
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Pickup Contact</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                      <input
                        type="text"
                        value={formData.pickupCompanyName}
                        onChange={(e) => handleInputChange('pickupCompanyName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={formData.pickupContactName}
                        onChange={(e) => handleInputChange('pickupContactName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.pickupContactPhone}
                        onChange={(e) => handleInputChange('pickupContactPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.pickupContactEmail}
                        onChange={(e) => handleInputChange('pickupContactEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Delivery Contact</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                      <input
                        type="text"
                        value={formData.deliveryCompanyName}
                        onChange={(e) => handleInputChange('deliveryCompanyName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={formData.deliveryContactName}
                        onChange={(e) => handleInputChange('deliveryContactName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.deliveryContactPhone}
                        onChange={(e) => handleInputChange('deliveryContactPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.deliveryContactEmail}
                        onChange={(e) => handleInputChange('deliveryContactEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hazmat Information */}
          <div>
            <button
              type="button"
              onClick={() => setShowHazmat(!showHazmat)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showHazmat ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <AlertTriangle className="h-4 w-4" />
              <span>Hazmat Information</span>
            </button>

            {showHazmat && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="hazmat"
                    checked={formData.hazmat}
                    onChange={(e) => handleInputChange('hazmat', e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hazmat" className="text-sm font-medium text-gray-700">
                    Contains Hazardous Materials
                  </label>
                </div>

                {formData.hazmat && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hazmat Class</label>
                      <input
                        type="text"
                        value={formData.hazmatClass}
                        onChange={(e) => handleInputChange('hazmatClass', e.target.value)}
                        placeholder="e.g., 9"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">UN ID Number</label>
                      <input
                        type="text"
                        value={formData.hazmatIdNumber}
                        onChange={(e) => handleInputChange('hazmatIdNumber', e.target.value)}
                        placeholder="e.g., UN1234"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Packing Group</label>
                      <select
                        value={formData.hazmatPackingGroup}
                        onChange={(e) => handleInputChange('hazmatPackingGroup', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="I">I</option>
                        <option value="II">II</option>
                        <option value="III">III</option>
                        <option value="NONE">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Proper Shipping Name</label>
                      <input
                        type="text"
                        value={formData.hazmatProperShippingName}
                        onChange={(e) => handleInputChange('hazmatProperShippingName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Configuration */}
          <div>
            <button
              type="button"
              onClick={() => setShowApiConfig(!showApiConfig)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showApiConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <Settings className="h-4 w-4" />
              <span>API Configuration</span>
            </button>

            {showApiConfig && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="PREPAID">Prepaid</option>
                    <option value="COLLECT">Collect</option>
                    <option value="THIRD_PARTY">Third Party</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.preferredCurrency}
                    onChange={(e) => handleInputChange('preferredCurrency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Timeout (seconds)</label>
                  <input
                    type="number"
                    value={formData.apiTimeout}
                    onChange={(e) => handleInputChange('apiTimeout', parseInt(e.target.value) || 30)}
                    min="10"
                    max="120"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Get Quote Button */}
          <div className="flex justify-center pt-6">
            <button
              onClick={handleSpotQuote}
              disabled={isProcessing || !formData.fromZip || !formData.toZip}
              className={`flex items-center space-x-3 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 ${
                isProcessing || !formData.fromZip || !formData.toZip
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader className="h-6 w-6 animate-spin" />
                  <span>Getting Comprehensive Quote...</span>
                </>
              ) : (
                <>
                  <Zap className="h-6 w-6" />
                  <span>Get Comprehensive Spot Quote</span>
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Comprehensive Spot Quote Results</h3>
            </div>
          </div>
          <div className="p-6">
            <ResultsTable
              results={results}
              onExport={exportResults}
              onPriceUpdate={handlePriceUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
};