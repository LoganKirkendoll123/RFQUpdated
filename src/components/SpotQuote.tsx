import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  MapPin, 
  Package, 
  Clock, 
  Thermometer, 
  Plus, 
  Trash2, 
  Calculator,
  Users,
  Building2,
  Truck,
  Loader,
  AlertCircle,
  CheckCircle,
  Target,
  DollarSign
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient, CarrierGroup } from '../utils/apiClient';
import { RFQRow, PricingSettings, ProcessingResult, QuoteWithPricing, LineItemData } from '../types';
import { CustomerSelection } from './CustomerSelection';
import { CarrierSelection } from './CarrierSelection';
import { PricingSettingsComponent } from './PricingSettings';
import { RFQCard } from './RFQCard';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';

interface SpotQuoteProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

interface SpotQuoteFormData {
  fromDate: string;
  fromZip: string;
  toZip: string;
  pallets: number;
  grossWeight: number;
  isStackable: boolean;
  isReefer: boolean;
  temperature?: 'AMBIENT' | 'CHILLED' | 'FROZEN';
  commodity?: string;
  isFoodGrade?: boolean;
  freightClass?: string;
  commodityDescription?: string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  lineItems: LineItemData[];
}

export const SpotQuote: React.FC<SpotQuoteProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  const [formData, setFormData] = useState<SpotQuoteFormData>({
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
    lineItems: []
  });

  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [localSelectedCarriers, setLocalSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);
  
  const [localPricingSettings, setLocalPricingSettings] = useState<PricingSettings>(pricingSettings);
  const [localSelectedCustomer, setLocalSelectedCustomer] = useState<string>(selectedCustomer);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [error, setError] = useState<string>('');

  // Initialize local state from props
  useEffect(() => {
    setLocalSelectedCarriers(selectedCarriers);
  }, [selectedCarriers]);

  useEffect(() => {
    setLocalPricingSettings(pricingSettings);
  }, [pricingSettings]);

  useEffect(() => {
    setLocalSelectedCustomer(selectedCustomer);
  }, [selectedCustomer]);

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
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setLocalSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
    });
    setLocalSelectedCarriers(newSelection);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    const newSelection = { ...localSelectedCarriers };
    group.carriers.forEach(carrier => {
      newSelection[carrier.id] = selected;
    });
    setLocalSelectedCarriers(newSelection);
  };

  const addLineItem = () => {
    const newItem: LineItemData = {
      id: formData.lineItems.length + 1,
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
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem]
    }));
  };

  const updateLineItem = (index: number, updates: Partial<LineItemData>) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      )
    }));
  };

  const removeLineItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
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
      const itemTotalWeight = formData.lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
      if (Math.abs(formData.grossWeight - itemTotalWeight) > 10) {
        errors.push(`Gross weight (${formData.grossWeight}) must equal sum of item weights (${itemTotalWeight})`);
      }
      
      formData.lineItems.forEach((item, index) => {
        if (!item.description) {
          errors.push(`Item ${index + 1}: Description is required`);
        }
        if (item.totalWeight <= 0) {
          errors.push(`Item ${index + 1}: Weight must be greater than 0`);
        }
        if (!item.freightClass) {
          errors.push(`Item ${index + 1}: Freight class is required`);
        }
        if (item.packageLength <= 0 || item.packageWidth <= 0 || item.packageHeight <= 0) {
          errors.push(`Item ${index + 1}: All dimensions must be greater than 0`);
        }
      });
    }
    
    return errors;
  };

  const classifyShipment = (rfq: RFQRow): {quoting: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual', reason: string} => {
    // Check the isReefer field first - this is the primary quoting control
    if (rfq.isReefer === true) {
      return {
        quoting: 'freshx',
        reason: `Marked as reefer shipment (isReefer=TRUE) - quoted through FreshX reefer network`
      };
    }
    
    // For non-reefer shipments (isReefer=FALSE or undefined), quote through Project44
    // Determine LTL vs VLTL based on size and weight
    if (rfq.pallets >= 10 || rfq.grossWeight >= 15000) {
      return {
        quoting: 'project44-dual',
        reason: `Large shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through both Project44 Volume LTL and Standard LTL for comparison`
      };
    } else {
      return {
        quoting: 'project44-standard',
        reason: `Standard shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through Project44 Standard LTL`
      };
    }
  };

  const processSpotQuote = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    if (!project44Client) {
      setError('Project44 client not available');
      return;
    }

    const selectedCarrierIds = Object.entries(localSelectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setError('Please select at least one carrier');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults([]);

    try {
      // Convert form data to RFQRow
      const rfqData: RFQRow = {
        fromDate: formData.fromDate,
        fromZip: formData.fromZip,
        toZip: formData.toZip,
        pallets: formData.pallets,
        grossWeight: formData.grossWeight,
        isStackable: formData.isStackable,
        isReefer: formData.isReefer,
        temperature: formData.temperature,
        commodity: formData.commodity,
        isFoodGrade: formData.isFoodGrade,
        freightClass: formData.freightClass,
        commodityDescription: formData.commodityDescription,
        originCity: formData.originCity,
        originState: formData.originState,
        destinationCity: formData.destinationCity,
        destinationState: formData.destinationState,
        lineItems: formData.lineItems.length > 0 ? formData.lineItems : undefined,
        accessorial: []
      };

      // Classify the shipment using the smart quoting logic
      const classification = classifyShipment(rfqData);
      
      console.log(`🧠 Spot Quote Classification: ${classification.reason}`);

      const allResults: ProcessingResult[] = [];

      if (classification.quoting === 'freshx' && freshxClient) {
        console.log(`🌡️ Getting FreshX quotes for spot quote`);
        const quotes = await freshxClient.getQuotes(rfqData);
        
        if (quotes.length > 0) {
          const quotesWithPricing = await Promise.all(
            quotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, localPricingSettings, localSelectedCustomer)
            )
          );
          
          const result: ProcessingResult = {
            rowIndex: 0,
            originalData: rfqData,
            quotes: quotesWithPricing,
            status: 'success'
          };
          
          // Add smart quoting metadata
          (result as any).quotingDecision = classification.quoting;
          (result as any).quotingReason = classification.reason;
          
          allResults.push(result);
        }
      } else if (classification.quoting === 'project44-dual') {
        console.log(`📦 Getting dual quotes (Volume LTL + Standard LTL) for spot quote`);
        
        // Get both Volume LTL and Standard LTL quotes
        const [volumeQuotes, standardQuotes] = await Promise.all([
          project44Client.getQuotes(rfqData, selectedCarrierIds, true, false, false),  // Volume LTL
          project44Client.getQuotes(rfqData, selectedCarrierIds, false, false, false)  // Standard LTL
        ]);
        
        // Tag quotes with their mode for identification
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
        
        const allQuotes = [...taggedVolumeQuotes, ...taggedStandardQuotes];
        
        if (allQuotes.length > 0) {
          const quotesWithPricing = await Promise.all(
            allQuotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, localPricingSettings, localSelectedCustomer)
            )
          );
          
          const result: ProcessingResult = {
            rowIndex: 0,
            originalData: rfqData,
            quotes: quotesWithPricing,
            status: 'success'
          };
          
          // Add smart quoting metadata
          (result as any).quotingDecision = classification.quoting;
          (result as any).quotingReason = classification.reason;
          
          allResults.push(result);
        }
      } else {
        console.log(`🚛 Getting Standard LTL quotes for spot quote`);
        const quotes = await project44Client.getQuotes(rfqData, selectedCarrierIds, false, false, false);
        
        if (quotes.length > 0) {
          const quotesWithPricing = await Promise.all(
            quotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, localPricingSettings, localSelectedCustomer)
            )
          );
          
          const result: ProcessingResult = {
            rowIndex: 0,
            originalData: rfqData,
            quotes: quotesWithPricing,
            status: 'success'
          };
          
          // Add smart quoting metadata
          (result as any).quotingDecision = classification.quoting;
          (result as any).quotingReason = classification.reason;
          
          allResults.push(result);
        }
      }

      setResults(allResults);
      console.log(`✅ Spot quote completed: ${allResults.length} results`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process spot quote';
      setError(errorMsg);
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
            return calculatePricingWithCustomerMargins(quote, localPricingSettings, localSelectedCustomer, newPrice);
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

  const getShipmentSummary = () => {
    const classification = classifyShipment({
      fromDate: formData.fromDate,
      fromZip: formData.fromZip,
      toZip: formData.toZip,
      pallets: formData.pallets,
      grossWeight: formData.grossWeight,
      isStackable: formData.isStackable,
      isReefer: formData.isReefer,
      accessorial: []
    });

    return {
      route: `${formData.fromZip} → ${formData.toZip}`,
      details: `${formData.pallets} pallets, ${formData.grossWeight.toLocaleString()} lbs`,
      routing: classification.quoting.replace('project44-', '').toUpperCase(),
      reason: classification.reason
    };
  };

  const summary = getShipmentSummary();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Spot Quote</h1>
            <p className="text-sm text-gray-600">
              Get instant freight quotes with smart routing and competitive pricing
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Shipment Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={formData.fromDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pallets</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.pallets}
                  onChange={(e) => setFormData(prev => ({ ...prev, pallets: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin ZIP</label>
                <input
                  type="text"
                  value={formData.fromZip}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromZip: e.target.value }))}
                  placeholder="60607"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination ZIP</label>
                <input
                  type="text"
                  value={formData.toZip}
                  onChange={(e) => setFormData(prev => ({ ...prev, toZip: e.target.value }))}
                  placeholder="30033"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gross Weight (lbs)</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={formData.grossWeight}
                  onChange={(e) => setFormData(prev => ({ ...prev, grossWeight: parseInt(e.target.value) || 1000 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
                <input
                  type="text"
                  value={formData.freightClass || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, freightClass: e.target.value }))}
                  placeholder="70"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            
            <div className="mt-4 space-y-3">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isStackable}
                    onChange={(e) => setFormData(prev => ({ ...prev, isStackable: e.target.checked }))}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Stackable</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isReefer}
                    onChange={(e) => setFormData(prev => ({ ...prev, isReefer: e.target.checked }))}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Reefer (Route to FreshX)</span>
                </label>
              </div>
              
              {formData.isReefer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                    <select
                      value={formData.temperature}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="AMBIENT">Ambient</option>
                      <option value="CHILLED">Chilled</option>
                      <option value="FROZEN">Frozen</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
                    <input
                      type="text"
                      value={formData.commodity || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, commodity: e.target.value }))}
                      placeholder="FOODSTUFFS"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Line Items (Optional)</h3>
              <button
                onClick={addLineItem}
                className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>
            
            {formData.lineItems.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No line items added. The system will use default dimensions based on pallets and weight.
              </p>
            ) : (
              <div className="space-y-4">
                {formData.lineItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Item {index + 1}</h4>
                      <button
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, { description: e.target.value })}
                          placeholder="Item description"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.totalWeight}
                          onChange={(e) => updateLineItem(index, { totalWeight: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
                        <input
                          type="text"
                          value={item.freightClass}
                          onChange={(e) => updateLineItem(index, { freightClass: e.target.value })}
                          placeholder="70"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Packages</label>
                        <input
                          type="number"
                          min="1"
                          value={item.totalPackages}
                          onChange={(e) => updateLineItem(index, { totalPackages: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Length (in)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.packageLength}
                          onChange={(e) => updateLineItem(index, { packageLength: parseInt(e.target.value) || 48 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width (in)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.packageWidth}
                          onChange={(e) => updateLineItem(index, { packageWidth: parseInt(e.target.value) || 40 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.packageHeight}
                          onChange={(e) => updateLineItem(index, { packageHeight: parseInt(e.target.value) || 48 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-800">
                    <strong>Weight Check:</strong> Total item weight: {formData.lineItems.reduce((sum, item) => sum + item.totalWeight, 0)} lbs
                    {Math.abs(formData.grossWeight - formData.lineItems.reduce((sum, item) => sum + item.totalWeight, 0)) > 10 && (
                      <span className="text-red-600 ml-2">
                        ⚠️ Should match gross weight ({formData.grossWeight} lbs)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Carrier Selection */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Carrier Selection</h3>
                {!carriersLoaded && (
                  <button
                    onClick={loadCarriers}
                    disabled={isLoadingCarriers}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                  >
                    {isLoadingCarriers ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Truck className="h-4 w-4" />
                    )}
                    <span>{isLoadingCarriers ? 'Loading...' : 'Load Carriers'}</span>
                  </button>
                )}
              </div>
            </div>
            
            {carriersLoaded && (
              <div className="p-6">
                <CarrierSelection
                  carrierGroups={carrierGroups}
                  selectedCarriers={localSelectedCarriers}
                  onToggleCarrier={handleCarrierToggle}
                  onSelectAll={handleSelectAll}
                  onSelectAllInGroup={handleSelectAllInGroup}
                  onRefreshCarriers={() => loadCarriers()} 
                  isLoading={isLoadingCarriers}
                />
              </div>
            )}
          </div>

          {/* Pricing Settings */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <PricingSettingsComponent
              settings={localPricingSettings}
              onSettingsChange={setLocalPricingSettings}
              selectedCustomer={localSelectedCustomer}
              onCustomerChange={setLocalSelectedCustomer}
              showAsCard={false}
            />
          </div>
        </div>

        {/* Summary and Action Column */}
        <div className="space-y-6">
          {/* Shipment Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Summary</h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{summary.route}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{summary.details}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">Routing: {summary.routing}</span>
              </div>
              
              {formData.isReefer && (
                <div className="flex items-center space-x-2">
                  <Thermometer className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-700">{formData.temperature}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">
                  {Object.values(localSelectedCarriers).filter(Boolean).length} carriers selected
                </span>
              </div>
              
              {localSelectedCustomer && (
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{localSelectedCustomer}</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600">
                <strong>Smart Routing:</strong> {summary.reason}
              </div>
            </div>
          </div>

          {/* Get Quote Button */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <button
              onClick={processSpotQuote}
              disabled={isProcessing || !project44Client}
              className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Getting Quotes...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Get Instant Quote</span>
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
          </div>
        </div>
      </div>

      {/* Results Section - Using Identical RFQ Results Display */}
      {results.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Spot Quote Results</h2>
                <p className="text-sm text-gray-600">
                  {results[0]?.quotes.length || 0} quotes received using smart routing
                </p>
              </div>
            </div>
          </div>

          {/* Use the exact same RFQCard component as the main RFQ results */}
          {results.map((result, index) => (
            <RFQCard
              key={index}
              result={result}
              onPriceUpdate={(quoteId, newPrice) => handlePriceUpdate(index, quoteId, newPrice)}
            />
          ))}
        </div>
      )}
    </div>
  );
};