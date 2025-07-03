import * as XLSX from 'xlsx';
import { RFQRow } from '../types';

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
  { code: 'APPT', label: 'Delivery Appointment' },
  { code: 'APPTDEL', label: 'Delivery Appointment' },
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
  { code: 'LGDEL', label: 'Liftgate Delivery' },
  { code: 'LTDDEL', label: 'Limited Access Delivery' },
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
  { code: 'UNLOADDEL', label: 'Unload at Destination' },
  { code: 'UTLDEL', label: 'Utility Site Delivery' },
  { code: 'WEDEL', label: 'Weekend Delivery' }
];

export const generateUnifiedSmartTemplate = (): ArrayBuffer => {
  const workbook = XLSX.utils.book_new();
  
  // Create comprehensive headers including all Project44 API fields
  const baseHeaders = [
    // Core required fields
    'fromDate',
    'fromZip', 
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'isReefer',
    
    // Enhanced shipment details
    'temperature',
    'commodity',
    'isFoodGrade',
    'freightClass',
    'nmfcCode',
    'nmfcSubCode',
    'commodityDescription',
    'commodityType',
    'packageType',
    'totalPackages',
    'totalPieces',
    'packageLength',
    'packageWidth',
    'packageHeight',
    'lengthUnit',
    'weightUnit',
    'totalValue',
    'insuranceAmount',
    'harmonizedCode',
    'countryOfManufacture',
    
    // Hazmat information
    'hazmat',
    'hazmatClass',
    'hazmatIdNumber',
    'hazmatPackingGroup',
    'hazmatProperShippingName',
    'emergencyContactName',
    'emergencyContactPhone',
    'emergencyContactCompany',
    
    // Timing and delivery windows
    'deliveryDate',
    'deliveryStartTime',
    'deliveryEndTime',
    'pickupStartTime',
    'pickupEndTime',
    
    // Address details
    'originAddressLines',
    'originCity',
    'originState',
    'originCountry',
    'destinationAddressLines',
    'destinationCity',
    'destinationState',
    'destinationCountry',
    
    // Contact information
    'pickupContactName',
    'pickupContactPhone',
    'pickupContactEmail',
    'pickupCompanyName',
    'deliveryContactName',
    'deliveryContactPhone',
    'deliveryContactEmail',
    'deliveryCompanyName',
    
    // API configuration
    'preferredCurrency',
    'paymentTerms',
    'direction',
    'preferredSystemOfMeasurement',
    'allowUnacceptedAccessorials',
    'fetchAllGuaranteed',
    'fetchAllInsideDelivery',
    'fetchAllServiceLevels',
    'enableUnitConversion',
    'fallBackToDefaultAccountGroup',
    'apiTimeout',
    'totalLinearFeet'
  ];
  
  // Add each Project44 accessorial as its own column
  const accessorialHeaders = PROJECT44_ACCESSORIALS.map(acc => acc.code);
  const allHeaders = [...baseHeaders, ...accessorialHeaders];
  
  // Comprehensive sample data for testing all Project44 API capabilities
  const sampleData = [
    // Row 1: Standard LTL - Basic shipment with minimal data
    [
      '2025-02-15', '60607', '30033', 3, 2500, false, false,
      'AMBIENT', '', false, '70', '', '', 'General Freight', '', 'PLT', 3, 3, 48, 40, 48, 'IN', 'LB', 5000, 0, '', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', 'Chicago', 'IL', 'US', '', 'Atlanta', 'GA', 'US',
      '', '', '', '', '', '', '', '',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 2: Volume LTL - Large shipment with comprehensive data
    [
      '2025-02-16', '90210', '10001', 12, 18000, true, false,
      'AMBIENT', '', false, '85', '123456', '01', 'Electronics Equipment', 'ELECTRONICS', 'PLT', 12, 24, 48, 40, 60, 'IN', 'LB', 25000, 2500, 'HTS123456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-17', '08:00', '17:00', '09:00', '16:00',
      '123 Main St', 'Beverly Hills', 'CA', 'US', '456 Broadway', 'New York', 'NY', 'US',
      'John Smith', '555-123-4567', 'john@company.com', 'Shipper Corp', 'Jane Doe', '555-987-6543', 'jane@receiver.com', 'Receiver Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 30,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'RESPU', 'RESDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 3: FreshX Reefer - Temperature-controlled with hazmat
    [
      '2025-02-17', '10001', '90210', 5, 4500, false, true,
      'CHILLED', 'FOODSTUFFS', true, '70', '654321', '02', 'Refrigerated Food Products', 'FOOD', 'CARTON', 50, 100, 24, 18, 12, 'IN', 'LB', 15000, 1500, 'FOOD789', 'US',
      true, '9', 'UN1234', 'II', 'Dangerous Goods Sample', 'Emergency Contact', '555-HELP-911', 'Emergency Corp',
      '2025-02-18', '06:00', '18:00', '07:00', '15:00',
      '789 Cold St', 'New York', 'NY', 'US', '321 Freeze Ave', 'Los Angeles', 'CA', 'US',
      'Cold Handler', '555-COLD-123', 'cold@shipper.com', 'Cold Chain Co', 'Freeze Receiver', '555-FREEZE-456', 'freeze@receiver.com', 'Frozen Foods Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 60, 0,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'LGDEL', 'NOTIFY', 'APPTPU', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 4: International shipment with full address details
    [
      '2025-02-18', '77001', '30309', 8, 7200, true, false,
      'AMBIENT', '', false, '92.5', '789012', '03', 'Automotive Parts', 'AUTO_PARTS', 'CRATE', 8, 16, 60, 48, 36, 'IN', 'LB', 35000, 3500, 'AUTO456', 'MX',
      false, '', '', '', '', '', '', '',
      '2025-02-19', '10:00', '14:00', '08:00', '12:00',
      '100 Industrial Blvd;Suite 200', 'Houston', 'TX', 'US', '200 Peachtree St;Floor 5', 'Atlanta', 'GA', 'US',
      'Maria Rodriguez', '555-PARTS-123', 'maria@autoparts.com', 'Auto Parts Supplier', 'David Johnson', '555-RECEIVE-789', 'david@warehouse.com', 'Distribution Center',
      'CAD', 'THIRD_PARTY', 'THIRD_PARTY', 'METRIC', false, false, false, false, true, false, 25, 20,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'SATPU', 'SATDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 5: High-value shipment with insurance
    [
      '2025-02-19', '94102', '02101', 4, 3200, false, false,
      'AMBIENT', '', false, '50', '345678', '04', 'High Value Electronics', 'ELECTRONICS', 'BOX', 20, 40, 30, 24, 18, 'IN', 'LB', 100000, 10000, 'ELEC789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '500 Tech Way', 'San Francisco', 'CA', 'US', '100 Innovation Dr', 'Boston', 'MA', 'US',
      'Tech Shipper', '555-TECH-456', 'tech@silicon.com', 'Silicon Valley Tech', 'Innovation Receiver', '555-INNOV-789', 'receive@innovation.com', 'Innovation Labs',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'RESDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 6: Multi-accessorial complex shipment
    [
      '2025-02-20', '80202', '98101', 9, 12000, true, false,
      'AMBIENT', '', false, '125', '456789', '05', 'Construction Materials', 'CONSTRUCTION', 'PALLET', 9, 18, 48, 40, 72, 'IN', 'LB', 20000, 2000, 'CONST123', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-21', '07:00', '19:00', '06:00', '18:00',
      '1000 Construction Ave', 'Denver', 'CO', 'US', '2000 Builder Blvd', 'Seattle', 'WA', 'US',
      'Build Manager', '555-BUILD-123', 'build@construction.com', 'Construction Co', 'Site Supervisor', '555-SITE-456', 'site@builder.com', 'Builder Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 40, 22,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['SATPU', 'SATDEL', 'LTDDEL', 'CONPU', 'CONDEL', 'INPU', 'INDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 7: Large reefer shipment with all features
    [
      '2025-02-21', '30309', '60607', 15, 22000, true, true,
      'FROZEN', 'FROZEN_SEAFOOD', true, '70', '567890', '06', 'Frozen Seafood Products', 'SEAFOOD', 'PLT', 15, 30, 48, 40, 48, 'IN', 'LB', 50000, 5000, 'SEAFOOD456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-22', '05:00', '20:00', '04:00', '19:00',
      '3000 Seafood Port;Dock 5', 'Atlanta', 'GA', 'US', '4000 Fish Market St;Cold Storage', 'Chicago', 'IL', 'US',
      'Port Manager', '555-PORT-789', 'port@seafood.com', 'Seafood Port Co', 'Cold Storage Mgr', '555-COLD-012', 'cold@fishmarket.com', 'Fish Market Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 60, 36,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'LGPU', 'LGDEL', 'APPTPU', 'APPTDEL', 'PIERPU', 'PIERDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 8: Small precision shipment with special handling
    [
      '2025-02-22', '85001', '19101', 2, 1800, false, false,
      'AMBIENT', '', false, '60', '678901', '07', 'Precision Instruments', 'INSTRUMENTS', 'CRATE', 2, 4, 36, 24, 24, 'IN', 'LB', 75000, 7500, 'PREC789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '5000 Precision Way', 'Phoenix', 'AZ', 'US', '6000 Laboratory Dr', 'Philadelphia', 'PA', 'US',
      'Precision Tech', '555-PREC-345', 'precision@tech.com', 'Precision Technologies', 'Lab Coordinator', '555-LAB-678', 'lab@research.com', 'Research Lab',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 35, 0,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['RESDEL', 'LGDEL', 'APPTDEL', 'EDUPU', 'EDUDEL'].includes(acc.code) ? true : false
      )
    ]
  ];
  
  // Create main worksheet
  const mainWsData = [allHeaders, ...sampleData];
  const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
  
  // Set column widths - base columns get normal width, accessorial columns get smaller width
  const colWidths = [
    // Core fields
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    // Enhanced fields
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    // Hazmat fields
    { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    // Timing fields
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    // Address fields
    { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 8 },
    // Contact fields
    { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
    // API config fields
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
    // All accessorial columns get smaller width
    ...PROJECT44_ACCESSORIALS.map(() => ({ wch: 8 }))
  ];
  
  mainWs['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, mainWs, 'RFQ Data');
  
  // Create comprehensive field reference sheet
  const fieldHeaders = ['Field Name', 'Description', 'Type', 'Required', 'Example Values'];
  const fieldData = [
    ['fromDate', 'Pickup date', 'Date (YYYY-MM-DD)', 'Yes', '2025-02-15'],
    ['fromZip', 'Origin ZIP code', 'String (5 digits)', 'Yes', '60607'],
    ['toZip', 'Destination ZIP code', 'String (5 digits)', 'Yes', '30033'],
    ['pallets', 'Number of pallets', 'Integer', 'Yes', '3'],
    ['grossWeight', 'Total weight in pounds', 'Integer', 'Yes', '2500'],
    ['isStackable', 'Can pallets be stacked', 'Boolean', 'Yes', 'TRUE/FALSE'],
    ['isReefer', 'Route to FreshX reefer network', 'Boolean', 'Yes', 'TRUE/FALSE'],
    ['temperature', 'Temperature requirement', 'String', 'No', 'AMBIENT/CHILLED/FROZEN'],
    ['commodity', 'Commodity type', 'String', 'No', 'FOODSTUFFS/ICE_CREAM/etc'],
    ['freightClass', 'NMFC freight class', 'String', 'No', '70/85/92.5/etc'],
    ['nmfcCode', 'NMFC item code', 'String', 'No', '123456'],
    ['packageType', 'Type of packaging', 'String', 'No', 'PLT/BOX/CRATE/etc'],
    ['hazmat', 'Contains hazardous materials', 'Boolean', 'No', 'TRUE/FALSE'],
    ['hazmatClass', 'DOT hazard class', 'String', 'No', '9/3/etc'],
    ['totalValue', 'Shipment value for insurance', 'Number', 'No', '5000'],
    ['originCity', 'Origin city name', 'String', 'No', 'Chicago'],
    ['originState', 'Origin state abbreviation', 'String', 'No', 'IL'],
    ['destinationCity', 'Destination city name', 'String', 'No', 'Atlanta'],
    ['destinationState', 'Destination state abbreviation', 'String', 'No', 'GA'],
    ['pickupContactName', 'Pickup contact person', 'String', 'No', 'John Smith'],
    ['pickupContactPhone', 'Pickup contact phone', 'String', 'No', '555-123-4567'],
    ['deliveryContactName', 'Delivery contact person', 'String', 'No', 'Jane Doe'],
    ['deliveryContactPhone', 'Delivery contact phone', 'String', 'No', '555-987-6543'],
    ['preferredCurrency', 'Currency for quotes', 'String', 'No', 'USD/CAD/MXN'],
    ['paymentTerms', 'Payment responsibility', 'String', 'No', 'PREPAID/COLLECT/THIRD_PARTY'],
    ['totalLinearFeet', 'Linear feet (for VLTL)', 'Integer', 'No', '30'],
    ['apiTimeout', 'API timeout in seconds', 'Integer', 'No', '30']
  ];
  
  const fieldWsData = [fieldHeaders, ...fieldData];
  const fieldWs = XLSX.utils.aoa_to_sheet(fieldWsData);
  fieldWs['!cols'] = [
    { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 30 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, fieldWs, 'Field Reference');
  
  // Create smart routing guide sheet
  const routingHeaders = ['Scenario', 'isReefer', 'Temperature', 'Pallets', 'Weight (lbs)', 'Expected Routing', 'Reasoning'];
  const routingData = [
    ['Standard LTL', 'FALSE', 'AMBIENT or blank', '1-9', '1-14,999', 'Project44 Standard LTL only', 'Small dry goods shipments'],
    ['Volume LTL', 'FALSE', 'AMBIENT or blank', '10-25', '15,000+', 'Project44 Volume LTL only', 'Large dry goods shipments'],
    ['FreshX Reefer', 'TRUE', 'CHILLED or FROZEN', 'Any', 'Any', 'FreshX Reefer network', 'Temperature-controlled goods marked as reefer'],
    ['Project44 Standard', 'FALSE', 'CHILLED or FROZEN', 'Any', 'Any', 'Project44 Standard LTL', 'Temperature-controlled but not marked as reefer'],
    ['Mixed Opportunity', 'FALSE', 'AMBIENT', '8-15', '10,000-25,000', 'Both Standard + Volume LTL', 'Borderline cases test both modes']
  ];
  
  const routingWsData = [routingHeaders, ...routingData];
  const routingWs = XLSX.utils.aoa_to_sheet(routingWsData);
  
  // Set column widths for routing guide
  routingWs['!cols'] = [
    { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 30 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, routingWs, 'Smart Routing Guide');
  
  // Create accessorial reference sheet
  const project44AccessorialHeaders = ['Code', 'Description', 'Column Position'];
  const accessorialData = PROJECT44_ACCESSORIALS.map((acc, index) => [
    acc.code,
    acc.label,
    `Column ${String.fromCharCode(75 + baseHeaders.length + index)}` // After all base headers
  ]);
  
  const accessorialWsData = [project44AccessorialHeaders, ...accessorialData];
  const accessorialWs = XLSX.utils.aoa_to_sheet(accessorialWsData);
  
  // Set column widths for accessorial reference sheet
  accessorialWs['!cols'] = [
    { wch: 15 }, { wch: 40 }, { wch: 15 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, accessorialWs, 'Accessorial Reference');
  
  // Create comprehensive instructions sheet
  const instructionsData = [
    ['Comprehensive Project44 API Template Instructions'],
    [''],
    ['🧠 SMART ROUTING SYSTEM'],
    ['This template uses a single "isReefer" field to control routing:'],
    ['• isReefer = TRUE → Routes to FreshX reefer network'],
    ['• isReefer = FALSE → Routes to Project44 networks (LTL/VLTL based on size)'],
    [''],
    ['📊 COMPREHENSIVE PROJECT44 API SUPPORT:'],
    [''],
    ['This template includes ALL fields supported by the Project44 API:'],
    ['• Complete address information (street, city, state, country)'],
    ['• Detailed contact information (pickup and delivery contacts)'],
    ['• Comprehensive shipment details (dimensions, weight, class, NMFC)'],
    ['• Hazmat information (class, ID, packing group, emergency contact)'],
    ['• Timing windows (pickup and delivery time windows)'],
    ['• API configuration options (timeouts, service level preferences)'],
    ['• Insurance and valuation information'],
    ['• International shipping support (country codes, harmonized codes)'],
    ['• All 67 Project44 accessorial services as individual columns'],
    [''],
    ['📋 REQUIRED FIELDS:'],
    ['• fromDate: Pickup date (YYYY-MM-DD format)'],
    ['• fromZip/toZip: 5-digit US zip codes'],
    ['• pallets: Number of pallets (affects LTL vs VLTL classification)'],
    ['• grossWeight: Total weight in pounds (affects LTL vs VLTL classification)'],
    ['• isStackable: TRUE/FALSE for stackable pallets'],
    ['• isReefer: TRUE for FreshX reefer, FALSE for Project44 networks'],
    [''],
    ['🎯 OPTIONAL ENHANCED FIELDS:'],
    ['• Address Details: Full street addresses, cities, states, countries'],
    ['• Contact Information: Names, phones, emails for pickup/delivery'],
    ['• Shipment Details: Freight class, NMFC codes, package types'],
    ['• Dimensions: Length, width, height for accurate cubic calculations'],
    ['• Hazmat: Complete DOT hazmat information including emergency contacts'],
    ['• Timing: Specific pickup and delivery time windows'],
    ['• Valuation: Total value and insurance amounts'],
    ['• International: Country of manufacture, harmonized codes'],
    ['• API Config: Timeout settings, service level preferences'],
    [''],
    ['🔧 API CONFIGURATION OPTIONS:'],
    ['• allowUnacceptedAccessorials: Allow quotes even if carrier rejects some accessorials'],
    ['• fetchAllGuaranteed: Get all guaranteed service level options'],
    ['• fetchAllInsideDelivery: Get all inside delivery options'],
    ['• fetchAllServiceLevels: Get all available service levels'],
    ['• enableUnitConversion: Allow automatic unit conversions'],
    ['• fallBackToDefaultAccountGroup: Use default if account group invalid'],
    ['• apiTimeout: Request timeout in seconds (default: 30)'],
    [''],
    ['📦 PACKAGE AND SHIPMENT DETAILS:'],
    ['• packageType: PLT, BOX, CRATE, DRUM, etc.'],
    ['• packageLength/Width/Height: Dimensions in inches'],
    ['• totalPackages: Number of packages'],
    ['• totalPieces: Total piece count'],
    ['• freightClass: NMFC freight class (50, 70, 85, etc.)'],
    ['• nmfcCode: NMFC item code'],
    ['• commodityDescription: Detailed description'],
    ['• totalValue: For insurance calculations'],
    [''],
    ['☢️ HAZMAT INFORMATION:'],
    ['• hazmat: TRUE/FALSE if shipment contains hazardous materials'],
    ['• hazmatClass: DOT hazard class (1-9)'],
    ['• hazmatIdNumber: UN or NA identification number'],
    ['• hazmatPackingGroup: I, II, III, or NONE'],
    ['• hazmatProperShippingName: Official shipping name'],
    ['• emergencyContactName/Phone/Company: 24/7 emergency contact'],
    [''],
    ['🌍 INTERNATIONAL SHIPPING:'],
    ['• originCountry/destinationCountry: ISO country codes'],
    ['• countryOfManufacture: Where goods were manufactured'],
    ['• harmonizedCode: HS code for customs'],
    ['• preferredCurrency: USD, CAD, MXN, EUR'],
    [''],
    ['⏰ TIMING AND WINDOWS:'],
    ['• deliveryDate: Requested delivery date'],
    ['• pickupStartTime/EndTime: Pickup window (HH:MM format)'],
    ['• deliveryStartTime/EndTime: Delivery window (HH:MM format)'],
    [''],
    ['💰 PAYMENT AND BILLING:'],
    ['• paymentTerms: PREPAID, COLLECT, THIRD_PARTY'],
    ['• direction: SHIPPER, CONSIGNEE, THIRD_PARTY'],
    ['• preferredSystemOfMeasurement: METRIC or IMPERIAL'],
    [''],
    ['📞 CONTACT INFORMATION:'],
    ['• pickupContactName/Phone/Email/Company: Pickup location contact'],
    ['• deliveryContactName/Phone/Email/Company: Delivery location contact'],
    [''],
    ['📏 VOLUME LTL SPECIFIC:'],
    ['• totalLinearFeet: Required for VLTL quotes (auto-calculated if not provided)'],
    [''],
    ['🔄 PROCESSING WORKFLOW:'],
    ['1. Upload this comprehensive file to Smart Routing Processor'],
    ['2. System validates all fields and applies smart routing logic'],
    ['3. Routes to FreshX (if isReefer=TRUE) or Project44 (if isReefer=FALSE)'],
    ['4. For Project44: Uses ALL provided data for most accurate quotes'],
    ['5. Automatically determines LTL vs VLTL based on size/weight'],
    ['6. Returns detailed quotes with full Project44 API response data'],
    [''],
    ['💡 BEST PRACTICES:'],
    ['• Fill in as many fields as possible for most accurate quotes'],
    ['• Use complete addresses for better routing and pricing'],
    ['• Provide contact information for smoother shipment coordination'],
    ['• Include accurate dimensions for precise cubic calculations'],
    ['• Specify freight class and NMFC codes when known'],
    ['• Set appropriate API timeouts for your network conditions'],
    [''],
    ['⚠️ IMPORTANT NOTES:'],
    ['• The isReefer field is the primary routing control'],
    ['• More data = more accurate quotes and better service'],
    ['• All fields are optional except the core required fields'],
    ['• System will use sensible defaults for missing optional data'],
    ['• Hazmat shipments require complete hazmat information'],
    ['• International shipments need country and customs codes'],
    [''],
    ['🎯 EXPECTED RESULTS:'],
    ['Each shipment will be processed with maximum API data utilization:'],
    ['• isReefer=TRUE: FreshX reefer network with temperature controls'],
    ['• isReefer=FALSE: Project44 with full API feature utilization'],
    ['• Comprehensive quote details including all charges and fees'],
    ['• Accurate transit times based on complete shipment data'],
    ['• Detailed carrier information and service level options'],
    ['• Full accessorial service pricing and availability']
  ];
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(workbook, instructionsWs, 'Instructions');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

export const downloadProject44ExcelTemplate = () => {
  console.log('Generating comprehensive Project44 API Excel template...');
  const excelBuffer = generateUnifiedSmartTemplate();
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project44-comprehensive-api-template.xlsx';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log('Comprehensive Project44 API template download initiated');
};

// Legacy functions for backward compatibility
export const downloadFreshXExcelTemplate = downloadProject44ExcelTemplate;
export const downloadFreshXTemplate = downloadProject44ExcelTemplate;
export const downloadProject44Template = downloadProject44ExcelTemplate;
export const downloadTemplateFile = downloadProject44ExcelTemplate;

export const generateFreshXTemplateCSV = (): string => {
  const headers = [
    'fromDate',
    'fromZip',
    'toZip',
    'pallets',
    'grossWeight',
    'temperature',
    'commodity',
    'isFoodGrade',
    'isStackable',
    'isReefer',
    'accessorial'
  ];

  const sampleData = [
    {
      fromDate: '2025-02-15',
      fromZip: '60607',
      toZip: '30033',
      pallets: 2,
      grossWeight: 2000,
      temperature: 'CHILLED',
      commodity: 'FOODSTUFFS',
      isFoodGrade: true,
      isStackable: false,
      isReefer: true,
      accessorial: ['LIFTGATE_DROPOFF']
    },
    {
      fromDate: '2025-02-16',
      fromZip: '90210',
      toZip: '10001',
      pallets: 5,
      grossWeight: 5000,
      temperature: 'FROZEN',
      commodity: 'ICE_CREAM',
      isFoodGrade: true,
      isStackable: true,
      isReefer: true,
      accessorial: ['DRIVER_LOADING_PICKUP', 'INSIDE_DELIVERY_DROPOFF']
    },
    {
      fromDate: '2025-02-17',
      fromZip: '33101',
      toZip: '75201',
      pallets: 1,
      grossWeight: 800,
      temperature: 'AMBIENT',
      commodity: 'PRODUCE',
      isFoodGrade: false,
      isStackable: true,
      isReefer: false,
      accessorial: []
    }
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => [
      row.fromDate,
      row.fromZip,
      row.toZip,
      row.pallets,
      row.grossWeight,
      row.temperature,
      row.commodity,
      row.isFoodGrade,
      row.isStackable,
      row.isReefer,
      Array.isArray(row.accessorial) ? row.accessorial.join(';') : ''
    ].join(','))
  ].join('\n');

  return csvContent;
};

export const generateProject44TemplateCSV = (): string => {
  const headers = [
    'fromDate',
    'fromZip',
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'isReefer',
    'accessorial'
  ];

  const sampleData = [
    {
      fromDate: '2025-02-15',
      fromZip: '60607',
      toZip: '30033',
      pallets: 2,
      grossWeight: 2000,
      isStackable: false,
      isReefer: false,
      accessorial: ['LGDEL', 'APPTDEL']
    },
    {
      fromDate: '2025-02-16',
      fromZip: '90210',
      toZip: '10001',
      pallets: 5,
      grossWeight: 5000,
      isStackable: true,
      isReefer: false,
      accessorial: ['INPU', 'INDEL', 'RESPU']
    },
    {
      fromDate: '2025-02-17',
      fromZip: '33101',
      toZip: '75201',
      pallets: 1,
      grossWeight: 800,
      isStackable: true,
      isReefer: true,
      accessorial: ['LTDPU', 'SATDEL']
    },
    {
      fromDate: '2025-02-18',
      fromZip: '10001',
      toZip: '90210',
      pallets: 3,
      grossWeight: 3500,
      isStackable: false,
      isReefer: false,
      accessorial: ['LGPU', 'LGDEL', 'NOTIFY']
    }
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => [
      row.fromDate,
      row.fromZip,
      row.toZip,
      row.pallets,
      row.grossWeight,
      row.isStackable,
      row.isReefer,
      Array.isArray(row.accessorial) ? row.accessorial.join(';') : ''
    ].join(','))
  ].join('\n');

  return csvContent;
};