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
  
  // Create the main data sheet with individual accessorial columns
  const baseHeaders = [
    'fromDate',
    'fromZip', 
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'temperature',
    'commodity',
    'isFoodGrade',
    'isReefer'  // New field to explicitly mark reefer shipments
  ];
  
  // Add each Project44 accessorial as its own column
  const accessorialHeaders = PROJECT44_ACCESSORIALS.map(acc => acc.code);
  const allHeaders = [...baseHeaders, ...accessorialHeaders];
  
  // Comprehensive sample data for testing smart routing
  const sampleData = [
    // Row 1: Standard LTL - Small dry goods shipment
    [
      '2025-02-15', '60607', '30033', 3, 2500, false, 'AMBIENT', '', false, false,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 2: Volume LTL - Large dry goods shipment (triggers VLTL)
    [
      '2025-02-16', '90210', '10001', 12, 18000, true, 'AMBIENT', '', false, false,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'RESPU', 'RESDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 3: FreshX Reefer - Chilled food shipment (marked as reefer)
    [
      '2025-02-17', '10001', '90210', 5, 4500, false, 'CHILLED', 'FOODSTUFFS', true, true,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'LGDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 4: FreshX Reefer - Frozen food shipment (marked as reefer)
    [
      '2025-02-18', '77001', '30309', 8, 7200, true, 'FROZEN', 'ICE_CREAM', true, true,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'APPTPU', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 5: Project44 Standard LTL - Temperature-controlled but not reefer (isReefer = false)
    [
      '2025-02-19', '94102', '02101', 4, 3200, false, 'CHILLED', '', false, false,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'RESDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 6: Multi-mode opportunity - Medium shipment (could be Standard or Volume)
    [
      '2025-02-20', '80202', '98101', 9, 12000, true, 'AMBIENT', '', false, false,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['SATPU', 'SATDEL', 'LTDDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 7: Large reefer shipment (marked as reefer)
    [
      '2025-02-21', '30309', '60607', 15, 22000, true, 'FROZEN', 'FROZEN_SEAFOOD', true, true,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'LGPU', 'LGDEL', 'APPTPU', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // Row 8: Small reefer shipment (marked as reefer)
    [
      '2025-02-22', '85001', '19101', 2, 1800, false, 'CHILLED', 'PRODUCE', false, true,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['RESDEL', 'LGDEL'].includes(acc.code) ? true : false
      )
    ]
  ];
  
  // Create main worksheet
  const mainWsData = [allHeaders, ...sampleData];
  const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
  
  // Set column widths - base columns get normal width, accessorial columns get smaller width
  const colWidths = [
    { wch: 12 }, // fromDate
    { wch: 10 }, // fromZip
    { wch: 10 }, // toZip
    { wch: 8 },  // pallets
    { wch: 12 }, // grossWeight
    { wch: 12 }, // isStackable
    { wch: 12 }, // temperature
    { wch: 15 }, // commodity
    { wch: 12 }, // isFoodGrade
    { wch: 10 }, // isReefer
    // All accessorial columns get smaller width
    ...PROJECT44_ACCESSORIALS.map(() => ({ wch: 8 }))
  ];
  
  mainWs['!cols'] = colWidths;
  
  // Add data validation for all boolean columns and dropdowns
  for (let row = 1; row <= sampleData.length; row++) {
    // isStackable column (column F)
    const stackableCellRef = XLSX.utils.encode_cell({ r: row, c: 5 });
    if (!mainWs['!dataValidation']) {
      mainWs['!dataValidation'] = {};
    }
    mainWs['!dataValidation'][stackableCellRef] = {
      type: 'list',
      allowBlank: false,
      formula1: 'TRUE,FALSE'
    };

    // temperature column (column G)
    const tempCellRef = XLSX.utils.encode_cell({ r: row, c: 6 });
    mainWs['!dataValidation'][tempCellRef] = {
      type: 'list',
      allowBlank: true,
      formula1: 'AMBIENT,CHILLED,FROZEN'
    };

    // commodity column (column H)
    const commodityCellRef = XLSX.utils.encode_cell({ r: row, c: 7 });
    mainWs['!dataValidation'][commodityCellRef] = {
      type: 'list',
      allowBlank: true,
      formula1: 'ALCOHOL,FOODSTUFFS,FRESH_SEAFOOD,FROZEN_SEAFOOD,ICE_CREAM,PRODUCE'
    };

    // isFoodGrade column (column I)
    const foodGradeCellRef = XLSX.utils.encode_cell({ r: row, c: 8 });
    mainWs['!dataValidation'][foodGradeCellRef] = {
      type: 'list',
      allowBlank: false,
      formula1: 'TRUE,FALSE'
    };

    // isReefer column (column J)
    const reeferCellRef = XLSX.utils.encode_cell({ r: row, c: 9 });
    mainWs['!dataValidation'][reeferCellRef] = {
      type: 'list',
      allowBlank: false,
      formula1: 'TRUE,FALSE'
    };
    
    // Add validation for all accessorial columns
    for (let col = 10; col < allHeaders.length; col++) { // Start from column K (first accessorial)
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      mainWs['!dataValidation'][cellRef] = {
        type: 'list',
        allowBlank: false,
        formula1: 'TRUE,FALSE'
      };
    }
  }
  
  XLSX.utils.book_append_sheet(workbook, mainWs, 'RFQ Data');
  
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
    { wch: 20 }, // Scenario
    { wch: 10 }, // isReefer
    { wch: 15 }, // Temperature
    { wch: 12 }, // Pallets
    { wch: 15 }, // Weight
    { wch: 25 }, // Expected Routing
    { wch: 30 }  // Reasoning
  ];
  
  XLSX.utils.book_append_sheet(workbook, routingWs, 'Smart Routing Guide');
  
  // Create accessorial reference sheet
  const project44AccessorialHeaders = ['Code', 'Description', 'Column Position'];
  const accessorialData = PROJECT44_ACCESSORIALS.map((acc, index) => [
    acc.code,
    acc.label,
    `Column ${String.fromCharCode(75 + index)}` // K, L, M, etc.
  ]);
  
  const accessorialWsData = [project44AccessorialHeaders, ...accessorialData];
  const accessorialWs = XLSX.utils.aoa_to_sheet(accessorialWsData);
  
  // Set column widths for accessorial reference sheet
  accessorialWs['!cols'] = [
    { wch: 15 }, // Code
    { wch: 40 }, // Description
    { wch: 15 }  // Column Position
  ];
  
  XLSX.utils.book_append_sheet(workbook, accessorialWs, 'Accessorial Reference');
  
  // Create comprehensive instructions sheet
  const instructionsData = [
    ['Unified Smart Routing Template Instructions'],
    [''],
    ['🧠 SMART ROUTING SYSTEM'],
    ['This template uses a single "isReefer" field to control routing:'],
    ['• isReefer = TRUE → Routes to FreshX reefer network'],
    ['• isReefer = FALSE → Routes to Project44 networks (LTL/VLTL based on size)'],
    [''],
    ['📊 ROUTING LOGIC:'],
    [''],
    ['🌡️ REEFER ROUTING (isReefer = TRUE):'],
    ['• All shipments marked as reefer go to FreshX'],
    ['• Temperature and commodity fields provide additional context'],
    ['• Ideal for specialized temperature-controlled freight'],
    [''],
    ['🚛 PROJECT44 ROUTING (isReefer = FALSE):'],
    ['• Standard LTL: 1-9 pallets OR under 15,000 lbs'],
    ['• Volume LTL: 10+ pallets OR 15,000+ lbs'],
    ['• Can handle temperature-controlled goods through Project44 network'],
    [''],
    ['📋 REQUIRED FIELDS:'],
    ['• fromDate: Pickup date (YYYY-MM-DD format)'],
    ['• fromZip/toZip: 5-digit US zip codes'],
    ['• pallets: Number of pallets (affects LTL vs VLTL classification)'],
    ['• grossWeight: Total weight in pounds (affects LTL vs VLTL classification)'],
    ['• isStackable: TRUE/FALSE for stackable pallets'],
    ['• isReefer: TRUE for FreshX reefer, FALSE for Project44 networks'],
    [''],
    ['🎯 OPTIONAL FIELDS:'],
    ['• temperature: AMBIENT, CHILLED, or FROZEN (informational)'],
    ['• commodity: Food type for reefer shipments (FOODSTUFFS, ICE_CREAM, etc.)'],
    ['• isFoodGrade: TRUE/FALSE for food-grade requirements'],
    [''],
    ['📝 SAMPLE DATA SCENARIOS:'],
    ['The template includes 8 test scenarios:'],
    [''],
    ['1. Standard LTL: Small dry goods (3 pallets, 2,500 lbs, isReefer=FALSE)'],
    ['2. Volume LTL: Large dry goods (12 pallets, 18,000 lbs, isReefer=FALSE)'],
    ['3. FreshX Reefer: Chilled food (5 pallets, CHILLED, isReefer=TRUE)'],
    ['4. FreshX Reefer: Frozen food (8 pallets, FROZEN, isReefer=TRUE)'],
    ['5. Project44 Temp: Non-reefer temp-controlled (4 pallets, CHILLED, isReefer=FALSE)'],
    ['6. Multi-mode: Medium shipment (9 pallets, 12,000 lbs, isReefer=FALSE)'],
    ['7. Large Reefer: Volume reefer (15 pallets, FROZEN, isReefer=TRUE)'],
    ['8. Small Reefer: Comparison test (2 pallets, CHILLED, isReefer=TRUE)'],
    [''],
    ['🔄 PROCESSING WORKFLOW:'],
    ['1. Upload this file to Smart Routing Processor'],
    ['2. System checks isReefer field for each shipment'],
    ['3. Routes to FreshX (if TRUE) or Project44 networks (if FALSE)'],
    ['4. For Project44: Determines LTL vs VLTL based on size/weight'],
    ['5. Presents results with clear routing explanations'],
    [''],
    ['💡 ROUTING TIPS:'],
    ['• Use isReefer=TRUE for specialized temperature-controlled freight'],
    ['• Use isReefer=FALSE for standard freight (even if temperature-controlled)'],
    ['• Mixed files with both reefer and standard freight are fully supported'],
    ['• System automatically determines optimal Project44 service level'],
    [''],
    ['⚠️ IMPORTANT NOTES:'],
    ['• The isReefer field is the primary routing control'],
    ['• Temperature field is informational and does not control routing'],
    ['• All accessorial checkboxes default to FALSE (unchecked)'],
    ['• Weight and pallet count determine LTL vs Volume LTL for Project44'],
    [''],
    ['🎯 EXPECTED RESULTS:'],
    ['Each shipment will be routed based on isReefer field:'],
    ['• isReefer=TRUE: FreshX reefer network'],
    ['• isReefer=FALSE: Project44 LTL or Volume LTL (auto-determined)'],
    ['• Clear routing explanations for each decision'],
    ['• Competitive pricing across selected networks']
  ];
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(workbook, instructionsWs, 'Instructions');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

export const downloadProject44ExcelTemplate = () => {
  console.log('Generating unified smart routing Excel template...');
  const excelBuffer = generateUnifiedSmartTemplate();
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'smart-routing-unified-template.xlsx';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log('Unified smart routing template download initiated');
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