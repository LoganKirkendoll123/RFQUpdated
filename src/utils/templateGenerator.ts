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
    'totalLinearFeet',
    
    // Multi-item support - up to 5 items with different dimensions
    'item1_description',
    'item1_totalWeight',
    'item1_freightClass',
    'item1_packageLength',
    'item1_packageWidth',
    'item1_packageHeight',
    'item1_packageType',
    'item1_totalPackages',
    'item1_stackable',
    
    'item2_description',
    'item2_totalWeight',
    'item2_freightClass',
    'item2_packageLength',
    'item2_packageWidth',
    'item2_packageHeight',
    'item2_packageType',
    'item2_totalPackages',
    'item2_stackable',
    
    'item3_description',
    'item3_totalWeight',
    'item3_freightClass',
    'item3_packageLength',
    'item3_packageWidth',
    'item3_packageHeight',
    'item3_packageType',
    'item3_totalPackages',
    'item3_stackable',
    
    'item4_description',
    'item4_totalWeight',
    'item4_freightClass',
    'item4_packageLength',
    'item4_packageWidth',
    'item4_packageHeight',
    'item4_packageType',
    'item4_totalPackages',
    'item4_stackable',
    
    'item5_description',
    'item5_totalWeight',
    'item5_freightClass',
    'item5_packageLength',
    'item5_packageWidth',
    'item5_packageHeight',
    'item5_packageType',
    'item5_totalPackages',
    'item5_stackable'
  ];
  
  // Add each Project44 accessorial as its own column
  const accessorialHeaders = PROJECT44_ACCESSORIALS.map(acc => acc.code);
  const allHeaders = [...baseHeaders, ...accessorialHeaders];
  
  // Comprehensive sample data for testing all Project44 API capabilities with multi-item support
  const sampleData = [
    // Row 1: Standard LTL - Single item shipment
    [
      '2025-02-15', '60607', '30033', 3, 2500, false, false,
      'AMBIENT', '', false, '70', '', '', 'General Freight', '', 'PLT', 3, 3, 48, 40, 48, 'IN', 'LB', 5000, 0, '', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', 'Chicago', 'IL', 'US', '', 'Atlanta', 'GA', 'US',
      '', '', '', '', '', '', '', '',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      // Single item
      'Standard Pallets', 2500, '70', 48, 40, 48, 'PLT', 3, false,
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 2: Volume LTL - Multiple items with different dimensions
    [
      '2025-02-16', '90210', '10001', 12, 18000, true, false,
      'AMBIENT', '', false, '85', '123456', '01', 'Mixed Electronics', 'ELECTRONICS', 'PLT', 12, 24, 48, 40, 60, 'IN', 'LB', 25000, 2500, 'HTS123456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-17', '08:00', '17:00', '09:00', '16:00',
      '123 Main St', 'Beverly Hills', 'CA', 'US', '456 Broadway', 'New York', 'NY', 'US',
      'John Smith', '555-123-4567', 'john@company.com', 'Shipper Corp', 'Jane Doe', '555-987-6543', 'jane@receiver.com', 'Receiver Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 30,
      // Multiple items with different dimensions
      'Large Electronics', 8000, '85', 60, 48, 72, 'PLT', 5, true,
      'Small Components', 3000, '92.5', 36, 24, 36, 'BOX', 50, false,
      'Medium Equipment', 5000, '70', 48, 40, 60, 'CRATE', 3, true,
      'Accessories', 2000, '100', 24, 18, 24, 'CARTON', 20, true,
      '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'RESPU', 'RESDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 3: FreshX Reefer - Temperature-controlled with mixed items
    [
      '2025-02-17', '10001', '90210', 5, 4500, false, true,
      'CHILLED', 'FOODSTUFFS', true, '70', '654321', '02', 'Mixed Food Products', 'FOOD', 'CARTON', 50, 100, 24, 18, 12, 'IN', 'LB', 15000, 1500, 'FOOD789', 'US',
      true, '9', 'UN1234', 'II', 'Dangerous Goods Sample', 'Emergency Contact', '555-HELP-911', 'Emergency Corp',
      '2025-02-18', '06:00', '18:00', '07:00', '15:00',
      '789 Cold St', 'New York', 'NY', 'US', '321 Freeze Ave', 'Los Angeles', 'CA', 'US',
      'Cold Handler', '555-COLD-123', 'cold@shipper.com', 'Cold Chain Co', 'Freeze Receiver', '555-FREEZE-456', 'freeze@receiver.com', 'Frozen Foods Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 60, 0,
      // Mixed food items with different requirements
      'Dairy Products', 1500, '70', 48, 40, 36, 'PLT', 2, false,
      'Frozen Meat', 2000, '70', 36, 24, 48, 'CARTON', 20, true,
      'Fresh Produce', 1000, '70', 24, 18, 18, 'CRATE', 15, false,
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'LGDEL', 'NOTIFY', 'APPTPU', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 4: Construction materials with varying sizes
    [
      '2025-02-18', '77001', '30309', 8, 12000, true, false,
      'AMBIENT', '', false, '125', '789012', '03', 'Construction Materials', 'CONSTRUCTION', 'PLT', 8, 16, 48, 40, 72, 'IN', 'LB', 20000, 2000, 'CONST123', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-19', '07:00', '19:00', '06:00', '18:00',
      '1000 Construction Ave', 'Houston', 'TX', 'US', '2000 Builder Blvd', 'Atlanta', 'GA', 'US',
      'Build Manager', '555-BUILD-123', 'build@construction.com', 'Construction Co', 'Site Supervisor', '555-SITE-456', 'site@builder.com', 'Builder Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 40, 22,
      // Different construction materials
      'Steel Beams', 6000, '125', 120, 8, 8, 'PLT', 2, true,
      'Concrete Blocks', 4000, '150', 48, 40, 24, 'PLT', 3, true,
      'Insulation', 1000, '85', 96, 24, 12, 'ROLL', 10, false,
      'Hardware', 1000, '100', 24, 18, 18, 'BOX', 20, true,
      '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['SATPU', 'SATDEL', 'LTDDEL', 'CONPU', 'CONDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 5: High-value electronics with precise dimensions
    [
      '2025-02-19', '94102', '02101', 4, 3200, false, false,
      'AMBIENT', '', false, '50', '345678', '04', 'Precision Electronics', 'ELECTRONICS', 'BOX', 20, 40, 30, 24, 18, 'IN', 'LB', 100000, 10000, 'ELEC789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '500 Tech Way', 'San Francisco', 'CA', 'US', '100 Innovation Dr', 'Boston', 'MA', 'US',
      'Tech Shipper', '555-TECH-456', 'tech@silicon.com', 'Silicon Valley Tech', 'Innovation Receiver', '555-INNOV-789', 'receive@innovation.com', 'Innovation Labs',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      // Precision electronics with exact dimensions
      'Server Equipment', 1500, '50', 36, 24, 72, 'CRATE', 2, false,
      'Network Switches', 800, '60', 24, 18, 12, 'BOX', 8, true,
      'Cables & Accessories', 400, '70', 18, 12, 6, 'CARTON', 15, true,
      'Monitors', 500, '65', 30, 20, 8, 'BOX', 5, false,
      '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'RESDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ]
  ];
  
  // Create main worksheet
  const mainWsData = [allHeaders, ...sampleData];
  const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
  
  // Set column widths - base columns get normal width, item columns get medium width, accessorial columns get smaller width
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
    // Item columns (5 items × 9 fields each = 45 columns)
    ...Array(45).fill({ wch: 12 }),
    // All accessorial columns get smaller width
    ...PROJECT44_ACCESSORIALS.map(() => ({ wch: 8 }))
  ];
  
  mainWs['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, mainWs, 'RFQ Data');
  
  // Create multi-item instructions sheet
  const multiItemHeaders = ['Feature', 'Description', 'Example'];
  const multiItemData = [
    ['Multi-Item Support', 'Each shipment can contain up to 5 different items with unique dimensions', 'Electronics shipment with servers, switches, and cables'],
    ['Item Naming', 'Use pattern: item1_field, item2_field, etc.', 'item1_description, item1_totalWeight, item1_packageLength'],
    ['Required Fields', 'Each item needs: description, totalWeight, freightClass, dimensions', 'item1_totalWeight=1500, item1_freightClass=70'],
    ['Dimensions', 'Length, width, height in inches (or specified unit)', 'item1_packageLength=48, item1_packageWidth=40, item1_packageHeight=60'],
    ['Package Types', 'PLT, BOX, CRATE, CARTON, DRUM, etc.', 'item1_packageType=PLT, item2_packageType=BOX'],
    ['Stackable', 'TRUE/FALSE for each item individually', 'item1_stackable=TRUE, item2_stackable=FALSE'],
    ['Weight Distribution', 'Total shipment weight should equal sum of all items', 'grossWeight=5000 = item1_totalWeight(2000) + item2_totalWeight(3000)'],
    ['Freight Classes', 'Each item can have different freight class', 'item1_freightClass=70, item2_freightClass=85'],
    ['Empty Items', 'Leave item fields blank if not used', 'Only fill item1_ and item2_ fields for 2-item shipment'],
    ['Validation', 'System validates total weight matches item weights', 'Error if grossWeight ≠ sum of item weights']
  ];
  
  const multiItemWsData = [multiItemHeaders, ...multiItemData];
  const multiItemWs = XLSX.utils.aoa_to_sheet(multiItemWsData);
  multiItemWs['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 40 }];
  
  XLSX.utils.book_append_sheet(workbook, multiItemWs, 'Multi-Item Guide');
  
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
    ['item1_description', 'Description of first item', 'String', 'No', 'Electronics Equipment'],
    ['item1_totalWeight', 'Weight of first item', 'Number', 'No', '1500'],
    ['item1_freightClass', 'Freight class of first item', 'String', 'No', '70'],
    ['item1_packageLength', 'Length of first item (inches)', 'Number', 'No', '48'],
    ['item1_packageWidth', 'Width of first item (inches)', 'Number', 'No', '40'],
    ['item1_packageHeight', 'Height of first item (inches)', 'Number', 'No', '60'],
    ['item1_packageType', 'Package type of first item', 'String', 'No', 'PLT/BOX/CRATE'],
    ['item1_stackable', 'Can first item be stacked', 'Boolean', 'No', 'TRUE/FALSE'],
    ['item2_description', 'Description of second item', 'String', 'No', 'Small Components'],
    ['item2_totalWeight', 'Weight of second item', 'Number', 'No', '1000'],
    ['temperature', 'Temperature requirement', 'String', 'No', 'AMBIENT/CHILLED/FROZEN'],
    ['freightClass', 'Default freight class', 'String', 'No', '70/85/92.5/etc'],
    ['packageType', 'Default package type', 'String', 'No', 'PLT/BOX/CRATE/etc'],
    ['originCity', 'Origin city name', 'String', 'No', 'Chicago'],
    ['destinationCity', 'Destination city name', 'String', 'No', 'Atlanta'],
    ['pickupContactName', 'Pickup contact person', 'String', 'No', 'John Smith'],
    ['deliveryContactName', 'Delivery contact person', 'String', 'No', 'Jane Doe'],
    ['totalLinearFeet', 'Linear feet (for VLTL)', 'Integer', 'No', '30']
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
    ['Mixed Items', 'FALSE', 'AMBIENT', '5-15', '8,000-20,000', 'Project44 LTL or VLTL', 'Multiple items with different dimensions']
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
    `Column ${String.fromCharCode(75 + baseHeaders.length + 45 + index)}` // After all base headers + 45 item columns
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
    ['Multi-Item Dimensions Project44 API Template Instructions'],
    [''],
    ['🧠 SMART ROUTING WITH MULTI-ITEM SUPPORT'],
    ['This template supports shipments with multiple items having different dimensions:'],
    ['• isReefer = TRUE → Routes to FreshX reefer network'],
    ['• isReefer = FALSE → Routes to Project44 networks (LTL/VLTL based on size)'],
    ['• Each shipment can contain up to 5 different items with unique dimensions'],
    [''],
    ['📦 MULTI-ITEM CAPABILITIES:'],
    [''],
    ['Each shipment can contain multiple items with different:'],
    ['• Dimensions (length, width, height)'],
    ['• Weights and freight classes'],
    ['• Package types (PLT, BOX, CRATE, etc.)'],
    ['• Stackability requirements'],
    ['• Descriptions and commodity types'],
    [''],
    ['🏗️ ITEM FIELD STRUCTURE:'],
    [''],
    ['For each item (1-5), use these field patterns:'],
    ['• item1_description: "Electronics Equipment"'],
    ['• item1_totalWeight: 1500 (pounds)'],
    ['• item1_freightClass: "70"'],
    ['• item1_packageLength: 48 (inches)'],
    ['• item1_packageWidth: 40 (inches)'],
    ['• item1_packageHeight: 60 (inches)'],
    ['• item1_packageType: "PLT" (or BOX, CRATE, etc.)'],
    ['• item1_totalPackages: 2'],
    ['• item1_stackable: TRUE/FALSE'],
    [''],
    ['📋 REQUIRED FIELDS FOR EACH ITEM:'],
    ['• description: Brief description of the item'],
    ['• totalWeight: Weight in pounds (required)'],
    ['• freightClass: NMFC freight class (required)'],
    ['• packageLength: Length in inches (required)'],
    ['• packageWidth: Width in inches (required)'],
    ['• packageHeight: Height in inches (required)'],
    [''],
    ['🎯 OPTIONAL ITEM FIELDS:'],
    ['• packageType: PLT, BOX, CRATE, CARTON, DRUM, etc.'],
    ['• totalPackages: Number of packages for this item'],
    ['• stackable: Whether this specific item can be stacked'],
    ['• totalValue: Value for insurance purposes'],
    ['• nmfcItemCode: Specific NMFC code for this item'],
    ['• hazmat: TRUE if this item is hazardous'],
    [''],
    ['⚖️ WEIGHT VALIDATION:'],
    [''],
    ['The system validates that:'],
    ['• grossWeight = sum of all item weights'],
    ['• Each item has a valid weight > 0'],
    ['• Total weight is reasonable for the number of pallets'],
    [''],
    ['📊 EXAMPLE MULTI-ITEM SCENARIOS:'],
    [''],
    ['1. ELECTRONICS SHIPMENT:'],
    ['   • item1: Large servers (60"×48"×72", 8000 lbs, Class 85)'],
    ['   • item2: Small components (36"×24"×36", 3000 lbs, Class 92.5)'],
    ['   • item3: Accessories (24"×18"×24", 2000 lbs, Class 100)'],
    [''],
    ['2. CONSTRUCTION MATERIALS:'],
    ['   • item1: Steel beams (120"×8"×8", 6000 lbs, Class 125)'],
    ['   • item2: Concrete blocks (48"×40"×24", 4000 lbs, Class 150)'],
    ['   • item3: Hardware boxes (24"×18"×18", 1000 lbs, Class 100)'],
    [''],
    ['3. MIXED FOOD PRODUCTS:'],
    ['   • item1: Dairy pallets (48"×40"×36", 1500 lbs, Class 70)'],
    ['   • item2: Frozen meat (36"×24"×48", 2000 lbs, Class 70)'],
    ['   • item3: Fresh produce (24"×18"×18", 1000 lbs, Class 70)'],
    [''],
    ['🔄 PROCESSING WORKFLOW:'],
    ['1. Upload this comprehensive file to Smart Routing Processor'],
    ['2. System validates all fields and item dimensions'],
    ['3. Routes to FreshX (if isReefer=TRUE) or Project44 (if isReefer=FALSE)'],
    ['4. For Project44: Uses ALL item data for most accurate cubic calculations'],
    ['5. Each item contributes to total linear feet and cubic volume'],
    ['6. Returns detailed quotes with full Project44 API response data'],
    [''],
    ['💡 BEST PRACTICES FOR MULTI-ITEM SHIPMENTS:'],
    ['• Provide accurate dimensions for each item type'],
    ['• Use appropriate freight classes for each item'],
    ['• Specify stackability for each item individually'],
    ['• Include detailed descriptions for better handling'],
    ['• Ensure total weight equals sum of all item weights'],
    ['• Use consistent units (inches for dimensions, pounds for weight)'],
    [''],
    ['⚠️ IMPORTANT NOTES:'],
    ['• Leave unused item fields blank (e.g., if only 2 items, leave item3-5 blank)'],
    ['• Each item can have different freight classes and package types'],
    ['• System automatically calculates total cubic volume from all items'],
    ['• Linear feet calculation considers all item dimensions'],
    ['• Stackability is evaluated per item, not per shipment'],
    ['• Mixed freight classes may affect overall pricing'],
    [''],
    ['🎯 EXPECTED RESULTS:'],
    ['Each multi-item shipment will be processed with:'],
    ['• Accurate cubic calculations based on actual item dimensions'],
    ['• Proper freight class handling for mixed-class shipments'],
    ['• Optimized loading and space utilization'],
    ['• Detailed breakdown of charges per item when available'],
    ['• Enhanced carrier selection based on item-specific requirements'],
    ['• Improved transit time estimates considering all items']
  ];
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(workbook, instructionsWs, 'Instructions');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

export const downloadProject44ExcelTemplate = () => {
  console.log('Generating multi-item dimensions Project44 API Excel template...');
  const excelBuffer = generateUnifiedSmartTemplate();
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project44-multi-item-dimensions-template.xlsx';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log('Multi-item dimensions Project44 API template download initiated');
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