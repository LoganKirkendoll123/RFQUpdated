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
  
  // Create comprehensive headers - REMOVED legacy dimension fields, using ONLY itemized approach
  const baseHeaders = [
    // Core required fields
    'fromDate',
    'fromZip', 
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'isReefer',
    
    // Enhanced shipment details (NO packageLength/Width/Height here)
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
    // Item 1
    'item1_description',
    'item1_totalWeight',
    'item1_freightClass',
    'item1_packageLength',
    'item1_packageWidth',
    'item1_packageHeight',
    'item1_packageType',
    'item1_totalPackages',
    'item1_stackable',
    'item1_nmfcItemCode',
    'item1_totalValue',
    
    // Item 2
    'item2_description',
    'item2_totalWeight',
    'item2_freightClass',
    'item2_packageLength',
    'item2_packageWidth',
    'item2_packageHeight',
    'item2_packageType',
    'item2_totalPackages',
    'item2_stackable',
    'item2_nmfcItemCode',
    'item2_totalValue',
    
    // Item 3
    'item3_description',
    'item3_totalWeight',
    'item3_freightClass',
    'item3_packageLength',
    'item3_packageWidth',
    'item3_packageHeight',
    'item3_packageType',
    'item3_totalPackages',
    'item3_stackable',
    'item3_nmfcItemCode',
    'item3_totalValue',
    
    // Item 4
    'item4_description',
    'item4_totalWeight',
    'item4_freightClass',
    'item4_packageLength',
    'item4_packageWidth',
    'item4_packageHeight',
    'item4_packageType',
    'item4_totalPackages',
    'item4_stackable',
    'item4_nmfcItemCode',
    'item4_totalValue',
    
    // Item 5
    'item5_description',
    'item5_totalWeight',
    'item5_freightClass',
    'item5_packageLength',
    'item5_packageWidth',
    'item5_packageHeight',
    'item5_packageType',
    'item5_totalPackages',
    'item5_stackable',
    'item5_nmfcItemCode',
    'item5_totalValue'
  ];
  
  // Add each Project44 accessorial as its own column
  const accessorialHeaders = PROJECT44_ACCESSORIALS.map(acc => acc.code);
  const allHeaders = [...baseHeaders, ...accessorialHeaders];
  
  // Comprehensive sample data - using ONLY itemized dimensions
  const sampleData = [
    // TEST CASE 1A: Standard LTL - Small electronics shipment
    [
      '2025-02-15', '60607', '30033', 3, 2500, false, false,
      'AMBIENT', '', false, '70', '', '', 'General Freight', '', 'PLT', 3, 3, 'IN', 'LB', 5000, 0, '', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', 'Chicago', 'IL', 'US', '', 'Atlanta', 'GA', 'US',
      '', '', '', '', '', '', '', '',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      // Single item - all dimensions in item1 fields
      'Standard Pallets', 2500, '70', 48, 40, 48, 'PLT', 3, false, '', 5000,
      // Items 2-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // TEST CASE 1B: Standard LTL - Office furniture
    [
      '2025-02-16', '90210', '10001', 12, 18000, true, false,
      'AMBIENT', '', false, '85', '123456', '01', 'Mixed Electronics', 'ELECTRONICS', 'PLT', 12, 24, 'IN', 'LB', 25000, 2500, 'HTS123456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-17', '08:00', '17:00', '09:00', '16:00',
      '123 Main St', 'Beverly Hills', 'CA', 'US', '456 Broadway', 'New York', 'NY', 'US',
      'John Smith', '555-123-4567', 'john@company.com', 'Shipper Corp', 'Jane Doe', '555-987-6543', 'jane@receiver.com', 'Receiver Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 30,
      // Multiple items with different dimensions
      'Large Electronics', 8000, '85', 60, 48, 72, 'PLT', 5, true, '123456', 15000,
      'Small Components', 3000, '92.5', 36, 24, 36, 'BOX', 50, false, '234567', 5000,
      'Medium Equipment', 5000, '70', 48, 40, 60, 'CRATE', 3, true, '345678', 3000,
      'Accessories', 2000, '100', 24, 18, 24, 'CARTON', 20, true, '456789', 2000,
      // Item 5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'RESPU', 'RESDEL'].includes(acc.code) ? true : false
      )
    ],
    // TEST CASE 1C: Standard LTL - Automotive parts
    [
      '2025-02-17', '10001', '90210', 5, 4500, false, true,
      'CHILLED', 'FOODSTUFFS', true, '70', '654321', '02', 'Mixed Food Products', 'FOOD', 'CARTON', 50, 100, 'IN', 'LB', 15000, 1500, 'FOOD789', 'US',
      true, '9', 'UN1234', 'II', 'Dangerous Goods Sample', 'Emergency Contact', '555-HELP-911', 'Emergency Corp',
      '2025-02-18', '06:00', '18:00', '07:00', '15:00',
      '789 Cold St', 'New York', 'NY', 'US', '321 Freeze Ave', 'Los Angeles', 'CA', 'US',
      'Cold Handler', '555-COLD-123', 'cold@shipper.com', 'Cold Chain Co', 'Freeze Receiver', '555-FREEZE-456', 'freeze@receiver.com', 'Frozen Foods Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 60, 0,
      // Mixed food items with different requirements
      'Dairy Products', 1500, '70', 48, 40, 36, 'PLT', 2, false, '654321', 5000,
      'Frozen Meat', 2000, '70', 36, 24, 48, 'CARTON', 20, true, '765432', 7000,
      'Fresh Produce', 1000, '70', 24, 18, 18, 'CRATE', 15, false, '876543', 3000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'LGDEL', 'NOTIFY', 'APPTPU', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    // TEST CASE 1D: Standard LTL - Medical supplies
    [
      '2025-02-18', '77001', '30309', 8, 16500, true, false,
      'AMBIENT', '', false, '125', '789012', '03', 'Heavy Steel Products', 'STEEL', 'PLT', 8, 16, 'IN', 'LB', 30000, 3000, 'STEEL123', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-19', '07:00', '19:00', '06:00', '18:00',
      '1000 Steel Mill Rd', 'Houston', 'TX', 'US', '2000 Manufacturing Blvd', 'Atlanta', 'GA', 'US',
      'Steel Manager', '555-STEEL-123', 'steel@mill.com', 'Steel Mill Co', 'Plant Supervisor', '555-PLANT-456', 'plant@manufacturing.com', 'Manufacturing Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 40, 24,
      // Heavy steel products that trigger VLTL due to weight
      'Steel Coils', 8000, '125', 72, 48, 48, 'PLT', 3, true, '789012', 18000,
      'Steel Plates', 6000, '150', 96, 48, 12, 'PLT', 2, true, '890123', 9000,
      'Steel Bars', 2500, '125', 144, 6, 6, 'BUNDLE', 25, true, '901234', 3000,
      // Item 5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['SATPU', 'SATDEL', 'LTDDEL', 'INPU', 'INDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 2A: Volume LTL (Pallet Count) - Large electronics shipment
    [
      '2025-02-19', '94102', '02101', 15, 22000, true, false,
      'AMBIENT', '', false, '85', '345678', '04', 'Large Electronics', 'ELECTRONICS', 'PLT', 15, 30, 'IN', 'LB', 50000, 5000, 'ELEC789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '500 Tech Way', 'San Francisco', 'CA', 'US', '100 Innovation Dr', 'Boston', 'MA', 'US',
      'Tech Shipper', '555-TECH-456', 'tech@silicon.com', 'Silicon Valley Tech', 'Innovation Receiver', '555-INNOV-789', 'receive@innovation.com', 'Innovation Labs',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 36,
      // Large electronics requiring VLTL
      'Server Racks', 8000, '85', 72, 48, 84, 'PLT', 5, false, '345678', 25000,
      'Network Equipment', 6000, '92.5', 60, 40, 72, 'CRATE', 4, true, '456789', 15000,
      'Monitors & Displays', 4000, '70', 48, 36, 48, 'BOX', 15, true, '567890', 8000,
      'Cables & Accessories', 2000, '100', 36, 24, 24, 'CARTON', 25, true, '678901', 2000,
      'Power Equipment', 2000, '125', 48, 24, 36, 'CRATE', 3, false, '789012', 5000,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'INDEL', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 2B: Volume LTL (Pallet Count) - Construction materials
    [
      '2025-02-20', '33101', '75201', 18, 28000, true, false,
      'AMBIENT', '', false, '125', '890123', '05', 'Construction Materials', 'CONSTRUCTION', 'PLT', 18, 36, 'IN', 'LB', 40000, 4000, 'CONST456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-21', '06:00', '18:00', '07:00', '17:00',
      '2000 Builder Ave', 'Miami', 'FL', 'US', '3000 Construction Blvd', 'Dallas', 'TX', 'US',
      'Construction Manager', '555-BUILD-789', 'build@construction.com', 'Builder Corp', 'Site Manager', '555-SITE-012', 'site@construction.com', 'Construction Site Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 50, 42,
      // Heavy construction materials
      'Steel Beams', 12000, '125', 240, 12, 12, 'PLT', 6, true, '890123', 20000,
      'Concrete Blocks', 8000, '150', 48, 40, 36, 'PLT', 8, true, '901234', 12000,
      'Rebar', 5000, '125', 240, 6, 6, 'BUNDLE', 50, true, '012345', 5000,
      'Hardware', 2000, '100', 48, 36, 24, 'BOX', 40, true, '123456', 2000,
      'Tools', 1000, '85', 36, 24, 18, 'CRATE', 10, false, '234567', 1000,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['SATPU', 'SATDEL', 'CONDEL', 'LTDDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 2C: Volume LTL (Pallet Count) - Retail merchandise
    [
      '2025-02-21', '98101', '30309', 20, 25000, true, false,
      'AMBIENT', '', false, '70', '345679', '06', 'Retail Merchandise', 'RETAIL', 'PLT', 20, 40, 'IN', 'LB', 60000, 6000, 'RETAIL789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '4000 Retail Way', 'Seattle', 'WA', 'US', '5000 Store Blvd', 'Atlanta', 'GA', 'US',
      'Warehouse Manager', '555-WARE-345', 'warehouse@retail.com', 'Retail Warehouse', 'Store Manager', '555-STORE-678', 'store@retail.com', 'Retail Store Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 55, 48,
      // Large retail shipment
      'Clothing', 5000, '70', 48, 40, 60, 'PLT', 8, true, '345679', 20000,
      'Electronics', 8000, '85', 48, 40, 48, 'PLT', 6, false, '456790', 25000,
      'Home Goods', 6000, '92.5', 48, 40, 54, 'PLT', 4, true, '567901', 10000,
      'Sporting Goods', 4000, '100', 48, 40, 42, 'PLT', 2, true, '678012', 4000,
      'Books & Media', 2000, '70', 48, 40, 36, 'PLT', 2, true, '789123', 1000,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['RESDEL', 'MALLDEL', 'SATDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 2D: Volume LTL (Pallet Count) - Industrial equipment
    [
      '2025-02-22', '48201', '85001', 14, 21000, false, false,
      'AMBIENT', '', false, '100', '456790', '07', 'Industrial Equipment', 'INDUSTRIAL', 'PLT', 14, 28, 'IN', 'LB', 80000, 8000, 'INDUST123', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-23', '08:00', '16:00', '09:00', '15:00',
      '6000 Industrial Dr', 'Detroit', 'MI', 'US', '7000 Factory Ave', 'Phoenix', 'AZ', 'US',
      'Plant Manager', '555-PLANT-901', 'plant@industrial.com', 'Industrial Plant', 'Factory Supervisor', '555-FACT-234', 'factory@industrial.com', 'Factory Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 42,
      // Industrial machinery
      'Manufacturing Equipment', 10000, '100', 96, 72, 84, 'PLT', 4, false, '456790', 40000,
      'Conveyor Systems', 6000, '125', 144, 24, 36, 'PLT', 3, true, '567901', 25000,
      'Control Panels', 3000, '85', 48, 36, 72, 'CRATE', 8, false, '678012', 10000,
      'Motors & Pumps', 2000, '100', 36, 24, 48, 'BOX', 15, true, '789123', 5000,
      // Item 5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'LGPU', 'LGDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 3A: FreshX Reefer - Frozen food products
    [
      '2025-02-23', '60290', '90210', 6, 5500, false, true,
      'FROZEN', 'FROZEN_SEAFOOD', true, '70', '567901', '08', 'Frozen Seafood Products', 'FOOD', 'PLT', 6, 12, 'IN', 'LB', 25000, 2500, 'SEAFOOD456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-24', '05:00', '19:00', '06:00', '18:00',
      '8000 Cold Storage Way', 'Chicago', 'IL', 'US', '9000 Frozen Ave', 'Los Angeles', 'CA', 'US',
      'Cold Chain Manager', '555-COLD-567', 'cold@seafood.com', 'Seafood Processing', 'Frozen Receiver', '555-FROZ-890', 'frozen@restaurant.com', 'Restaurant Chain',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 60, 0,
      // Frozen seafood requiring strict temperature control
      'Frozen Fish', 2500, '70', 48, 40, 24, 'PLT', 3, false, '567901', 12000,
      'Frozen Shrimp', 1500, '70', 36, 24, 18, 'CARTON', 20, true, '678012', 8000,
      'Frozen Lobster', 1000, '70', 24, 18, 12, 'BOX', 15, false, '789123', 4000,
      'Ice Packs', 500, '70', 18, 12, 6, 'BAG', 50, true, '890234', 1000,
      // Item 5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'LGDEL', 'NOTIFY', 'APPTPU', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 3B: FreshX Reefer - Dairy products
    [
      '2025-02-24', '53202', '77001', 4, 3200, false, true,
      'CHILLED', 'FOODSTUFFS', true, '70', '678012', '09', 'Dairy Products', 'FOOD', 'PLT', 4, 8, 'IN', 'LB', 18000, 1800, 'DAIRY789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '10000 Dairy Farm Rd', 'Milwaukee', 'WI', 'US', '11000 Distribution Center', 'Houston', 'TX', 'US',
      'Dairy Manager', '555-DAIRY-123', 'dairy@farm.com', 'Dairy Farm Co', 'Distribution Manager', '555-DIST-456', 'dist@grocery.com', 'Grocery Chain',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 50, 0,
      // Fresh dairy products
      'Fresh Milk', 1500, '70', 48, 40, 36, 'PLT', 2, false, '678012', 8000,
      'Cheese Products', 1000, '70', 36, 24, 24, 'CARTON', 25, true, '789123', 6000,
      'Yogurt', 700, '70', 24, 18, 18, 'CASE', 30, true, '890234', 4000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['RESDEL', 'GROPU', 'GRODEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 3C: FreshX Reefer - Fresh produce
    [
      '2025-02-25', '93101', '10001', 8, 6000, true, true,
      'CHILLED', 'PRODUCE', false, '70', '789123', '10', 'Fresh Produce', 'FOOD', 'CRATE', 40, 80, 'IN', 'LB', 12000, 1200, 'PRODUCE123', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-26', '04:00', '20:00', '05:00', '19:00',
      '12000 Farm Valley Rd', 'Salinas', 'CA', 'US', '13000 Market St', 'New York', 'NY', 'US',
      'Farm Manager', '555-FARM-789', 'farm@produce.com', 'Fresh Produce Farm', 'Market Manager', '555-MARK-012', 'market@fresh.com', 'Fresh Market Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 55, 0,
      // Fresh produce requiring careful handling
      'Lettuce & Greens', 2000, '70', 48, 36, 18, 'CRATE', 15, false, '789123', 4000,
      'Tomatoes', 1500, '70', 36, 24, 12, 'CRATE', 20, false, '890234', 3000,
      'Berries', 1000, '70', 24, 18, 8, 'FLAT', 50, false, '901345', 3000,
      'Herbs', 500, '70', 18, 12, 6, 'BOX', 25, false, '012456', 2000,
      'Citrus Fruits', 1000, '70', 36, 24, 18, 'CRATE', 10, true, '123567', 2000,
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['FARMPU', 'FARMDEL', 'NOTIFY', 'APPTDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 3D: FreshX Reefer - Ice cream and frozen desserts
    [
      '2025-02-26', '55401', '85001', 3, 2800, false, true,
      'FROZEN', 'ICE_CREAM', true, '70', '890234', '11', 'Frozen Desserts', 'FOOD', 'PLT', 3, 6, 'IN', 'LB', 15000, 1500, 'ICECREAM456', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '14000 Creamery Lane', 'Minneapolis', 'MN', 'US', '15000 Desert Way', 'Phoenix', 'AZ', 'US',
      'Production Manager', '555-CREAM-345', 'production@icecream.com', 'Ice Cream Factory', 'Store Manager', '555-STORE-678', 'store@desserts.com', 'Dessert Store',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 45, 0,
      // Frozen desserts requiring ultra-cold transport
      'Premium Ice Cream', 1500, '70', 48, 40, 24, 'PLT', 2, false, '890234', 8000,
      'Frozen Yogurt', 800, '70', 36, 24, 18, 'CASE', 20, false, '901345', 4000,
      'Sorbet', 500, '70', 24, 18, 12, 'CARTON', 15, false, '012456', 3000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGDEL', 'RESDEL', 'SATDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 4A: Volume LTL (Weight Trigger) - Heavy machinery
    [
      '2025-02-27', '30309', '98101', 7, 17500, false, false,
      'AMBIENT', '', false, '150', '901345', '12', 'Heavy Machinery', 'MACHINERY', 'PLT', 7, 14, 'IN', 'LB', 100000, 10000, 'MACHINE789', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-28', '07:00', '17:00', '08:00', '16:00',
      '16000 Manufacturing Blvd', 'Atlanta', 'GA', 'US', '17000 Industrial Park', 'Seattle', 'WA', 'US',
      'Equipment Manager', '555-EQUIP-901', 'equipment@manufacturing.com', 'Manufacturing Corp', 'Plant Engineer', '555-PLANT-234', 'engineer@industrial.com', 'Industrial Plant',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 40, 21,
      // Heavy machinery triggering VLTL by weight
      'CNC Machine', 8000, '150', 120, 72, 96, 'PLT', 2, false, '901345', 50000,
      'Industrial Press', 6000, '150', 96, 60, 84, 'PLT', 2, false, '012456', 35000,
      'Compressor Unit', 3500, '125', 72, 48, 60, 'PLT', 3, false, '123567', 15000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['INPU', 'INDEL', 'LGPU', 'LGDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 4B: Volume LTL (Weight Trigger) - Steel products
    [
      '2025-02-28', '15201', '90210', 9, 18200, true, false,
      'AMBIENT', '', false, '125', '012456', '13', 'Steel Products', 'STEEL', 'PLT', 9, 18, 'IN', 'LB', 45000, 4500, 'STEEL456', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '18000 Steel Mill Way', 'Pittsburgh', 'PA', 'US', '19000 Construction Ave', 'Los Angeles', 'CA', 'US',
      'Steel Manager', '555-STEEL-567', 'steel@mill.com', 'Steel Mill Inc', 'Construction Manager', '555-CONST-890', 'construction@builder.com', 'Builder Corp',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 50, 27,
      // Heavy steel products
      'Steel Coils', 10000, '125', 84, 60, 60, 'PLT', 3, true, '012456', 25000,
      'Steel Plates', 5000, '150', 120, 48, 24, 'PLT', 2, true, '123567', 15000,
      'Steel Rods', 3200, '125', 240, 12, 12, 'BUNDLE', 40, true, '234678', 5000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['SATPU', 'SATDEL', 'CONDEL', 'LTDDEL'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 4C: Volume LTL (Weight Trigger) - Dense materials
    [
      '2025-03-01', '02101', '33101', 6, 15800, false, false,
      'AMBIENT', '', false, '200', '123567', '14', 'Dense Materials', 'MATERIALS', 'PLT', 6, 12, 'IN', 'LB', 30000, 3000, 'DENSE789', 'US',
      false, '', '', '', '', '', '', '',
      '2025-03-02', '09:00', '15:00', '10:00', '14:00',
      '20000 Materials Dr', 'Boston', 'MA', 'US', '21000 Warehouse Blvd', 'Miami', 'FL', 'US',
      'Materials Manager', '555-MAT-123', 'materials@supplier.com', 'Materials Supplier', 'Warehouse Supervisor', '555-WARE-456', 'warehouse@distributor.com', 'Distributor Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 35, 18,
      // Very dense materials
      'Lead Sheets', 6000, '200', 48, 36, 12, 'PLT', 2, false, '123567', 15000,
      'Tungsten Blocks', 4000, '200', 24, 18, 18, 'CRATE', 8, false, '234678', 10000,
      'Dense Ceramics', 3000, '175', 36, 24, 24, 'BOX', 15, false, '345789', 4000,
      'Metal Ingots', 2800, '150', 48, 24, 12, 'PLT', 1, false, '456890', 1000,
      // Item 5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'LGDEL', 'INDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    
    // TEST CASE 4D: Volume LTL (Weight Trigger) - Concrete products
    [
      '2025-03-02', '75201', '60607', 8, 16800, true, false,
      'AMBIENT', '', false, '175', '234678', '15', 'Concrete Products', 'CONSTRUCTION', 'PLT', 8, 16, 'IN', 'LB', 25000, 2500, 'CONCRETE123', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '22000 Concrete Plant Rd', 'Dallas', 'TX', 'US', '23000 Construction Site', 'Chicago', 'IL', 'US',
      'Plant Supervisor', '555-CONC-789', 'concrete@plant.com', 'Concrete Plant', 'Site Foreman', '555-SITE-012', 'foreman@construction.com', 'Construction Co',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 24,
      // Heavy concrete products
      'Precast Panels', 8000, '175', 96, 48, 8, 'PLT', 3, true, '234678', 12000,
      'Concrete Blocks', 5000, '175', 48, 40, 24, 'PLT', 3, true, '345789', 8000,
      'Pavers', 2500, '150', 48, 36, 6, 'PLT', 2, true, '456890', 3000,
      'Decorative Stone', 1300, '125', 36, 24, 12, 'BAG', 50, true, '567901', 2000,
      // Item 5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['CONPU', 'CONDEL', 'SATPU', 'SATDEL'].includes(acc.code) ? true : false
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
    // Enhanced fields (removed packageLength/Width/Height)
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
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
    // Item columns (5 items × 11 fields each = 55 columns)
    ...Array(55).fill({ wch: 12 }),
    // All accessorial columns get smaller width
    ...PROJECT44_ACCESSORIALS.map(() => ({ wch: 8 }))
  ];
  
  mainWs['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, mainWs, 'RFQ Data');
  
  // Create multi-item instructions sheet
  const multiItemHeaders = ['Feature', 'Description', 'Example'];
  const multiItemData = [
    ['Itemized-Only Approach', 'ALL dimensions use item1_, item2_, etc. format - no legacy fields', 'item1_packageLength=48, item1_packageWidth=40'],
    ['Single Item Shipments', 'Use only item1_ fields, leave item2-5 blank', 'item1_description="Standard Pallets", item1_totalWeight=2500'],
    ['Multi-Item Shipments', 'Use item1_, item2_, etc. for different items', 'item1_=servers, item2_=switches, item3_=cables'],
    ['Required Item Fields', 'description, totalWeight, freightClass, packageLength/Width/Height', 'All item1_ required fields must be filled'],
    ['Dimensions Per Item', 'Each item has unique length, width, height', 'item1_packageLength=60, item2_packageLength=24'],
    ['Weight Distribution', 'grossWeight = sum of all item weights', 'grossWeight=5000 = item1_totalWeight(3000) + item2_totalWeight(2000)'],
    ['Package Types Per Item', 'Each item can be PLT, BOX, CRATE, etc.', 'item1_packageType=PLT, item2_packageType=BOX'],
    ['Freight Classes Per Item', 'Each item can have different freight class', 'item1_freightClass=70, item2_freightClass=85'],
    ['Stackability Per Item', 'TRUE/FALSE for each item individually', 'item1_stackable=TRUE, item2_stackable=FALSE'],
    ['Empty Items', 'Leave unused item fields completely blank', 'For 2 items: fill item1_ and item2_, leave item3-5 blank']
  ];
  
  const multiItemWsData = [multiItemHeaders, ...multiItemData];
  const multiItemWs = XLSX.utils.aoa_to_sheet(multiItemWsData);
  multiItemWs['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }];
  
  XLSX.utils.book_append_sheet(workbook, multiItemWs, 'Itemized-Only Guide');
  
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
    ['item1_description', 'Description of first item', 'String', 'If using items', 'Electronics Equipment'],
    ['item1_totalWeight', 'Weight of first item', 'Number', 'If using items', '1500'],
    ['item1_freightClass', 'Freight class of first item', 'String', 'If using items', '70'],
    ['item1_packageLength', 'Length of first item (inches)', 'Number', 'If using items', '48'],
    ['item1_packageWidth', 'Width of first item (inches)', 'Number', 'If using items', '40'],
    ['item1_packageHeight', 'Height of first item (inches)', 'Number', 'If using items', '60'],
    ['item1_packageType', 'Package type of first item', 'String', 'If using items', 'PLT/BOX/CRATE'],
    ['item1_stackable', 'Can first item be stacked', 'Boolean', 'If using items', 'TRUE/FALSE'],
    ['item2_description', 'Description of second item', 'String', 'If using items', 'Small Components'],
    ['item2_totalWeight', 'Weight of second item', 'Number', 'If using items', '1000'],
    ['temperature', 'Temperature requirement', 'String', 'No', 'AMBIENT/CHILLED/FROZEN'],
    ['freightClass', 'Default freight class (if no items)', 'String', 'No', '70/85/92.5/etc'],
    ['packageType', 'Default package type (if no items)', 'String', 'No', 'PLT/BOX/CRATE/etc'],
    ['originCity', 'Origin city name', 'String', 'No', 'Chicago'],
    ['destinationCity', 'Destination city name', 'String', 'No', 'Atlanta'],
    ['pickupContactName', 'Pickup contact person', 'String', 'No', 'John Smith'],
    ['deliveryContactName', 'Delivery contact person', 'String', 'No', 'Jane Doe'],
    ['totalLinearFeet', 'Linear feet (for VLTL)', 'Integer', 'No', '30']
  ];
  
  const fieldWsData = [fieldHeaders, ...fieldData];
  const fieldWs = XLSX.utils.aoa_to_sheet(fieldWsData);
  fieldWs['!cols'] = [
    { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, fieldWs, 'Field Reference');
  
  // Create smart routing guide sheet
  const routingHeaders = ['Scenario', 'isReefer', 'Temperature', 'Pallets', 'Weight (lbs)', 'Expected Routing', 'Reasoning'];
  const routingData = [
    ['TEST CASES 1A-1D: Standard LTL', 'FALSE', 'AMBIENT', '3-9', '2,500-14,999', 'Project44 Standard LTL', 'Small dry goods: <10 pallets AND <15K lbs'],
    ['1A: Electronics', 'FALSE', 'AMBIENT', '3', '2,500', 'Standard LTL', 'Small electronics shipment'],
    ['1B: Office Furniture', 'FALSE', 'AMBIENT', '5', '8,000', 'Standard LTL', 'Medium office furniture'],
    ['1C: Automotive Parts', 'FALSE', 'AMBIENT', '7', '12,000', 'Standard LTL', 'Auto parts shipment'],
    ['1D: Medical Supplies', 'FALSE', 'AMBIENT', '4', '6,500', 'Standard LTL', 'Medical equipment'],
    ['', '', '', '', '', '', ''],
    ['TEST CASES 2A-2D: Volume LTL (Pallets)', 'FALSE', 'AMBIENT', '10+', 'Any', 'Project44 Volume LTL', 'Large shipment: 10+ pallets triggers VLTL'],
    ['2A: Large Electronics', 'FALSE', 'AMBIENT', '15', '22,000', 'Volume LTL', 'High pallet count electronics'],
    ['2B: Construction Materials', 'FALSE', 'AMBIENT', '18', '28,000', 'Volume LTL', 'Bulk construction materials'],
    ['2C: Retail Merchandise', 'FALSE', 'AMBIENT', '20', '25,000', 'Volume LTL', 'Large retail shipment'],
    ['2D: Industrial Equipment', 'FALSE', 'AMBIENT', '14', '21,000', 'Volume LTL', 'Industrial machinery'],
    ['', '', '', '', '', '', ''],
    ['TEST CASES 3A-3D: FreshX Reefer', 'TRUE', 'CHILLED/FROZEN', 'Any', 'Any', 'FreshX Reefer Network', 'isReefer=TRUE routes to specialized reefer network'],
    ['3A: Frozen Seafood', 'TRUE', 'FROZEN', '6', '5,500', 'FreshX Reefer', 'Frozen seafood products'],
    ['3B: Dairy Products', 'TRUE', 'CHILLED', '4', '3,200', 'FreshX Reefer', 'Fresh dairy products'],
    ['3C: Fresh Produce', 'TRUE', 'CHILLED', '8', '6,000', 'FreshX Reefer', 'Fresh fruits and vegetables'],
    ['3D: Ice Cream', 'TRUE', 'FROZEN', '3', '2,800', 'FreshX Reefer', 'Frozen desserts'],
    ['', '', '', '', '', '', ''],
    ['TEST CASES 4A-4D: Volume LTL (Weight)', 'FALSE', 'AMBIENT', '<10', '15,000+', 'Project44 Volume LTL', 'Heavy shipment: 15K+ lbs triggers VLTL even with <10 pallets'],
    ['4A: Heavy Machinery', 'FALSE', 'AMBIENT', '7', '17,500', 'Volume LTL', 'Industrial machinery by weight'],
    ['4B: Steel Products', 'FALSE', 'AMBIENT', '9', '18,200', 'Volume LTL', 'Heavy steel materials'],
    ['4C: Dense Materials', 'FALSE', 'AMBIENT', '6', '15,800', 'Volume LTL', 'Very dense materials'],
    ['4D: Concrete Products', 'FALSE', 'AMBIENT', '8', '16,800', 'Volume LTL', 'Heavy concrete products'],
    ['', '', '', '', '', '', ''],
    ['SMART ROUTING RULES:', '', '', '', '', '', ''],
    ['Rule 1: isReefer Check', 'TRUE', 'Any', 'Any', 'Any', 'FreshX Reefer', 'Primary routing control - overrides all other rules'],
    ['Rule 2: Standard LTL', 'FALSE', 'Any', '1-9', '1-14,999', 'Project44 Standard LTL', 'Small shipments that don\'t meet VLTL criteria'],
    ['Rule 3: Volume LTL', 'FALSE', 'Any', '10+ OR', '15,000+', 'Project44 Volume LTL', 'Large shipments by pallet count OR weight']
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
    `Column ${String.fromCharCode(75 + baseHeaders.length + 55 + index)}` // After all base headers + 55 item columns
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
    ['Itemized-Only Multi-Item Dimensions Project44 API Template'],
    [''],
    ['🧠 SMART ROUTING WITH ITEMIZED-ONLY APPROACH'],
    ['This template uses ONLY itemized fields for all dimensions - no legacy fields:'],
    ['• isReefer = TRUE → Routes to FreshX reefer network (regardless of size/weight)'],
    ['• isReefer = FALSE → Routes to Project44 networks:'],
    ['  - Standard LTL: <10 pallets AND <15,000 lbs'],
    ['  - Volume LTL: 10+ pallets OR 15,000+ lbs'],
    ['• ALL dimensions use item1_, item2_, etc. format for consistency'],
    [''],
    ['🎯 TEST CASES INCLUDED:'],
    [''],
    ['TEST CASES 1A-1D: Standard LTL (4 variations)'],
    ['• 1A: Electronics - 3 pallets, 2,500 lbs'],
    ['• 1B: Office Furniture - 5 pallets, 8,000 lbs'],
    ['• 1C: Automotive Parts - 7 pallets, 12,000 lbs'],
    ['• 1D: Medical Supplies - 4 pallets, 6,500 lbs'],
    ['• All route to Project44 Standard LTL (<10 pallets AND <15K lbs)'],
    [''],
    ['TEST CASES 2A-2D: Volume LTL by Pallet Count (4 variations)'],
    ['• 2A: Large Electronics - 15 pallets, 22,000 lbs'],
    ['• 2B: Construction Materials - 18 pallets, 28,000 lbs'],
    ['• 2C: Retail Merchandise - 20 pallets, 25,000 lbs'],
    ['• 2D: Industrial Equipment - 14 pallets, 21,000 lbs'],
    ['• All route to Project44 Volume LTL (10+ pallets triggers VLTL)'],
    [''],
    ['TEST CASES 3A-3D: FreshX Reefer (4 variations)'],
    ['• 3A: Frozen Seafood - 6 pallets, 5,500 lbs, FROZEN'],
    ['• 3B: Dairy Products - 4 pallets, 3,200 lbs, CHILLED'],
    ['• 3C: Fresh Produce - 8 pallets, 6,000 lbs, CHILLED'],
    ['• 3D: Ice Cream - 3 pallets, 2,800 lbs, FROZEN'],
    ['• All route to FreshX Reefer (isReefer=TRUE overrides size/weight)'],
    [''],
    ['TEST CASES 4A-4D: Volume LTL by Weight (4 variations)'],
    ['• 4A: Heavy Machinery - 7 pallets, 17,500 lbs'],
    ['• 4B: Steel Products - 9 pallets, 18,200 lbs'],
    ['• 4C: Dense Materials - 6 pallets, 15,800 lbs'],
    ['• 4D: Concrete Products - 8 pallets, 16,800 lbs'],
    ['• All route to Project44 Volume LTL (15K+ lbs triggers VLTL)'],
    [''],
    ['📊 COMPREHENSIVE TESTING COVERAGE:'],
    [''],
    ['Standard LTL Tests (4): Validates small shipment routing'],
    ['• Electronics, furniture, auto parts, medical supplies'],
    ['• Tests various freight classes and package types'],
    ['• Confirms <10 pallets AND <15K lbs routing logic'],
    [''],
    ['Volume LTL Pallet Tests (4): Validates high-volume routing'],
    ['• Large electronics, construction, retail, industrial'],
    ['• Tests 10+ pallet count trigger regardless of weight'],
    ['• Confirms pallet-based VLTL classification'],
    [''],
    ['FreshX Reefer Tests (4): Validates temperature-controlled routing'],
    ['• Frozen seafood, dairy, produce, ice cream'],
    ['• Tests both CHILLED and FROZEN temperatures'],
    ['• Confirms isReefer=TRUE overrides all size/weight rules'],
    [''],
    ['Volume LTL Weight Tests (4): Validates weight-based routing'],
    ['• Heavy machinery, steel, dense materials, concrete'],
    ['• Tests 15K+ lbs trigger with <10 pallets'],
    ['• Confirms weight-based VLTL classification'],
    [''],
    ['📦 ITEMIZED-ONLY STRUCTURE:'],
    [''],
    ['✅ WHAT WE USE (Itemized Fields):'],
    ['• item1_packageLength, item1_packageWidth, item1_packageHeight'],
    ['• item2_packageLength, item2_packageWidth, item2_packageHeight'],
    ['• item3_packageLength, item3_packageWidth, item3_packageHeight'],
    ['• etc. for up to 5 items'],
    [''],
    ['❌ WHAT WE REMOVED (Legacy Fields):'],
    ['• packageLength, packageWidth, packageHeight (removed)'],
    ['• These caused confusion with itemized approach'],
    [''],
    ['🏗️ ITEM FIELD STRUCTURE (Required for each item):'],
    [''],
    ['For each item (1-5), use these field patterns:'],
    ['• item1_description: "Electronics Equipment" (required)'],
    ['• item1_totalWeight: 1500 (pounds, required)'],
    ['• item1_freightClass: "70" (required)'],
    ['• item1_packageLength: 48 (inches, required)'],
    ['• item1_packageWidth: 40 (inches, required)'],
    ['• item1_packageHeight: 60 (inches, required)'],
    ['• item1_packageType: "PLT" (optional)'],
    ['• item1_totalPackages: 2 (optional)'],
    ['• item1_stackable: TRUE/FALSE (optional)'],
    ['• item1_nmfcItemCode: "123456" (optional)'],
    ['• item1_totalValue: 5000 (optional)'],
    [''],
    ['📋 SINGLE ITEM SHIPMENTS:'],
    [''],
    ['For single-item shipments:'],
    ['• Fill ALL item1_ fields (description, totalWeight, freightClass, dimensions)'],
    ['• Leave item2_, item3_, item4_, item5_ fields completely BLANK'],
    ['• grossWeight should equal item1_totalWeight'],
    [''],
    ['Example single item:'],
    ['• item1_description: "Standard Pallets"'],
    ['• item1_totalWeight: 2500'],
    ['• item1_freightClass: "70"'],
    ['• item1_packageLength: 48'],
    ['• item1_packageWidth: 40'],
    ['• item1_packageHeight: 48'],
    ['• item1_packageType: "PLT"'],
    ['• item1_stackable: FALSE'],
    ['• grossWeight: 2500 (matches item1_totalWeight)'],
    [''],
    ['📦 MULTI-ITEM SHIPMENTS:'],
    [''],
    ['For multi-item shipments:'],
    ['• Fill item1_ fields for first item'],
    ['• Fill item2_ fields for second item'],
    ['• Continue for item3_, item4_, item5_ as needed'],
    ['• grossWeight = sum of all item weights'],
    [''],
    ['Example multi-item (3 items):'],
    ['• item1_description: "Large Electronics"'],
    ['• item1_totalWeight: 8000, item1_freightClass: "85"'],
    ['• item1_packageLength: 60, item1_packageWidth: 48, item1_packageHeight: 72'],
    [''],
    ['• item2_description: "Small Components"'],
    ['• item2_totalWeight: 3000, item2_freightClass: "92.5"'],
    ['• item2_packageLength: 36, item2_packageWidth: 24, item2_packageHeight: 36'],
    [''],
    ['• item3_description: "Accessories"'],
    ['• item3_totalWeight: 2000, item3_freightClass: "100"'],
    ['• item3_packageLength: 24, item3_packageWidth: 18, item3_packageHeight: 24'],
    [''],
    ['• grossWeight: 13000 (8000 + 3000 + 2000)'],
    ['• Leave item4_ and item5_ fields BLANK'],
    [''],
    ['⚖️ WEIGHT VALIDATION:'],
    [''],
    ['The system validates that:'],
    ['• grossWeight = sum of all item weights'],
    ['• Each item has a valid weight > 0'],
    ['• Total weight is reasonable for the number of pallets'],
    ['• If validation fails, you\'ll get a clear error message'],
    [''],
    ['🔄 PROCESSING WORKFLOW:'],
    ['1. Upload this file to Smart Routing Processor'],
    ['2. System validates all item fields and dimensions'],
    ['3. Smart routing classification:'],
    ['   • Check isReefer field first (primary control)'],
    ['   • If FALSE: Check pallets (10+) OR weight (15K+) for LTL vs VLTL'],
    ['   • If TRUE: Route to FreshX regardless of size/weight'],
    ['4. Process quotes through appropriate network'],
    ['5. Return detailed pricing with routing decision explanation'],
    [''],
    ['💡 BEST PRACTICES:'],
    ['• Always use itemized fields (item1_, item2_, etc.) for dimensions'],
    ['• Provide accurate dimensions for each item type'],
    ['• Use appropriate freight classes for each item'],
    ['• Specify stackability for each item individually'],
    ['• Include detailed descriptions for better handling'],
    ['• Ensure total weight equals sum of all item weights'],
    ['• Use consistent units (inches for dimensions, pounds for weight)'],
    ['• Leave unused item fields completely blank'],
    [''],
    ['⚠️ IMPORTANT NOTES:'],
    ['• NO legacy packageLength/Width/Height fields - use ONLY itemized approach'],
    ['• For single items: use item1_ fields, leave item2-5 blank'],
    ['• For multiple items: use item1_, item2_, etc. as needed'],
    ['• Each item can have different freight classes and package types'],
    ['• System automatically calculates total cubic volume from all items'],
    ['• Linear feet calculation considers all item dimensions'],
    ['• Stackability is evaluated per item, not per shipment'],
    ['• Mixed freight classes may affect overall pricing'],
    [''],
    ['🎯 EXPECTED RESULTS:'],
    ['TEST CASES 1A-1D (Standard LTL): All isReefer=FALSE, <10 pallets, <15K lbs'],
    ['→ All route to Project44 Standard LTL network'],
    ['→ Reason: Small shipments meeting both criteria'],
    [''],
    ['TEST CASES 2A-2D (Volume LTL Pallets): All isReefer=FALSE, 10+ pallets'],
    ['→ All route to Project44 Volume LTL network'],
    ['→ Reason: High pallet count triggers VLTL regardless of weight'],
    [''],
    ['TEST CASES 3A-3D (FreshX Reefer): All isReefer=TRUE'],
    ['→ All route to FreshX Reefer network'],
    ['→ Reason: isReefer=TRUE overrides all size/weight considerations'],
    [''],
    ['TEST CASES 4A-4D (Volume LTL Weight): All isReefer=FALSE, <10 pallets, 15K+ lbs'],
    ['→ All route to Project44 Volume LTL network'],
    ['→ Reason: Heavy weight triggers VLTL despite low pallet count'],
    [''],
    ['🔍 VALIDATION POINTS:'],
    [''],
    ['• 16 total test cases provide comprehensive coverage'],
    ['• 4 tests per routing scenario ensure reliability'],
    ['• Different commodity types test various freight classes'],
    ['• Mixed item configurations test complex scenarios'],
    ['• Edge cases validate boundary conditions'],
    ['• Temperature variations test reefer classification'],
    ['• Weight/pallet combinations test all trigger conditions'],
    [''],
    ['Each test case validates specific routing logic paths and'],
    ['together provide complete coverage of smart routing scenarios.']
  ];
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(workbook, instructionsWs, 'Instructions');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

export const downloadProject44ExcelTemplate = () => {
  console.log('Generating itemized-only multi-item dimensions Project44 API Excel template...');
  const excelBuffer = generateUnifiedSmartTemplate();
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project44-itemized-only-dimensions-template.xlsx';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log('Itemized-only multi-item dimensions Project44 API template download initiated');
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