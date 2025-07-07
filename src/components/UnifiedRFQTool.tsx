import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Edit3, 
  Play, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Loader, 
  Plus, 
  Minus, 
  Settings,
  Users,
  DollarSign,
  Truck,
  Package,
  MapPin,
  Calendar,
  Clock,
  Thermometer,
  Shield,
  Building2,
  Phone,
  Mail,
  User,
  Globe,
  CreditCard,
  Zap,
  Target,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow, PricingSettings, LineItemData } from '../types';
import { parseCSV, parseXLSX } from '../utils/fileParser';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { PricingSettingsComponent } from './PricingSettings';
import { CarrierSelection } from './CarrierSelection';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { ApiKeyInput } from './ApiKeyInput';
import { TemplateDownload } from './TemplateDownload';
import { 
  saveSelectedCarriers,
  loadSelectedCarriers,
  savePricingSettings,
  loadPricingSettings
} from '../utils/credentialStorage';
import * as XLSX from 'xlsx';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
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

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [fileError, setFileError] = useState<string>('');
  
  // Manual entry state with all template fields
  const [manualRFQ, setManualRFQ] = useState<RFQRow>({
    fromDate: '',
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    isStackable: false,
    accessorial: [],
    isReefer: false,
    
    // Enhanced shipment details
    temperature: undefined,
    commodity: undefined,
    isFoodGrade: false,
    freightClass: '70',
    nmfcCode: '',
    nmfcSubCode: '',
    commodityDescription: '',
    commodityType: '',
    packageType: 'PLT',
    totalPackages: undefined,
    totalPieces: undefined,
    lengthUnit: 'IN',
    weightUnit: 'LB',
    totalValue: undefined,
    insuranceAmount: undefined,
    harmonizedCode: '',
    countryOfManufacture: 'US',
    
    // Hazmat information
    hazmat: false,
    hazmatClass: '',
    hazmatIdNumber: '',
    hazmatPackingGroup: 'III',
    hazmatProperShippingName: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactCompany: '',
    
    // Timing and delivery windows
    deliveryDate: '',
    deliveryStartTime: '',
    deliveryEndTime: '',
    pickupStartTime: '',
    pickupEndTime: '',
    
    // Address details
    originAddressLines: [],
    originCity: '',
    originState: '',
    originCountry: 'US',
    destinationAddressLines: [],
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
    preferredCurrency: 'USD',
    paymentTerms: 'PREPAID',
    direction: 'SHIPPER',
    preferredSystemOfMeasurement: 'IMPERIAL',
    allowUnacceptedAccessorials: true,
    fetchAllGuaranteed: true,
    fetchAllInsideDelivery: true,
    fetchAllServiceLevels: true,
    enableUnitConversion: true,
    fallBackToDefaultAccountGroup: true,
    apiTimeout: 30,
    totalLinearFeet: undefined,
    
    // Line items for multi-item support
    lineItems: []
  });

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    shipmentDetails: false,
    lineItems: false,
    hazmat: false,
    timing: false,
    addresses: false,
    contacts: false,
    apiConfig: false,
    accessorials: false
  });

  const [selectedAccessorials, setSelectedAccessorials] = useState<Set<string>>(new Set());
  
  // Pricing and carrier management
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(initialPricingSettings);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialSelectedCustomer);
  
  // Use hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const rfqProcessor = useRFQProcessor({ project44Client, freshxClient });

  // Load saved data
  useEffect(() => {
    const savedCarriers = loadSelectedCarriers();
    if (savedCarriers) {
      carrierManagement.setSelectedCarriers(savedCarriers);
    }
    
    const savedPricing = loadPricingSettings();
    if (savedPricing) {
      setPricingSettings(savedPricing);
    }
  }, []);

  // Auto-load carriers when client becomes available
  useEffect(() => {
    if (project44Client && !carrierManagement.carriersLoaded && !carrierManagement.isLoadingCarriers) {
      carrierManagement.loadCarriers();
    }
  }, [project44Client, carrierManagement.carriersLoaded, carrierManagement.isLoadingCarriers]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFileSelect = async (file: File) => {
    setFileError('');
    try {
      console.log('📁 Processing file:', file.name);
      let data: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        data = await parseCSV(file, true);
      } else {
        data = await parseXLSX(file, true);
      }
      
      setRfqData(data);
      console.log(`✅ Parsed ${data.length} RFQ rows`);
      rfqProcessor.clearResults();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      console.error('❌ File parsing error:', error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFileSelect(acceptedFiles[0]);
      }
    },
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleManualRFQChange = (field: keyof RFQRow, value: any) => {
    setManualRFQ(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAccessorialToggle = (code: string) => {
    const newSelected = new Set(selectedAccessorials);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedAccessorials(newSelected);
    
    // Update manual RFQ accessorial array
    setManualRFQ(prev => ({
      ...prev,
      accessorial: Array.from(newSelected)
    }));
  };

  const addLineItem = () => {
    const newItem: LineItemData = {
      id: (manualRFQ.lineItems?.length || 0) + 1,
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
    
    setManualRFQ(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), newItem]
    }));
  };

  const removeLineItem = (index: number) => {
    setManualRFQ(prev => ({
      ...prev,
      lineItems: prev.lineItems?.filter((_, i) => i !== index) || []
    }));
  };

  const updateLineItem = (index: number, field: keyof LineItemData, value: any) => {
    setManualRFQ(prev => ({
      ...prev,
      lineItems: prev.lineItems?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ) || []
    }));
  };

  const processManualRFQ = async () => {
    // Validate required fields
    if (!manualRFQ.fromDate || !manualRFQ.fromZip || !manualRFQ.toZip) {
      setFileError('Please fill in all required fields (Date, Origin ZIP, Destination ZIP)');
      return;
    }

    // Convert manual RFQ to array and process
    setRfqData([manualRFQ]);
    
    const selectedCarrierIds = Object.entries(carrierManagement.selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setFileError('Please select at least one carrier');
      return;
    }

    await rfqProcessor.processMultipleRFQs([manualRFQ], {
      selectedCarriers: carrierManagement.selectedCarriers,
      pricingSettings,
      selectedCustomer
    });
  };

  const processFileRFQs = async () => {
    if (rfqData.length === 0) return;
    
    const selectedCarrierIds = Object.entries(carrierManagement.selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    if (selectedCarrierIds.length === 0) {
      setFileError('Please select at least one carrier');
      return;
    }

    await rfqProcessor.processMultipleRFQs(rfqData, {
      selectedCarriers: carrierManagement.selectedCarriers,
      pricingSettings,
      selectedCustomer
    });
  };

  const exportResults = () => {
    if (rfqProcessor.results.length === 0) return;

    const exportData = rfqProcessor.results.flatMap(result => {
      return result.quotes.map(quote => {
        const quoteWithPricing = quote as any;
        
        return {
          'RFQ Number': result.rowIndex + 1,
          'Origin ZIP': result.originalData.fromZip,
          'Destination ZIP': result.originalData.toZip,
          'Pallets': result.originalData.pallets,
          'Weight (lbs)': result.originalData.grossWeight,
          'Pickup Date': result.originalData.fromDate,
          'Carrier Name': quote.carrier.name,
          'Service Level': quote.serviceLevel?.description || '',
          'Transit Days': quote.transitDays || '',
          'Carrier Rate': quoteWithPricing.carrierTotalRate || 0,
          'Customer Price': quoteWithPricing.customerPrice || 0,
          'Profit Margin': quoteWithPricing.profit || 0,
          'Processing Status': result.status.toUpperCase()
        };
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Results');
    
    const fileName = `rfq-results-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const renderSectionHeader = (
    title: string, 
    section: keyof typeof expandedSections, 
    icon: React.ComponentType<any>,
    required: boolean = false
  ) => {
    const Icon = icon;
    const isExpanded = expandedSections[section];
    
    return (
      <button
        onClick={() => toggleSection(section)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-lg hover:from-slate-100 hover:to-blue-100 transition-all duration-200"
      >
        <div className="flex items-center space-x-3">
          <Icon className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-slate-900">{title}</span>
          {required && <span className="text-red-500 text-sm">*</span>}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-600" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {/* API Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Project44 Integration</h3>
                <p className="text-sm text-slate-600">Enterprise LTL & Volume LTL Network</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ApiKeyInput
              value={project44Client ? 'configured' : ''}
              onChange={() => {}}
              onValidation={() => {}}
              onOAuthConfigChange={() => {}}
              isProject44={true}
            />
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Thermometer className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">FreshX Integration</h3>
                <p className="text-sm text-slate-600">Specialized Reefer Network (Optional)</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ApiKeyInput
              value={freshxClient ? 'configured' : ''}
              onChange={() => {}}
              onValidation={() => {}}
              placeholder="Enter your FreshX API key"
            />
          </div>
        </div>
      </div>

      {/* Template Download */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Smart Quoting Template</h3>
              <p className="text-sm text-slate-600">Download comprehensive Excel template</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <TemplateDownload isProject44={true} />
        </div>
      </div>

      {/* Carrier Selection */}
      {project44Client && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Carrier Network</h3>
                <p className="text-sm text-slate-600">Select your preferred carriers</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <CarrierSelection
              carrierGroups={carrierManagement.carrierGroups}
              selectedCarriers={carrierManagement.selectedCarriers}
              onToggleCarrier={carrierManagement.handleCarrierToggle}
              onSelectAll={carrierManagement.handleSelectAll}
              onSelectAllInGroup={carrierManagement.handleSelectAllInGroup}
              isLoading={carrierManagement.isLoadingCarriers}
            />
          </div>
        </div>
      )}

      {/* Pricing Settings */}
      <PricingSettingsComponent
        settings={pricingSettings}
        onSettingsChange={setPricingSettings}
        selectedCustomer={selectedCustomer}
        onCustomerChange={setSelectedCustomer}
      />

      {/* Mode Selection */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">RFQ Input Method</h3>
              <p className="text-sm text-slate-600">Choose how to input your shipment data</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setMode('upload')}
              className={`flex items-center space-x-3 px-6 py-4 rounded-xl font-medium transition-all duration-200 ${
                mode === 'upload'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Upload className="h-5 w-5" />
              <span>File Upload</span>
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center space-x-3 px-6 py-4 rounded-xl font-medium transition-all duration-200 ${
                mode === 'manual'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Edit3 className="h-5 w-5" />
              <span>Manual Entry</span>
            </button>
          </div>

          {mode === 'upload' ? (
            <div className="space-y-6">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                  ${isDragActive 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }
                  ${fileError ? 'border-red-300 bg-red-50' : ''}
                `}
              >
                <input {...getInputProps()} />
                
                <div className="flex flex-col items-center space-y-4">
                  {isDragActive ? (
                    <Upload className="h-12 w-12 text-blue-500" />
                  ) : (
                    <FileText className="h-12 w-12 text-gray-400" />
                  )}
                  
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      {isDragActive ? 'Drop your file here' : 'Upload RFQ Data File'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Drag and drop or click to select CSV or XLSX files
                    </p>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    Supported formats: .csv, .xlsx, .xls
                  </div>
                </div>
              </div>
              
              {fileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">{fileError}</div>
                </div>
              )}

              {rfqData.length > 0 && (
                <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center space-x-3 text-emerald-800">
                    <div className="bg-emerald-500 rounded-full p-2">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">
                        {rfqData.length} shipment{rfqData.length !== 1 ? 's' : ''} ready for processing
                      </div>
                      <div className="text-sm text-emerald-700 mt-1">
                        Click "Process RFQs" to get quotes from selected carriers
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rfqData.length > 0 && Object.values(carrierManagement.selectedCarriers).some(v => v) && (
                <div className="text-center">
                  <button
                    onClick={processFileRFQs}
                    disabled={rfqProcessor.processingStatus.isProcessing}
                    className={`inline-flex items-center space-x-3 px-8 py-4 font-bold rounded-xl transition-all duration-200 text-lg shadow-lg ${
                      rfqProcessor.processingStatus.isProcessing 
                        ? 'bg-slate-400 cursor-not-allowed text-white' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    {rfqProcessor.processingStatus.isProcessing ? (
                      <>
                        <Loader className="h-6 w-6 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-6 w-6" />
                        <span>Process {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                {renderSectionHeader('Basic Information', 'basic', Package, true)}
                
                {expandedSections.basic && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pickup Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={manualRFQ.fromDate}
                          onChange={(e) => handleManualRFQChange('fromDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Origin ZIP <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualRFQ.fromZip}
                          onChange={(e) => handleManualRFQChange('fromZip', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="60607"
                          maxLength={5}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Destination ZIP <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualRFQ.toZip}
                          onChange={(e) => handleManualRFQChange('toZip', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="30033"
                          maxLength={5}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pallets <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={manualRFQ.pallets}
                          onChange={(e) => handleManualRFQChange('pallets', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="1"
                          max="100"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gross Weight (lbs) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={manualRFQ.grossWeight}
                          onChange={(e) => handleManualRFQChange('grossWeight', parseInt(e.target.value) || 1000)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="1"
                          max="100000"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Smart Routing Control <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={manualRFQ.isReefer ? 'true' : 'false'}
                          onChange={(e) => handleManualRFQChange('isReefer', e.target.value === 'true')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="false">Project44 Networks (LTL/VLTL)</option>
                          <option value="true">FreshX Reefer Network</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isStackable"
                          checked={manualRFQ.isStackable}
                          onChange={(e) => handleManualRFQChange('isStackable', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isStackable" className="text-sm font-medium text-gray-700">
                          Stackable
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipment Details */}
              <div className="space-y-4">
                {renderSectionHeader('Shipment Details', 'shipmentDetails', Info)}
                
                {expandedSections.shipmentDetails && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                        <select
                          value={manualRFQ.temperature || ''}
                          onChange={(e) => handleManualRFQChange('temperature', e.target.value || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">AMBIENT</option>
                          <option value="CHILLED">CHILLED</option>
                          <option value="FROZEN">FROZEN</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Commodity</label>
                        <select
                          value={manualRFQ.commodity || ''}
                          onChange={(e) => handleManualRFQChange('commodity', e.target.value || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select commodity...</option>
                          <option value="ALCOHOL">ALCOHOL</option>
                          <option value="FOODSTUFFS">FOODSTUFFS</option>
                          <option value="FRESH_SEAFOOD">FRESH_SEAFOOD</option>
                          <option value="FROZEN_SEAFOOD">FROZEN_SEAFOOD</option>
                          <option value="ICE_CREAM">ICE_CREAM</option>
                          <option value="PRODUCE">PRODUCE</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Freight Class</label>
                        <input
                          type="text"
                          value={manualRFQ.freightClass || ''}
                          onChange={(e) => handleManualRFQChange('freightClass', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="70"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">NMFC Code</label>
                        <input
                          type="text"
                          value={manualRFQ.nmfcCode || ''}
                          onChange={(e) => handleManualRFQChange('nmfcCode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="123456"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Package Type</label>
                        <select
                          value={manualRFQ.packageType || 'PLT'}
                          onChange={(e) => handleManualRFQChange('packageType', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="PLT">Pallet (PLT)</option>
                          <option value="BOX">Box</option>
                          <option value="CRATE">Crate</option>
                          <option value="CARTON">Carton</option>
                          <option value="DRUM">Drum</option>
                          <option value="PIECES">Pieces</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Commodity Description</label>
                      <textarea
                        value={manualRFQ.commodityDescription || ''}
                        onChange={(e) => handleManualRFQChange('commodityDescription', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                        placeholder="Describe the goods being shipped..."
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isFoodGrade"
                        checked={manualRFQ.isFoodGrade || false}
                        onChange={(e) => handleManualRFQChange('isFoodGrade', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isFoodGrade" className="text-sm font-medium text-gray-700">
                        Food Grade
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                {renderSectionHeader('Line Items (Multi-Item Support)', 'lineItems', Package)}
                
                {expandedSections.lineItems && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Add multiple items with different dimensions and freight classes
                      </p>
                      <button
                        onClick={addLineItem}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Item</span>
                      </button>
                    </div>
                    
                    {manualRFQ.lineItems?.map((item, index) => (
                      <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900">Item {index + 1}</h4>
                          <button
                            onClick={() => removeLineItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Item description"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                            <input
                              type="number"
                              value={item.totalWeight}
                              onChange={(e) => updateLineItem(index, 'totalWeight', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
                            <input
                              type="text"
                              value={item.freightClass}
                              onChange={(e) => updateLineItem(index, 'freightClass', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="70"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Package Type</label>
                            <select
                              value={item.packageType || 'PLT'}
                              onChange={(e) => updateLineItem(index, 'packageType', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="PLT">Pallet</option>
                              <option value="BOX">Box</option>
                              <option value="CRATE">Crate</option>
                              <option value="CARTON">Carton</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Length (in)</label>
                            <input
                              type="number"
                              value={item.packageLength}
                              onChange={(e) => updateLineItem(index, 'packageLength', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Width (in)</label>
                            <input
                              type="number"
                              value={item.packageWidth}
                              onChange={(e) => updateLineItem(index, 'packageWidth', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                            <input
                              type="number"
                              value={item.packageHeight}
                              onChange={(e) => updateLineItem(index, 'packageHeight', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-4">
                          <input
                            type="checkbox"
                            id={`stackable-${index}`}
                            checked={item.stackable || false}
                            onChange={(e) => updateLineItem(index, 'stackable', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`stackable-${index}`} className="text-sm font-medium text-gray-700">
                            Stackable
                          </label>
                        </div>
                      </div>
                    ))}
                    
                    {(!manualRFQ.lineItems || manualRFQ.lineItems.length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No line items added. Click "Add Item" to specify individual items with different dimensions.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hazmat Information */}
              <div className="space-y-4">
                {renderSectionHeader('Hazmat Information', 'hazmat', Shield)}
                
                {expandedSections.hazmat && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hazmat"
                        checked={manualRFQ.hazmat || false}
                        onChange={(e) => handleManualRFQChange('hazmat', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hazmat" className="text-sm font-medium text-gray-700">
                        Hazardous Materials
                      </label>
                    </div>
                    
                    {manualRFQ.hazmat && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Hazmat Class</label>
                          <input
                            type="text"
                            value={manualRFQ.hazmatClass || ''}
                            onChange={(e) => handleManualRFQChange('hazmatClass', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="9"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
                          <input
                            type="text"
                            value={manualRFQ.hazmatIdNumber || ''}
                            onChange={(e) => handleManualRFQChange('hazmatIdNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="UN1234"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Packing Group</label>
                          <select
                            value={manualRFQ.hazmatPackingGroup || 'III'}
                            onChange={(e) => handleManualRFQChange('hazmatPackingGroup', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="I">I</option>
                            <option value="II">II</option>
                            <option value="III">III</option>
                            <option value="NONE">NONE</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Proper Shipping Name</label>
                          <input
                            type="text"
                            value={manualRFQ.hazmatProperShippingName || ''}
                            onChange={(e) => handleManualRFQChange('hazmatProperShippingName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Dangerous Goods"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Emergency Contact</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input
                              type="text"
                              value={manualRFQ.emergencyContactName || ''}
                              onChange={(e) => handleManualRFQChange('emergencyContactName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Contact Name"
                            />
                            <input
                              type="tel"
                              value={manualRFQ.emergencyContactPhone || ''}
                              onChange={(e) => handleManualRFQChange('emergencyContactPhone', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Phone Number"
                            />
                            <input
                              type="text"
                              value={manualRFQ.emergencyContactCompany || ''}
                              onChange={(e) => handleManualRFQChange('emergencyContactCompany', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Company Name"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Timing and Delivery Windows */}
              <div className="space-y-4">
                {renderSectionHeader('Timing & Delivery Windows', 'timing', Clock)}
                
                {expandedSections.timing && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date</label>
                        <input
                          type="date"
                          value={manualRFQ.deliveryDate || ''}
                          onChange={(e) => handleManualRFQChange('deliveryDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Start Time</label>
                        <input
                          type="time"
                          value={manualRFQ.deliveryStartTime || ''}
                          onChange={(e) => handleManualRFQChange('deliveryStartTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery End Time</label>
                        <input
                          type="time"
                          value={manualRFQ.deliveryEndTime || ''}
                          onChange={(e) => handleManualRFQChange('deliveryEndTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Start Time</label>
                        <input
                          type="time"
                          value={manualRFQ.pickupStartTime || ''}
                          onChange={(e) => handleManualRFQChange('pickupStartTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pickup End Time</label>
                        <input
                          type="time"
                          value={manualRFQ.pickupEndTime || ''}
                          onChange={(e) => handleManualRFQChange('pickupEndTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Address Details */}
              <div className="space-y-4">
                {renderSectionHeader('Address Details', 'addresses', MapPin)}
                
                {expandedSections.addresses && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-4">Origin Address</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                          <input
                            type="text"
                            value={manualRFQ.originCity || ''}
                            onChange={(e) => handleManualRFQChange('originCity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Chicago"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                          <input
                            type="text"
                            value={manualRFQ.originState || ''}
                            onChange={(e) => handleManualRFQChange('originState', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="IL"
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-4">Destination Address</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                          <input
                            type="text"
                            value={manualRFQ.destinationCity || ''}
                            onChange={(e) => handleManualRFQChange('destinationCity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Atlanta"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                          <input
                            type="text"
                            value={manualRFQ.destinationState || ''}
                            onChange={(e) => handleManualRFQChange('destinationState', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="GA"
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                {renderSectionHeader('Contact Information', 'contacts', User)}
                
                {expandedSections.contacts && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-4">Pickup Contact</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                          <input
                            type="text"
                            value={manualRFQ.pickupContactName || ''}
                            onChange={(e) => handleManualRFQChange('pickupContactName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="John Smith"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                          <input
                            type="tel"
                            value={manualRFQ.pickupContactPhone || ''}
                            onChange={(e) => handleManualRFQChange('pickupContactPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="555-123-4567"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                          <input
                            type="email"
                            value={manualRFQ.pickupContactEmail || ''}
                            onChange={(e) => handleManualRFQChange('pickupContactEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="john@company.com"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                          <input
                            type="text"
                            value={manualRFQ.pickupCompanyName || ''}
                            onChange={(e) => handleManualRFQChange('pickupCompanyName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Shipper Corp"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-4">Delivery Contact</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                          <input
                            type="text"
                            value={manualRFQ.deliveryContactName || ''}
                            onChange={(e) => handleManualRFQChange('deliveryContactName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Jane Doe"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                          <input
                            type="tel"
                            value={manualRFQ.deliveryContactPhone || ''}
                            onChange={(e) => handleManualRFQChange('deliveryContactPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="555-987-6543"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                          <input
                            type="email"
                            value={manualRFQ.deliveryContactEmail || ''}
                            onChange={(e) => handleManualRFQChange('deliveryContactEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="jane@receiver.com"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                          <input
                            type="text"
                            value={manualRFQ.deliveryCompanyName || ''}
                            onChange={(e) => handleManualRFQChange('deliveryCompanyName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Receiver Inc"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* API Configuration */}
              <div className="space-y-4">
                {renderSectionHeader('API Configuration', 'apiConfig', Settings)}
                
                {expandedSections.apiConfig && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Currency</label>
                        <select
                          value={manualRFQ.preferredCurrency || 'USD'}
                          onChange={(e) => handleManualRFQChange('preferredCurrency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="USD">USD</option>
                          <option value="CAD">CAD</option>
                          <option value="MXN">MXN</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                        <select
                          value={manualRFQ.paymentTerms || 'PREPAID'}
                          onChange={(e) => handleManualRFQChange('paymentTerms', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="PREPAID">PREPAID</option>
                          <option value="COLLECT">COLLECT</option>
                          <option value="THIRD_PARTY">THIRD_PARTY</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
                        <select
                          value={manualRFQ.direction || 'SHIPPER'}
                          onChange={(e) => handleManualRFQChange('direction', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="SHIPPER">SHIPPER</option>
                          <option value="CONSIGNEE">CONSIGNEE</option>
                          <option value="THIRD_PARTY">THIRD_PARTY</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">API Timeout (seconds)</label>
                        <input
                          type="number"
                          value={manualRFQ.apiTimeout || 30}
                          onChange={(e) => handleManualRFQChange('apiTimeout', parseInt(e.target.value) || 30)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="10"
                          max="120"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total Linear Feet</label>
                        <input
                          type="number"
                          value={manualRFQ.totalLinearFeet || ''}
                          onChange={(e) => handleManualRFQChange('totalLinearFeet', parseInt(e.target.value) || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                          placeholder="Auto-calculated if empty"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">API Options</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="allowUnacceptedAccessorials"
                            checked={manualRFQ.allowUnacceptedAccessorials || false}
                            onChange={(e) => handleManualRFQChange('allowUnacceptedAccessorials', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="allowUnacceptedAccessorials" className="text-sm text-gray-700">
                            Allow Unaccepted Accessorials
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="fetchAllGuaranteed"
                            checked={manualRFQ.fetchAllGuaranteed || false}
                            onChange={(e) => handleManualRFQChange('fetchAllGuaranteed', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="fetchAllGuaranteed" className="text-sm text-gray-700">
                            Fetch All Guaranteed
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="fetchAllServiceLevels"
                            checked={manualRFQ.fetchAllServiceLevels || false}
                            onChange={(e) => handleManualRFQChange('fetchAllServiceLevels', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="fetchAllServiceLevels" className="text-sm text-gray-700">
                            Fetch All Service Levels
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="enableUnitConversion"
                            checked={manualRFQ.enableUnitConversion || false}
                            onChange={(e) => handleManualRFQChange('enableUnitConversion', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="enableUnitConversion" className="text-sm text-gray-700">
                            Enable Unit Conversion
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accessorial Services */}
              <div className="space-y-4">
                {renderSectionHeader('Accessorial Services', 'accessorials', Zap)}
                
                {expandedSections.accessorials && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <p className="text-sm text-gray-600 mb-4">
                      Select additional services required for this shipment
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                      {PROJECT44_ACCESSORIALS.map((accessorial) => (
                        <div key={accessorial.code} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={accessorial.code}
                            checked={selectedAccessorials.has(accessorial.code)}
                            onChange={() => handleAccessorialToggle(accessorial.code)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={accessorial.code} className="text-sm text-gray-700 cursor-pointer">
                            <span className="font-mono text-xs text-blue-600">{accessorial.code}</span>
                            <span className="ml-2">{accessorial.label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    {selectedAccessorials.size > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">
                          Selected: {Array.from(selectedAccessorials).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {fileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">{fileError}</div>
                </div>
              )}

              {Object.values(carrierManagement.selectedCarriers).some(v => v) && (
                <div className="text-center">
                  <button
                    onClick={processManualRFQ}
                    disabled={rfqProcessor.processingStatus.isProcessing}
                    className={`inline-flex items-center space-x-3 px-8 py-4 font-bold rounded-xl transition-all duration-200 text-lg shadow-lg ${
                      rfqProcessor.processingStatus.isProcessing 
                        ? 'bg-slate-400 cursor-not-allowed text-white' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    {rfqProcessor.processingStatus.isProcessing ? (
                      <>
                        <Loader className="h-6 w-6 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-6 w-6" />
                        <span>Process Manual RFQ</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {(rfqProcessor.processingStatus.isProcessing || rfqProcessor.results.length > 0) && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-pink-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Processing Status</h3>
                <p className="text-sm text-slate-600">Real-time quote processing and analysis</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ProcessingStatus
              total={rfqProcessor.processingStatus.totalSteps}
              completed={rfqProcessor.processingStatus.currentStep}
              success={rfqProcessor.results.filter(r => r.status === 'success').length}
              errors={rfqProcessor.results.filter(r => r.status === 'error').length}
              isProcessing={rfqProcessor.processingStatus.isProcessing}
              currentCarrier={rfqProcessor.processingStatus.currentItem}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {rfqProcessor.results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Quote Results</h3>
                <p className="text-sm text-slate-600">Competitive pricing analysis</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResultsTable
              results={rfqProcessor.results}
              onExport={exportResults}
              onPriceUpdate={(resultIndex, quoteId, newPrice) => 
                rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, { pricingSettings, selectedCustomer })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};