import React, { useState, useEffect } from 'react';
import { Zap, Plus, Trash2, Save, Play, Upload, Download, Settings, Package, Truck, MapPin, Calendar, Thermometer, Shield, User, Phone, Mail, Building2, Clock, DollarSign, Ruler, Copyright as Weight, AlertTriangle, CheckCircle, Info, Globe, CreditCard, FileText, Target, Layers } from 'lucide-react';
import { RFQRow, LineItemData, PricingSettings, Project44OAuthConfig } from '../types';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { PricingSettingsComponent } from './PricingSettings';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { downloadProject44ExcelTemplate } from '../utils/templateGenerator';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
}

// Project44 LTL/VLTL accessorial options - complete list from template
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

const TEMPERATURE_OPTIONS = [
  { value: 'AMBIENT', label: 'Ambient (Room Temperature)' },
  { value: 'CHILLED', label: 'Chilled (32-50°F)' },
  { value: 'FROZEN', label: 'Frozen (Below 32°F)' }
];

const COMMODITY_OPTIONS = [
  { value: 'ALCOHOL', label: 'Alcohol' },
  { value: 'FOODSTUFFS', label: 'Foodstuffs' },
  { value: 'FRESH_SEAFOOD', label: 'Fresh Seafood' },
  { value: 'FROZEN_SEAFOOD', label: 'Frozen Seafood' },
  { value: 'ICE_CREAM', label: 'Ice Cream' },
  { value: 'PRODUCE', label: 'Produce' }
];

const FREIGHT_CLASS_OPTIONS = [
  { value: '50', label: 'Class 50 - Very Dense' },
  { value: '55', label: 'Class 55' },
  { value: '60', label: 'Class 60' },
  { value: '65', label: 'Class 65' },
  { value: '70', label: 'Class 70 - Standard' },
  { value: '77.5', label: 'Class 77.5' },
  { value: '85', label: 'Class 85' },
  { value: '92.5', label: 'Class 92.5' },
  { value: '100', label: 'Class 100' },
  { value: '110', label: 'Class 110' },
  { value: '125', label: 'Class 125' },
  { value: '150', label: 'Class 150' },
  { value: '175', label: 'Class 175' },
  { value: '200', label: 'Class 200' },
  { value: '250', label: 'Class 250' },
  { value: '300', label: 'Class 300' },
  { value: '400', label: 'Class 400' },
  { value: '500', label: 'Class 500 - Very Light' }
];

const PACKAGE_TYPE_OPTIONS = [
  { value: 'PLT', label: 'Pallet (PLT)' },
  { value: 'BOX', label: 'Box' },
  { value: 'CRATE', label: 'Crate' },
  { value: 'CARTON', label: 'Carton' },
  { value: 'CASE', label: 'Case' },
  { value: 'DRUM', label: 'Drum' },
  { value: 'PAIL', label: 'Pail' },
  { value: 'BUNDLE', label: 'Bundle' },
  { value: 'COIL', label: 'Coil' },
  { value: 'CYLINDER', label: 'Cylinder' },
  { value: 'PIECES', label: 'Pieces' },
  { value: 'REEL', label: 'Reel' },
  { value: 'ROLL', label: 'Roll' },
  { value: 'SKID', label: 'Skid' },
  { value: 'TOTE', label: 'Tote' },
  { value: 'TUBE', label: 'Tube' }
];

const HAZMAT_PACKING_GROUPS = [
  { value: 'I', label: 'Packing Group I (High Danger)' },
  { value: 'II', label: 'Packing Group II (Medium Danger)' },
  { value: 'III', label: 'Packing Group III (Low Danger)' },
  { value: 'NONE', label: 'None' }
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'PREPAID', label: 'Prepaid' },
  { value: 'COLLECT', label: 'Collect' },
  { value: 'THIRD_PARTY', label: 'Third Party' }
];

const DIRECTION_OPTIONS = [
  { value: 'SHIPPER', label: 'Shipper' },
  { value: 'CONSIGNEE', label: 'Consignee' },
  { value: 'THIRD_PARTY', label: 'Third Party' }
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'MXN', label: 'Mexican Peso (MXN)' },
  { value: 'EUR', label: 'Euro (EUR)' }
];

const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' }
];

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // Core RFQ state
  const [rfq, setRfq] = useState<RFQRow>({
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

  // UI state
  const [activeSection, setActiveSection] = useState<'basic' | 'items' | 'addresses' | 'contacts' | 'hazmat' | 'timing' | 'api' | 'accessorials'>('basic');
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(initialPricingSettings);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialSelectedCustomer);
  const [selectedAccessorials, setSelectedAccessorials] = useState<{ [code: string]: boolean }>({});

  // Processing state
  const rfqProcessor = useRFQProcessor({ project44Client, freshxClient });

  // Update accessorial array when selections change
  useEffect(() => {
    const accessorialCodes = Object.entries(selectedAccessorials)
      .filter(([_, selected]) => selected)
      .map(([code, _]) => code);
    
    setRfq(prev => ({ ...prev, accessorial: accessorialCodes }));
  }, [selectedAccessorials]);

  // Calculate total weight from line items
  useEffect(() => {
    if (rfq.lineItems && rfq.lineItems.length > 0) {
      const totalWeight = rfq.lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
      setRfq(prev => ({ ...prev, grossWeight: totalWeight }));
    }
  }, [rfq.lineItems]);

  const handleInputChange = (field: keyof RFQRow, value: any) => {
    setRfq(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: keyof LineItemData, value: any) => {
    setRfq(prev => ({
      ...prev,
      lineItems: prev.lineItems?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ) || []
    }));
  };

  const addLineItem = () => {
    const newItem: LineItemData = {
      id: (rfq.lineItems?.length || 0) + 1,
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

    setRfq(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), newItem]
    }));
  };

  const removeLineItem = (index: number) => {
    setRfq(prev => ({
      ...prev,
      lineItems: prev.lineItems?.filter((_, i) => i !== index) || []
    }));
  };

  const processRFQ = async () => {
    try {
      const result = await rfqProcessor.processSingleRFQ(rfq, {
        selectedCarriers: {}, // Use all carriers for unified tool
        pricingSettings,
        selectedCustomer
      });
      console.log('RFQ processed:', result);
    } catch (error) {
      console.error('Failed to process RFQ:', error);
    }
  };

  const exportToTemplate = () => {
    downloadProject44ExcelTemplate();
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      {/* Smart Routing Control */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Target className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">Smart Routing Control</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
              <input
                type="radio"
                name="isReefer"
                checked={!rfq.isReefer}
                onChange={() => handleInputChange('isReefer', false)}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-900">Project44 Networks</div>
                <div className="text-sm text-gray-600">Standard LTL & Volume LTL carriers</div>
              </div>
            </label>
          </div>
          <div>
            <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-green-50 transition-colors">
              <input
                type="radio"
                name="isReefer"
                checked={rfq.isReefer}
                onChange={() => handleInputChange('isReefer', true)}
                className="h-4 w-4 text-green-600"
              />
              <div>
                <div className="font-medium text-gray-900">FreshX Reefer Network</div>
                <div className="text-sm text-gray-600">Temperature-controlled specialists</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Core Shipment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Pickup Date *
          </label>
          <input
            type="date"
            value={rfq.fromDate}
            onChange={(e) => handleInputChange('fromDate', e.target.value)}
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
            value={rfq.fromZip}
            onChange={(e) => handleInputChange('fromZip', e.target.value)}
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
            value={rfq.toZip}
            onChange={(e) => handleInputChange('toZip', e.target.value)}
            placeholder="30033"
            maxLength={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            value={rfq.pallets}
            onChange={(e) => handleInputChange('pallets', parseInt(e.target.value) || 1)}
            min="1"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Weight className="inline h-4 w-4 mr-1" />
            Total Weight (lbs) *
          </label>
          <input
            type="number"
            value={rfq.grossWeight}
            onChange={(e) => handleInputChange('grossWeight', parseInt(e.target.value) || 1000)}
            min="1"
            max="100000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          {rfq.lineItems && rfq.lineItems.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Auto-calculated from line items: {rfq.lineItems.reduce((sum, item) => sum + item.totalWeight, 0)} lbs
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center space-x-2 mt-6">
            <input
              type="checkbox"
              checked={rfq.isStackable}
              onChange={(e) => handleInputChange('isStackable', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Stackable</span>
          </label>
        </div>
      </div>

      {/* Temperature & Commodity (for reefer shipments) */}
      {rfq.isReefer && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            <Thermometer className="inline h-5 w-5 mr-2" />
            Reefer Requirements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
              <select
                value={rfq.temperature || 'AMBIENT'}
                onChange={(e) => handleInputChange('temperature', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {TEMPERATURE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Commodity</label>
              <select
                value={rfq.commodity || ''}
                onChange={(e) => handleInputChange('commodity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select commodity...</option>
                {COMMODITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center space-x-2 mt-6">
                <input
                  type="checkbox"
                  checked={rfq.isFoodGrade || false}
                  onChange={(e) => handleInputChange('isFoodGrade', e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Food Grade</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Freight Classification */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Freight Class</label>
          <select
            value={rfq.freightClass || '70'}
            onChange={(e) => handleInputChange('freightClass', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {FREIGHT_CLASS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">NMFC Code</label>
          <input
            type="text"
            value={rfq.nmfcCode || ''}
            onChange={(e) => handleInputChange('nmfcCode', e.target.value)}
            placeholder="123456"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Package Type</label>
          <select
            value={rfq.packageType || 'PLT'}
            onChange={(e) => handleInputChange('packageType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {PACKAGE_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Total Packages</label>
          <input
            type="number"
            value={rfq.totalPackages || rfq.pallets}
            onChange={(e) => handleInputChange('totalPackages', parseInt(e.target.value) || 1)}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Commodity Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FileText className="inline h-4 w-4 mr-1" />
          Commodity Description
        </label>
        <textarea
          value={rfq.commodityDescription || ''}
          onChange={(e) => handleInputChange('commodityDescription', e.target.value)}
          placeholder="Describe the goods being shipped..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Value & Insurance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="inline h-4 w-4 mr-1" />
            Total Value ($)
          </label>
          <input
            type="number"
            value={rfq.totalValue || ''}
            onChange={(e) => handleInputChange('totalValue', parseFloat(e.target.value) || undefined)}
            min="0"
            step="0.01"
            placeholder="5000.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Shield className="inline h-4 w-4 mr-1" />
            Insurance Amount ($)
          </label>
          <input
            type="number"
            value={rfq.insuranceAmount || ''}
            onChange={(e) => handleInputChange('insuranceAmount', parseFloat(e.target.value) || undefined)}
            min="0"
            step="0.01"
            placeholder="1000.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderLineItems = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            <Layers className="inline h-5 w-5 mr-2" />
            Line Items
          </h3>
          <p className="text-sm text-gray-600">Define individual items with specific dimensions and properties</p>
        </div>
        <button
          onClick={addLineItem}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Item</span>
        </button>
      </div>

      {rfq.lineItems && rfq.lineItems.length > 0 ? (
        <div className="space-y-4">
          {rfq.lineItems.map((item, index) => (
            <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-gray-900">Item {index + 1}</h4>
                <button
                  onClick={() => removeLineItem(index)}
                  className="text-red-600 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                    placeholder="Electronics Equipment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight (lbs) *</label>
                  <input
                    type="number"
                    value={item.totalWeight}
                    onChange={(e) => handleLineItemChange(index, 'totalWeight', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Freight Class *</label>
                  <select
                    value={item.freightClass}
                    onChange={(e) => handleLineItemChange(index, 'freightClass', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {FREIGHT_CLASS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Length (in) *</label>
                  <input
                    type="number"
                    value={item.packageLength}
                    onChange={(e) => handleLineItemChange(index, 'packageLength', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Width (in) *</label>
                  <input
                    type="number"
                    value={item.packageWidth}
                    onChange={(e) => handleLineItemChange(index, 'packageWidth', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Height (in) *</label>
                  <input
                    type="number"
                    value={item.packageHeight}
                    onChange={(e) => handleLineItemChange(index, 'packageHeight', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Package Type</label>
                  <select
                    value={item.packageType || 'PLT'}
                    onChange={(e) => handleLineItemChange(index, 'packageType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PACKAGE_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Value ($)</label>
                  <input
                    type="number"
                    value={item.totalValue || ''}
                    onChange={(e) => handleLineItemChange(index, 'totalValue', parseFloat(e.target.value) || undefined)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-4 mt-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={item.stackable || false}
                      onChange={(e) => handleLineItemChange(index, 'stackable', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Stackable</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Line Items</h3>
          <p className="text-gray-600 mb-4">Add line items to specify individual item dimensions and properties</p>
          <button
            onClick={addLineItem}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Item</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderAddresses = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        <MapPin className="inline h-5 w-5 mr-2" />
        Address Information
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Origin Address */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-blue-900 mb-4">Origin Address</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address Lines</label>
              <textarea
                value={rfq.originAddressLines?.join('\n') || ''}
                onChange={(e) => handleInputChange('originAddressLines', e.target.value.split('\n').filter(Boolean))}
                placeholder="123 Main Street&#10;Suite 100"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={rfq.originCity || ''}
                  onChange={(e) => handleInputChange('originCity', e.target.value)}
                  placeholder="Chicago"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={rfq.originState || ''}
                  onChange={(e) => handleInputChange('originState', e.target.value)}
                  placeholder="IL"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <select
                value={rfq.originCountry || 'US'}
                onChange={(e) => handleInputChange('originCountry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {COUNTRY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Destination Address */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-green-900 mb-4">Destination Address</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address Lines</label>
              <textarea
                value={rfq.destinationAddressLines?.join('\n') || ''}
                onChange={(e) => handleInputChange('destinationAddressLines', e.target.value.split('\n').filter(Boolean))}
                placeholder="456 Oak Avenue&#10;Building B"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={rfq.destinationCity || ''}
                  onChange={(e) => handleInputChange('destinationCity', e.target.value)}
                  placeholder="Atlanta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={rfq.destinationState || ''}
                  onChange={(e) => handleInputChange('destinationState', e.target.value)}
                  placeholder="GA"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <select
                value={rfq.destinationCountry || 'US'}
                onChange={(e) => handleInputChange('destinationCountry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {COUNTRY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContacts = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        <User className="inline h-5 w-5 mr-2" />
        Contact Information
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pickup Contact */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-blue-900 mb-4">Pickup Contact</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="inline h-4 w-4 mr-1" />
                Company Name
              </label>
              <input
                type="text"
                value={rfq.pickupCompanyName || ''}
                onChange={(e) => handleInputChange('pickupCompanyName', e.target.value)}
                placeholder="Shipper Company Inc"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Contact Name
              </label>
              <input
                type="text"
                value={rfq.pickupContactName || ''}
                onChange={(e) => handleInputChange('pickupContactName', e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                value={rfq.pickupContactPhone || ''}
                onChange={(e) => handleInputChange('pickupContactPhone', e.target.value)}
                placeholder="555-123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email Address
              </label>
              <input
                type="email"
                value={rfq.pickupContactEmail || ''}
                onChange={(e) => handleInputChange('pickupContactEmail', e.target.value)}
                placeholder="john@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Delivery Contact */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-green-900 mb-4">Delivery Contact</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="inline h-4 w-4 mr-1" />
                Company Name
              </label>
              <input
                type="text"
                value={rfq.deliveryCompanyName || ''}
                onChange={(e) => handleInputChange('deliveryCompanyName', e.target.value)}
                placeholder="Receiver Company Inc"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Contact Name
              </label>
              <input
                type="text"
                value={rfq.deliveryContactName || ''}
                onChange={(e) => handleInputChange('deliveryContactName', e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                value={rfq.deliveryContactPhone || ''}
                onChange={(e) => handleInputChange('deliveryContactPhone', e.target.value)}
                placeholder="555-987-6543"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email Address
              </label>
              <input
                type="email"
                value={rfq.deliveryContactEmail || ''}
                onChange={(e) => handleInputChange('deliveryContactEmail', e.target.value)}
                placeholder="jane@receiver.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHazmat = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900">Hazardous Materials</h3>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            checked={rfq.hazmat || false}
            onChange={(e) => handleInputChange('hazmat', e.target.checked)}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
          />
          <label className="text-sm font-medium text-gray-700">This shipment contains hazardous materials</label>
        </div>

        {rfq.hazmat && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hazard Class</label>
                <input
                  type="text"
                  value={rfq.hazmatClass || ''}
                  onChange={(e) => handleInputChange('hazmatClass', e.target.value)}
                  placeholder="9"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UN ID Number</label>
                <input
                  type="text"
                  value={rfq.hazmatIdNumber || ''}
                  onChange={(e) => handleInputChange('hazmatIdNumber', e.target.value)}
                  placeholder="UN1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Packing Group</label>
              <select
                value={rfq.hazmatPackingGroup || 'III'}
                onChange={(e) => handleInputChange('hazmatPackingGroup', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {HAZMAT_PACKING_GROUPS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proper Shipping Name</label>
              <input
                type="text"
                value={rfq.hazmatProperShippingName || ''}
                onChange={(e) => handleInputChange('hazmatProperShippingName', e.target.value)}
                placeholder="Dangerous Goods, N.O.S."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Emergency Contact */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-md font-semibold text-red-900 mb-3">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={rfq.emergencyContactName || ''}
                    onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                    placeholder="Emergency Contact"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={rfq.emergencyContactPhone || ''}
                    onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                    placeholder="555-HELP-911"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <input
                    type="text"
                    value={rfq.emergencyContactCompany || ''}
                    onChange={(e) => handleInputChange('emergencyContactCompany', e.target.value)}
                    placeholder="Emergency Response Corp"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTiming = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        <Clock className="inline h-5 w-5 mr-2" />
        Timing & Delivery Windows
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pickup Window */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-blue-900 mb-4">Pickup Window</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={rfq.pickupStartTime || ''}
                  onChange={(e) => handleInputChange('pickupStartTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={rfq.pickupEndTime || ''}
                  onChange={(e) => handleInputChange('pickupEndTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Window */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-green-900 mb-4">Delivery Window</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date</label>
              <input
                type="date"
                value={rfq.deliveryDate || ''}
                onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={rfq.deliveryStartTime || ''}
                  onChange={(e) => handleInputChange('deliveryStartTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={rfq.deliveryEndTime || ''}
                  onChange={(e) => handleInputChange('deliveryEndTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderApiSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        <Settings className="inline h-5 w-5 mr-2" />
        API Configuration
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Payment & Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <CreditCard className="inline h-4 w-4 mr-1" />
            Payment Terms
          </label>
          <select
            value={rfq.paymentTerms || 'PREPAID'}
            onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {PAYMENT_TERMS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
          <select
            value={rfq.direction || 'SHIPPER'}
            onChange={(e) => handleInputChange('direction', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {DIRECTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Globe className="inline h-4 w-4 mr-1" />
            Currency
          </label>
          <select
            value={rfq.preferredCurrency || 'USD'}
            onChange={(e) => handleInputChange('preferredCurrency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {CURRENCY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Units */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Ruler className="inline h-4 w-4 mr-1" />
            Length Unit
          </label>
          <select
            value={rfq.lengthUnit || 'IN'}
            onChange={(e) => handleInputChange('lengthUnit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="IN">Inches</option>
            <option value="CM">Centimeters</option>
            <option value="FT">Feet</option>
            <option value="M">Meters</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Weight className="inline h-4 w-4 mr-1" />
            Weight Unit
          </label>
          <select
            value={rfq.weightUnit || 'LB'}
            onChange={(e) => handleInputChange('weightUnit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="LB">Pounds</option>
            <option value="KG">Kilograms</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">System of Measurement</label>
          <select
            value={rfq.preferredSystemOfMeasurement || 'IMPERIAL'}
            onChange={(e) => handleInputChange('preferredSystemOfMeasurement', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="IMPERIAL">Imperial</option>
            <option value="METRIC">Metric</option>
          </select>
        </div>

        {/* API Timeout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">API Timeout (seconds)</label>
          <input
            type="number"
            value={rfq.apiTimeout || 30}
            onChange={(e) => handleInputChange('apiTimeout', parseInt(e.target.value) || 30)}
            min="10"
            max="120"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Linear Feet (for VLTL) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Total Linear Feet</label>
          <input
            type="number"
            value={rfq.totalLinearFeet || ''}
            onChange={(e) => handleInputChange('totalLinearFeet', parseInt(e.target.value) || undefined)}
            min="0"
            placeholder="Auto-calculated"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="text-xs text-gray-500 mt-1">Leave blank for auto-calculation</div>
        </div>
      </div>

      {/* API Configuration Checkboxes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">API Configuration Options</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={rfq.allowUnacceptedAccessorials ?? true}
              onChange={(e) => handleInputChange('allowUnacceptedAccessorials', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Allow Unaccepted Accessorials</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={rfq.fetchAllGuaranteed ?? true}
              onChange={(e) => handleInputChange('fetchAllGuaranteed', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Fetch All Guaranteed</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={rfq.fetchAllInsideDelivery ?? true}
              onChange={(e) => handleInputChange('fetchAllInsideDelivery', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Fetch All Inside Delivery</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={rfq.fetchAllServiceLevels ?? true}
              onChange={(e) => handleInputChange('fetchAllServiceLevels', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Fetch All Service Levels</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={rfq.enableUnitConversion ?? true}
              onChange={(e) => handleInputChange('enableUnitConversion', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Enable Unit Conversion</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={rfq.fallBackToDefaultAccountGroup ?? true}
              onChange={(e) => handleInputChange('fallBackToDefaultAccountGroup', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Fallback to Default Account Group</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderAccessorials = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            <Truck className="inline h-5 w-5 mr-2" />
            Accessorial Services
          </h3>
          <p className="text-sm text-gray-600">Select additional services required for this shipment</p>
        </div>
        <div className="text-sm text-gray-500">
          {Object.values(selectedAccessorials).filter(Boolean).length} selected
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PROJECT44_ACCESSORIALS.map((accessorial) => (
          <label
            key={accessorial.code}
            className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedAccessorials[accessorial.code] || false}
              onChange={(e) => setSelectedAccessorials(prev => ({
                ...prev,
                [accessorial.code]: e.target.checked
              }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{accessorial.code}</div>
              <div className="text-xs text-gray-600">{accessorial.label}</div>
            </div>
          </label>
        ))}
      </div>

      {Object.values(selectedAccessorials).filter(Boolean).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Selected Accessorials:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedAccessorials)
              .filter(([_, selected]) => selected)
              .map(([code, _]) => {
                const accessorial = PROJECT44_ACCESSORIALS.find(a => a.code === code);
                return (
                  <span
                    key={code}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {code}
                  </span>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: Package },
    { id: 'items', label: 'Line Items', icon: Layers },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'contacts', label: 'Contacts', icon: User },
    { id: 'hazmat', label: 'Hazmat', icon: AlertTriangle },
    { id: 'timing', label: 'Timing', icon: Clock },
    { id: 'api', label: 'API Settings', icon: Settings },
    { id: 'accessorials', label: 'Accessorials', icon: Truck }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center space-x-3">
              <Zap className="h-6 w-6 text-blue-600" />
              <span>Unified RFQ Tool</span>
            </h2>
            <p className="text-gray-600 mt-1">Build comprehensive RFQs with all template options</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToTemplate}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download Template</span>
            </button>
            <button
              onClick={processRFQ}
              disabled={rfqProcessor.processingStatus.isProcessing}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {rfqProcessor.processingStatus.isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Process RFQ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeSection === section.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeSection === 'basic' && renderBasicInfo()}
          {activeSection === 'items' && renderLineItems()}
          {activeSection === 'addresses' && renderAddresses()}
          {activeSection === 'contacts' && renderContacts()}
          {activeSection === 'hazmat' && renderHazmat()}
          {activeSection === 'timing' && renderTiming()}
          {activeSection === 'api' && renderApiSettings()}
          {activeSection === 'accessorials' && renderAccessorials()}
        </div>
      </div>

      {/* Pricing Settings */}
      <PricingSettingsComponent
        settings={pricingSettings}
        onSettingsChange={setPricingSettings}
        selectedCustomer={selectedCustomer}
        onCustomerChange={setSelectedCustomer}
        showAsCard={true}
      />

      {/* Processing Status */}
      {(rfqProcessor.processingStatus.isProcessing || rfqProcessor.results.length > 0) && (
        <ProcessingStatus
          total={1}
          completed={rfqProcessor.processingStatus.isProcessing ? 0 : 1}
          success={rfqProcessor.results.filter(r => r.status === 'success').length}
          errors={rfqProcessor.results.filter(r => r.status === 'error').length}
          isProcessing={rfqProcessor.processingStatus.isProcessing}
          currentCarrier={rfqProcessor.processingStatus.currentItem}
        />
      )}

      {/* Results */}
      {rfqProcessor.results.length > 0 && (
        <ResultsTable
          results={rfqProcessor.results}
          onExport={() => {}}
          onPriceUpdate={(resultIndex, quoteId, newPrice) => 
            rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, { pricingSettings, selectedCustomer })
          }
        />
      )}
    </div>
  );
};