import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  Play, 
  Settings, 
  Package, 
  MapPin, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  Building, 
  AlertTriangle,
  CheckCircle,
  Loader,
  FileText,
  Zap,
  Target,
  Brain
} from 'lucide-react';
import { RFQRow, LineItemData, PricingSettings, Project44OAuthConfig } from '../types';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { PricingSettingsComponent } from './PricingSettings';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { usePricingSettings } from '../hooks/usePricingSettings';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings?: PricingSettings;
  initialSelectedCustomer?: string;
}

// Project44 LTL/VLTL accessorial options
const PROJECT44_ACCESSORIALS = [
  // Pickup Accessorial Services
  { code: 'AIRPU', label: 'Airport Pickup' },
  { code: 'APPTPU', label: 'Pickup Appointment' },
  { code: 'CAMPPU', label: 'Camp Pickup' },
  { code: 'CFSPU', label: 'Container Freight Station Pickup' },
  { code: 'CHRCPU', label: 'Church Pickup' },
  { code: 'CLUBPU', label: 'Country Club Pickup' },
  { code: 'CNVPU', label: 'Convention/Tradeshow Pickup' },
  { code: 'CONPU', label: 'Construction Site Pickup' },
  { code: 'DOCKPU', label: 'Dock Pickup' },
  { code: 'EDUPU', label: 'School Pickup' },
  { code: 'FARMPU', label: 'Farm Pickup' },
  { code: 'GOVPU', label: 'Government Site Pickup' },
  { code: 'GROPU', label: 'Grocery Warehouse Pickup' },
  { code: 'HOSPU', label: 'Hospital Pickup' },
  { code: 'HOTLPU', label: 'Hotel Pickup' },
  { code: 'INPU', label: 'Inside Pickup' },
  { code: 'LGPU', label: 'Liftgate Pickup' },
  { code: 'LTDPU', label: 'Limited Access Pickup' },
  { code: 'MILPU', label: 'Military Installation Pickup' },
  { code: 'MINEPU', label: 'Mine Site Pickup' },
  { code: 'NARPU', label: 'Native American Reservation Pickup' },
  { code: 'NBPU', label: 'Non-Business Hours Pickup' },
  { code: 'NURSPU', label: 'Nursing Home Pickup' },
  { code: 'PARKPU', label: 'Fair/Amusement/Park Pickup' },
  { code: 'PIERPU', label: 'Pier Pickup' },
  { code: 'PRISPU', label: 'Prison Pickup' },
  { code: 'RESPU', label: 'Residential Pickup' },
  { code: 'SATPU', label: 'Saturday Pickup' },
  { code: 'SORTPU', label: 'Sort/Segregate Pickup' },
  { code: 'SSTORPU', label: 'Self-Storage Pickup' },
  { code: 'UTLPU', label: 'Utility Site Pickup' },

  // Delivery Accessorial Services
  { code: 'AIRDEL', label: 'Airport Delivery' },
  { code: 'CAMPDEL', label: 'Camp Delivery' },
  { code: 'CFSDEL', label: 'Container Freight Station Delivery' },
  { code: 'CHRCDEL', label: 'Church Delivery' },
  { code: 'CLUBDEL', label: 'Country Club Delivery' },
  { code: 'CNVDEL', label: 'Convention/Tradeshow Delivery' },
  { code: 'CONDEL', label: 'Construction Site Delivery' },
  { code: 'DCDEL', label: 'Distribution Center Delivery' },
  { code: 'DOCKDEL', label: 'Dock Delivery' },
  { code: 'EDUDEL', label: 'School Delivery' },
  { code: 'FARMDEL', label: 'Farm Delivery' },
  { code: 'GOVDEL', label: 'Government Site Delivery' },
  { code: 'GRODEL', label: 'Grocery Warehouse Delivery' },
  { code: 'HDAYDEL', label: 'Holiday Delivery' },
  { code: 'HOSDEL', label: 'Hospital Delivery' },
  { code: 'HOTLDEL', label: 'Hotel Delivery' },
  { code: 'INDEL', label: 'Inside Delivery' },
  { code: 'INEDEL', label: 'Inside Delivery - With Elevator' },
  { code: 'INGDEL', label: 'Inside Delivery - Ground Floor' },
  { code: 'INNEDEL', label: 'Inside Delivery - No Elevator' },
  { code: 'MALLDEL', label: 'Mall Delivery' },
  { code: 'MILDEL', label: 'Military Installation Delivery' },
  { code: 'MINEDEL', label: 'Mine Site Delivery' },
  { code: 'NARDEL', label: 'Native American Reservation Delivery' },
  { code: 'NBDEL', label: 'Non-Business Hours Delivery' },
  { code: 'NCDEL', label: 'Non-Commercial Delivery' },
  { code: 'NOTIFY', label: 'Delivery Notification' },
  { code: 'NURSDEL', label: 'Nursing Home Delivery' },
  { code: 'PARKDEL', label: 'Fair/Amusement/Park Delivery' },
  { code: 'PIERDEL', label: 'Pier Delivery' },
  { code: 'PRISDEL', label: 'Prison Delivery' },
  { code: 'RESDEL', label: 'Residential Delivery' },
  { code: 'RSRTDEL', label: 'Resort Delivery' },
  { code: 'SATDEL', label: 'Saturday Delivery' },
  { code: 'SORTDEL', label: 'Sort/Segregate Delivery' },
  { code: 'SSTORDEL', label: 'Self-Storage Delivery' },
  { code: 'SUNDEL', label: 'Sunday Delivery' },
  { code: 'UTLDEL', label: 'Utility Site Delivery' },
  { code: 'WEDEL', label: 'Weekend Delivery' }
];

const PACKAGE_TYPES = [
  'BAG', 'BALE', 'BOX', 'BUCKET', 'BUNDLE', 'CAN', 'CARTON', 'CASE', 
  'COIL', 'CRATE', 'CYLINDER', 'DRUM', 'PAIL', 'PLT', 'PIECES', 
  'REEL', 'ROLL', 'SKID', 'TOTE', 'TUBE'
];

const TEMPERATURE_OPTIONS = ['AMBIENT', 'CHILLED', 'FROZEN'];
const COMMODITY_OPTIONS = ['ALCOHOL', 'FOODSTUFFS', 'FRESH_SEAFOOD', 'FROZEN_SEAFOOD', 'ICE_CREAM', 'PRODUCE'];
const FREIGHT_CLASSES = ['50', '55', '60', '65', '70', '77.5', '85', '92.5', '100', '110', '125', '150', '175', '200', '250', '300', '400', '500'];

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'builder' | 'settings' | 'results'>('builder');
  
  // RFQ Form State
  const [rfqData, setRfqData] = useState<RFQRow>({
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    isStackable: false,
    accessorial: [],
    isReefer: false,
    lineItems: []
  });

  // Line Items State
  const [lineItems, setLineItems] = useState<LineItemData[]>([
    {
      id: 1,
      description: '',
      totalWeight: 1000,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      stackable: false
    }
  ]);

  // Selected accessorials
  const [selectedAccessorials, setSelectedAccessorials] = useState<string[]>([]);

  // Processing state
  const rfqProcessor = useRFQProcessor({ project44Client, freshxClient });
  const { pricingSettings, selectedCustomer, updatePricingSettings, updateSelectedCustomer } = usePricingSettings(initialPricingSettings);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update RFQ data when line items change
  useEffect(() => {
    const totalWeight = lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
    setRfqData(prev => ({
      ...prev,
      grossWeight: totalWeight,
      lineItems: lineItems.length > 0 ? lineItems : undefined,
      accessorial: selectedAccessorials
    }));
  }, [lineItems, selectedAccessorials]);

  // Initialize with selected customer
  useEffect(() => {
    if (initialSelectedCustomer) {
      updateSelectedCustomer(initialSelectedCustomer);
    }
  }, [initialSelectedCustomer, updateSelectedCustomer]);

  const handleRfqFieldChange = (field: keyof RFQRow, value: any) => {
    setRfqData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: keyof LineItemData, value: any) => {
    setLineItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id), 0) + 1;
    setLineItems(prev => [...prev, {
      id: newId,
      description: '',
      totalWeight: 500,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      stackable: false
    }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleAccessorialToggle = (code: string) => {
    setSelectedAccessorials(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const validateRFQ = (): boolean => {
    const errors: string[] = [];

    if (!rfqData.fromDate) errors.push('Pickup date is required');
    if (!rfqData.fromZip || !/^\d{5}$/.test(rfqData.fromZip)) errors.push('Valid origin ZIP code is required');
    if (!rfqData.toZip || !/^\d{5}$/.test(rfqData.toZip)) errors.push('Valid destination ZIP code is required');
    if (rfqData.pallets < 1) errors.push('At least 1 pallet is required');
    if (rfqData.grossWeight < 1) errors.push('Weight must be greater than 0');

    // Validate line items
    lineItems.forEach((item, index) => {
      if (!item.description.trim()) errors.push(`Item ${index + 1}: Description is required`);
      if (item.totalWeight <= 0) errors.push(`Item ${index + 1}: Weight must be greater than 0`);
      if (!item.freightClass) errors.push(`Item ${index + 1}: Freight class is required`);
      if (item.packageLength <= 0 || item.packageWidth <= 0 || item.packageHeight <= 0) {
        errors.push(`Item ${index + 1}: All dimensions must be greater than 0`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const processRFQ = async () => {
    if (!validateRFQ()) return;

    const selectedCarriers = { 'Default': true }; // Use default carrier selection
    
    try {
      await rfqProcessor.processSingleRFQ(rfqData, {
        selectedCarriers,
        pricingSettings,
        selectedCustomer
      });
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to process RFQ:', error);
    }
  };

  const renderBuilder = () => (
    <div className="space-y-8">
      {/* Core Shipment Information */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Core Shipment Information</h3>
              <p className="text-sm text-gray-600">Basic shipment details and routing control</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Pickup Date *
              </label>
              <input
                type="date"
                value={rfqData.fromDate}
                onChange={(e) => handleRfqFieldChange('fromDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Origin ZIP *
              </label>
              <input
                type="text"
                value={rfqData.fromZip}
                onChange={(e) => handleRfqFieldChange('fromZip', e.target.value)}
                placeholder="60607"
                maxLength={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                value={rfqData.toZip}
                onChange={(e) => handleRfqFieldChange('toZip', e.target.value)}
                placeholder="30033"
                maxLength={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pallets *
              </label>
              <input
                type="number"
                value={rfqData.pallets}
                onChange={(e) => handleRfqFieldChange('pallets', parseInt(e.target.value) || 1)}
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Weight (lbs) *
              </label>
              <input
                type="number"
                value={rfqData.grossWeight}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                title="Calculated from line items"
              />
              <p className="text-xs text-gray-500 mt-1">Auto-calculated from line items</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Brain className="inline h-4 w-4 mr-1" />
                Smart Routing Control *
              </label>
              <select
                value={rfqData.isReefer ? 'true' : 'false'}
                onChange={(e) => handleRfqFieldChange('isReefer', e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="false">Project44 Networks (LTL/VLTL)</option>
                <option value="true">FreshX Reefer Network</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {rfqData.isReefer ? 'Routes to FreshX for temperature-controlled shipping' : 'Routes to Project44 for standard/volume LTL'}
              </p>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rfqData.isStackable}
                  onChange={(e) => handleRfqFieldChange('isStackable', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Stackable Shipment</span>
              </label>
            </div>
            
            {rfqData.isReefer && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                  <select
                    value={rfqData.temperature || 'AMBIENT'}
                    onChange={(e) => handleRfqFieldChange('temperature', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TEMPERATURE_OPTIONS.map(temp => (
                      <option key={temp} value={temp}>{temp}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commodity</label>
                  <select
                    value={rfqData.commodity || 'FOODSTUFFS'}
                    onChange={(e) => handleRfqFieldChange('commodity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {COMMODITY_OPTIONS.map(commodity => (
                      <option key={commodity} value={commodity}>{commodity}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={rfqData.isFoodGrade || false}
                      onChange={(e) => handleRfqFieldChange('isFoodGrade', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Food Grade Required</span>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
                <p className="text-sm text-gray-600">Individual items with specific dimensions and freight classes</p>
              </div>
            </div>
            <button
              onClick={addLineItem}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Item</span>
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {lineItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-900">Item {index + 1}</h4>
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLineItem(index)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      placeholder="Electronics Equipment"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weight (lbs) *</label>
                    <input
                      type="number"
                      value={item.totalWeight}
                      onChange={(e) => handleLineItemChange(index, 'totalWeight', parseFloat(e.target.value) || 0)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Freight Class *</label>
                    <select
                      value={item.freightClass}
                      onChange={(e) => handleLineItemChange(index, 'freightClass', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      {FREIGHT_CLASSES.map(fc => (
                        <option key={fc} value={fc}>{fc}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Length (in) *</label>
                    <input
                      type="number"
                      value={item.packageLength}
                      onChange={(e) => handleLineItemChange(index, 'packageLength', parseFloat(e.target.value) || 0)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Width (in) *</label>
                    <input
                      type="number"
                      value={item.packageWidth}
                      onChange={(e) => handleLineItemChange(index, 'packageWidth', parseFloat(e.target.value) || 0)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Height (in) *</label>
                    <input
                      type="number"
                      value={item.packageHeight}
                      onChange={(e) => handleLineItemChange(index, 'packageHeight', parseFloat(e.target.value) || 0)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Package Type</label>
                    <select
                      value={item.packageType || 'PLT'}
                      onChange={(e) => handleLineItemChange(index, 'packageType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {PACKAGE_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Packages</label>
                    <input
                      type="number"
                      value={item.totalPackages || 1}
                      onChange={(e) => handleLineItemChange(index, 'totalPackages', parseInt(e.target.value) || 1)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Value ($)</label>
                    <input
                      type="number"
                      value={item.totalValue || ''}
                      onChange={(e) => handleLineItemChange(index, 'totalValue', parseFloat(e.target.value) || undefined)}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">NMFC Code</label>
                    <input
                      type="text"
                      value={item.nmfcItemCode || ''}
                      onChange={(e) => handleLineItemChange(index, 'nmfcItemCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2 mt-6">
                      <input
                        type="checkbox"
                        checked={item.stackable || false}
                        onChange={(e) => handleLineItemChange(index, 'stackable', e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Stackable</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessorial Services */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Accessorial Services</h3>
              <p className="text-sm text-gray-600">Additional services for pickup and delivery</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROJECT44_ACCESSORIALS.map(accessorial => (
              <label key={accessorial.code} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedAccessorials.includes(accessorial.code)}
                  onChange={() => handleAccessorialToggle(accessorial.code)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{accessorial.code}</div>
                  <div className="text-xs text-gray-600">{accessorial.label}</div>
                </div>
              </label>
            ))}
          </div>
          
          {selectedAccessorials.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-800 mb-2">
                Selected Services ({selectedAccessorials.length}):
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedAccessorials.map(code => (
                  <span key={code} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Process Button */}
      <div className="text-center">
        <button
          onClick={processRFQ}
          disabled={rfqProcessor.processingStatus.isProcessing}
          className={`inline-flex items-center space-x-3 px-8 py-4 font-bold rounded-xl transition-all duration-200 text-lg shadow-lg ${
            rfqProcessor.processingStatus.isProcessing 
              ? 'bg-gray-400 cursor-not-allowed text-white' 
              : 'bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 hover:from-blue-600 hover:via-purple-600 hover:to-green-600 text-white hover:shadow-xl transform hover:scale-105'
          }`}
        >
          {rfqProcessor.processingStatus.isProcessing ? (
            <>
              <Loader className="h-6 w-6 animate-spin" />
              <span>Processing Quote...</span>
            </>
          ) : (
            <>
              <Target className="h-6 w-6" />
              <span>Get Smart Quote</span>
              <Zap className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-8">
      <PricingSettingsComponent
        settings={pricingSettings}
        onSettingsChange={updatePricingSettings}
        selectedCustomer={selectedCustomer}
        onCustomerChange={updateSelectedCustomer}
        showAsCard={false}
      />
    </div>
  );

  const renderResults = () => (
    <div className="space-y-8">
      {rfqProcessor.processingStatus.isProcessing && (
        <ProcessingStatus
          total={1}
          completed={rfqProcessor.processingStatus.isProcessing ? 0 : 1}
          success={rfqProcessor.results.length > 0 && rfqProcessor.results[0].status === 'success' ? 1 : 0}
          errors={rfqProcessor.results.length > 0 && rfqProcessor.results[0].status === 'error' ? 1 : 0}
          isProcessing={rfqProcessor.processingStatus.isProcessing}
          currentCarrier={rfqProcessor.processingStatus.currentItem}
        />
      )}
      
      <ResultsTable
        results={rfqProcessor.results}
        onExport={() => {}}
        onPriceUpdate={(resultIndex, quoteId, newPrice) => 
          rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, { pricingSettings, selectedCustomer })
        }
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Unified RFQ Tool</h2>
              <p className="text-sm text-gray-600">Build and quote individual shipments with all template options</p>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="px-6 py-4">
          <nav className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'builder', label: 'RFQ Builder', icon: FileText },
              { id: 'settings', label: 'Pricing Settings', icon: Settings },
              { id: 'results', label: 'Results', icon: Target, badge: rfqProcessor.results.length }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      activeTab === tab.id 
                        ? 'bg-indigo-100 text-indigo-800' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'builder' && renderBuilder()}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'results' && renderResults()}
    </div>
  );
};