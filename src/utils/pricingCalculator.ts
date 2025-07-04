import { supabase } from './supabase';

interface Customer {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Carrier {
  id: string;
  name: string;
  scac?: string;
  mc_number?: string;
  dot_number?: string;
  account_code: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  p44_group?: string;
  display_name?: string;
}

interface CustomerCarrier {
  MarkupId: number;
  CarrierId?: number;
  CustomerID?: number;
  InternalName?: string;
  P44CarrierCode?: string;
  MinDollar?: number;
  MaxDollar?: string;
  Percentage?: string;
  customer_id?: string;
  carrier_id?: string;
}

interface Shipment {
  'Invoice #': number;
  Customer?: string;
  Branch?: string;
  'Scheduled Pickup Date'?: string;
  'Actual Pickup Date'?: string;
  'Scheduled Delivery Date'?: string;
  'Actual Delivery Date'?: string;
  'Origin City'?: string;
  State?: string;
  Zip?: string;
  'Destination City'?: string;
  State_1?: string;
  Zip_1?: string;
  'Sales Rep'?: string;
  'Account Rep'?: string;
  'Dispatch Rep'?: string;
  'Quote Created By'?: string;
  'Line Items'?: number;
  'Tot Packages'?: number;
  'Tot Weight'?: string;
  'Max Freight Class'?: string;
  'Max Length'?: string;
  'Max Width'?: string;
  'Max Height'?: string;
  'Tot Linear Ft'?: string;
  'Is VLTL'?: string;
  Commodities?: string;
  Accessorials?: string;
  'Booked Carrier'?: string;
  'Quoted Carrier'?: string;
  'Service Level'?: string;
  Revenue?: string;
  'Carrier Quote'?: string;
  'Carrier Expense'?: string;
  'Other Expense'?: string;
  Profit?: string;
  'Revenue w/o Accessorials'?: string;
  'Expense w/o Accessorials'?: string;
  customer_id?: string;
}

export class PricingCalculator {
  private customers: Customer[] = [];
  private carriers: Carrier[] = [];
  private customerCarriers: CustomerCarrier[] = [];
  private shipments: Shipment[] = [];

  async loadCustomers(): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      this.customers = data || [];
      return this.customers;
    } catch (error) {
      console.error('Error loading customers:', error);
      throw error;
    }
  }

  async loadCarriers(): Promise<Carrier[]> {
    try {
      const { data, error } = await supabase
        .from('carriers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      this.carriers = data || [];
      return this.carriers;
    } catch (error) {
      console.error('Error loading carriers:', error);
      throw error;
    }
  }

  async loadCustomerCarriers(): Promise<CustomerCarrier[]> {
    try {
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('*');

      if (error) throw error;
      
      this.customerCarriers = data || [];
      return this.customerCarriers;
    } catch (error) {
      console.error('Error loading customer carriers:', error);
      throw error;
    }
  }

  async loadShipments(): Promise<Shipment[]> {
    try {
      const { data, error } = await supabase
        .from('Shipments')
        .select('*');

      if (error) throw error;
      
      this.shipments = data || [];
      return this.shipments;
    } catch (error) {
      console.error('Error loading shipments:', error);
      throw error;
    }
  }

  getCustomerMargin(customerName: string, carrierName: string): number | null {
    const customerCarrier = this.customerCarriers.find(cc => 
      cc.InternalName === customerName && 
      this.carriers.find(c => c.id === cc.carrier_id)?.name === carrierName
    );

    if (customerCarrier && customerCarrier.Percentage) {
      const percentage = parseFloat(customerCarrier.Percentage);
      return isNaN(percentage) ? null : percentage;
    }

    return null;
  }

  calculatePricing(basePrice: number, customerName?: string, carrierName?: string): {
    basePrice: number;
    margin: number;
    finalPrice: number;
    marginSource: 'customer-specific' | 'default' | 'none';
  } {
    let margin = 0;
    let marginSource: 'customer-specific' | 'default' | 'none' = 'none';

    // Try to get customer-specific margin first
    if (customerName && carrierName) {
      const customerMargin = this.getCustomerMargin(customerName, carrierName);
      if (customerMargin !== null) {
        margin = customerMargin;
        marginSource = 'customer-specific';
      }
    }

    // If no customer-specific margin, use default (could be configurable)
    if (marginSource === 'none') {
      margin = 15; // Default 15% margin
      marginSource = 'default';
    }

    const finalPrice = basePrice * (1 + margin / 100);

    return {
      basePrice,
      margin,
      finalPrice,
      marginSource
    };
  }

  async searchCustomers(searchTerm: string): Promise<string[]> {
    try {
      // Search in customers table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('name')
        .eq('is_active', true)
        .ilike('name', `%${searchTerm}%`)
        .limit(50);

      if (customerError) throw customerError;

      // Search in shipments history
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null)
        .ilike('"Customer"', `%${searchTerm}%`)
        .limit(50);

      if (shipmentError) throw shipmentError;

      // Search in customer carriers
      const { data: carrierData, error: carrierError } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null)
        .ilike('InternalName', `%${searchTerm}%`)
        .limit(50);

      if (carrierError) throw carrierError;

      // Combine and deduplicate results
      const customerNames = customerData?.map(c => c.name) || [];
      const shipmentNames = shipmentData?.map(s => s.Customer).filter(Boolean) || [];
      const carrierNames = carrierData?.map(c => c.InternalName).filter(Boolean) || [];

      const allNames = [...customerNames, ...shipmentNames, ...carrierNames];
      const uniqueNames = Array.from(new Set(allNames)).sort();

      return uniqueNames;
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  async getCustomerHistory(customerName: string): Promise<{
    shipments: Shipment[];
    carrierRelationships: CustomerCarrier[];
  }> {
    try {
      // Get shipments for this customer
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('Shipments')
        .select('*')
        .eq('"Customer"', customerName);

      if (shipmentError) throw shipmentError;

      // Get carrier relationships for this customer
      const { data: carrierData, error: carrierError } = await supabase
        .from('CustomerCarriers')
        .select('*')
        .eq('InternalName', customerName);

      if (carrierError) throw carrierError;

      return {
        shipments: shipmentData || [],
        carrierRelationships: carrierData || []
      };
    } catch (error) {
      console.error('Error getting customer history:', error);
      throw error;
    }
  }
}

export const pricingCalculator = new PricingCalculator();