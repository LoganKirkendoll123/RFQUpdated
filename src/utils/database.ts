import { supabase } from './supabase';
import { RFQRow, ProcessingResult, QuoteWithPricing } from '../types';

// Updated database interfaces matching your new Supabase schema
export interface CustomerCarrier {
  id?: number;
  customer_name: string;
  carrier_name: string;
  carrier_scac?: string;
  carrier_mc_number?: string;
  preferred_carrier: boolean;
  rate_discount_percentage?: number;
  contract_number?: string;
  effective_date?: string;
  expiration_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// NEW: Updated Shipment interface matching the new schema exactly
export interface Shipment {
  "Invoice #": number;
  "Customer"?: string;
  "Branch"?: string;
  "Scheduled Pickup Date"?: string;
  "Actual Pickup Date"?: string;
  "Scheduled Delivery Date"?: string;
  "Actual Delivery Date"?: string;
  "Origin City"?: string;
  "State"?: string;
  "Zip"?: string;
  "Destination City"?: string;
  "State_1"?: string;
  "Zip_1"?: string;
  "Sales Rep"?: string;
  "Account Rep"?: string;
  "Dispatch Rep"?: string;
  "Quote Created By"?: string;
  "Line Items"?: number;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Max Freight Class"?: string;
  "Max Length"?: string;
  "Max Width"?: string;
  "Max Height"?: string;
  "Tot Linear Ft"?: string;
  "Is VLTL"?: string;
  "Commodities"?: string;
  "Accessorials"?: string;
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Service Level"?: string;
  "Revenue"?: string;
  "Carrier Quote"?: string;
  "Carrier Expense"?: string;
  "Other Expense"?: string;
  "Profit"?: string;
  "Revenue w/o Accessorials"?: string;
  "Expense w/o Accessorials"?: string;
}

// Customer Carrier Management Functions (unchanged)
export const getCustomerCarriers = async (customerName?: string): Promise<CustomerCarrier[]> => {
  try {
    let query = supabase.from('CustomerCarrier').select('*');
    
    if (customerName) {
      query = query.eq('customer_name', customerName);
    }
    
    const { data, error } = await query.order('customer_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching customer carriers:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Failed to fetch customer carriers:', error);
    throw error;
  }
};

export const saveCustomerCarrier = async (customerCarrier: Omit<CustomerCarrier, 'id' | 'created_at' | 'updated_at'>): Promise<CustomerCarrier> => {
  try {
    const { data, error } = await supabase
      .from('CustomerCarrier')
      .insert([{
        ...customerCarrier,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving customer carrier:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to save customer carrier:', error);
    throw error;
  }
};

export const updateCustomerCarrier = async (id: number, updates: Partial<CustomerCarrier>): Promise<CustomerCarrier> => {
  try {
    const { data, error } = await supabase
      .from('CustomerCarrier')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating customer carrier:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to update customer carrier:', error);
    throw error;
  }
};

export const deleteCustomerCarrier = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('CustomerCarrier')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting customer carrier:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete customer carrier:', error);
    throw error;
  }
};

// UPDATED: Shipment Management Functions for new schema
export const getShipments = async (filters?: {
  customerName?: string;
  startDate?: string;
  endDate?: string;
  carrierName?: string;
  branch?: string;
  salesRep?: string;
}): Promise<Shipment[]> => {
  try {
    let query = supabase.from('Shipments').select('*');
    
    if (filters?.customerName) {
      query = query.eq('"Customer"', filters.customerName);
    }
    
    if (filters?.startDate) {
      query = query.gte('"Scheduled Pickup Date"', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.lte('"Scheduled Pickup Date"', filters.endDate);
    }
    
    if (filters?.carrierName) {
      query = query.or(`"Booked Carrier".eq.${filters.carrierName},"Quoted Carrier".eq.${filters.carrierName}`);
    }
    
    if (filters?.branch) {
      query = query.eq('"Branch"', filters.branch);
    }
    
    if (filters?.salesRep) {
      query = query.eq('"Sales Rep"', filters.salesRep);
    }
    
    const { data, error } = await query.order('"Scheduled Pickup Date"', { ascending: false });
    
    if (error) {
      console.error('Error fetching shipments:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Failed to fetch shipments:', error);
    throw error;
  }
};

export const saveShipment = async (shipment: Omit<Shipment, '"Invoice #"'>): Promise<Shipment> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .insert([shipment])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving shipment:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to save shipment:', error);
    throw error;
  }
};

export const updateShipment = async (invoiceNumber: number, updates: Partial<Shipment>): Promise<Shipment> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .update(updates)
      .eq('"Invoice #"', invoiceNumber)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating shipment:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to update shipment:', error);
    throw error;
  }
};

export const deleteShipment = async (invoiceNumber: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('Shipments')
      .delete()
      .eq('"Invoice #"', invoiceNumber);
    
    if (error) {
      console.error('Error deleting shipment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete shipment:', error);
    throw error;
  }
};

// UPDATED: Utility Functions for new schema
export const saveRFQResultsToDatabase = async (
  results: ProcessingResult[],
  customerName: string,
  branch?: string,
  salesRep?: string
): Promise<void> => {
  try {
    const shipments: Omit<Shipment, '"Invoice #"'>[] = [];
    
    for (const result of results) {
      if (result.status === 'success' && result.quotes.length > 0) {
        // Get the best quote
        const bestQuote = result.quotes.reduce((best, current) => 
          (current as QuoteWithPricing).customerPrice < (best as QuoteWithPricing).customerPrice ? current : best
        ) as QuoteWithPricing;
        
        // Parse weight from string format
        const weightStr = result.originalData.grossWeight?.toString() || '0';
        const weight = weightStr.replace(/[^\d]/g, ''); // Remove non-numeric characters
        
        const shipment: Omit<Shipment, '"Invoice #"'> = {
          "Customer": customerName,
          "Branch": branch,
          "Scheduled Pickup Date": result.originalData.fromDate,
          "Origin City": result.originalData.originCity,
          "State": result.originalData.originState,
          "Zip": result.originalData.fromZip,
          "Destination City": result.originalData.destinationCity,
          "State_1": result.originalData.destinationState,
          "Zip_1": result.originalData.toZip,
          "Sales Rep": salesRep,
          "Quote Created By": "Smart Routing System",
          "Line Items": result.originalData.lineItems?.length || 1,
          "Tot Packages": result.originalData.pallets,
          "Tot Weight": weight,
          "Max Freight Class": result.originalData.freightClass || "70",
          "Is VLTL": result.originalData.pallets >= 10 || result.originalData.grossWeight >= 15000 ? "TRUE" : "FALSE",
          "Commodities": result.originalData.commodityDescription || result.originalData.commodity,
          "Accessorials": result.originalData.accessorial?.join(';'),
          "Booked Carrier": bestQuote.carrier.name,
          "Quoted Carrier": bestQuote.carrier.name,
          "Service Level": bestQuote.serviceLevel?.description,
          "Revenue": bestQuote.customerPrice?.toString(),
          "Carrier Quote": bestQuote.carrierTotalRate?.toString(),
          "Carrier Expense": bestQuote.carrierTotalRate?.toString(),
          "Profit": bestQuote.profit?.toString(),
          "Revenue w/o Accessorials": bestQuote.baseRate?.toString(),
          "Expense w/o Accessorials": bestQuote.baseRate?.toString()
        };
        
        shipments.push(shipment);
      }
    }
    
    if (shipments.length > 0) {
      const { error } = await supabase
        .from('Shipments')
        .insert(shipments);
      
      if (error) {
        console.error('Error saving RFQ results to database:', error);
        throw error;
      }
      
      console.log(`✅ Saved ${shipments.length} shipments to database for customer: ${customerName}`);
    }
  } catch (error) {
    console.error('Failed to save RFQ results to database:', error);
    throw error;
  }
};

// UPDATED: Analytics for new schema
export const getShipmentAnalytics = async (customerName?: string, branch?: string) => {
  try {
    let query = supabase.from('Shipments').select('*');
    
    if (customerName) {
      query = query.eq('"Customer"', customerName);
    }
    
    if (branch) {
      query = query.eq('"Branch"', branch);
    }
    
    const { data: shipments, error } = await query;
    
    if (error) {
      console.error('Error fetching shipment analytics:', error);
      throw error;
    }
    
    if (!shipments || shipments.length === 0) {
      return {
        totalShipments: 0,
        totalWeight: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgRevenue: 0,
        avgProfit: 0,
        topCarriers: [],
        topLanes: [],
        topBranches: [],
        topSalesReps: [],
        vltlPercentage: 0,
        profitMargin: 0
      };
    }
    
    const totalShipments = shipments.length;
    
    // Parse numeric values from string fields
    const parseNumeric = (value: string | null | undefined): number => {
      if (!value) return 0;
      const cleaned = value.toString().replace(/[^\d.-]/g, '');
      return parseFloat(cleaned) || 0;
    };
    
    const totalWeight = shipments.reduce((sum, s) => {
      const weight = parseNumeric(s["Tot Weight"]);
      return sum + weight;
    }, 0);
    
    const totalRevenue = shipments.reduce((sum, s) => {
      const revenue = parseNumeric(s["Revenue"]);
      return sum + revenue;
    }, 0);
    
    const totalProfit = shipments.reduce((sum, s) => {
      const profit = parseNumeric(s["Profit"]);
      return sum + profit;
    }, 0);
    
    const avgRevenue = totalRevenue / totalShipments;
    const avgProfit = totalProfit / totalShipments;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Top carriers by shipment count
    const carrierCounts = shipments.reduce((acc, s) => {
      const carrier = s["Booked Carrier"] || s["Quoted Carrier"];
      if (carrier) {
        acc[carrier] = (acc[carrier] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topCarriers = Object.entries(carrierCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    // Top lanes by shipment count
    const laneCounts = shipments.reduce((acc, s) => {
      const originZip = s["Zip"];
      const destZip = s["Zip_1"];
      if (originZip && destZip) {
        const lane = `${originZip} → ${destZip}`;
        acc[lane] = (acc[lane] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topLanes = Object.entries(laneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lane, count]) => ({ lane, count }));
    
    // Top branches by shipment count
    const branchCounts = shipments.reduce((acc, s) => {
      if (s["Branch"]) {
        acc[s["Branch"]] = (acc[s["Branch"]] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topBranches = Object.entries(branchCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    // Top sales reps by shipment count
    const salesRepCounts = shipments.reduce((acc, s) => {
      if (s["Sales Rep"]) {
        acc[s["Sales Rep"]] = (acc[s["Sales Rep"]] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topSalesReps = Object.entries(salesRepCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    const vltlShipments = shipments.filter(s => s["Is VLTL"] === "TRUE").length;
    const vltlPercentage = (vltlShipments / totalShipments) * 100;
    
    return {
      totalShipments,
      totalWeight,
      totalRevenue,
      totalProfit,
      avgRevenue,
      avgProfit,
      topCarriers,
      topLanes,
      topBranches,
      topSalesReps,
      vltlPercentage,
      profitMargin
    };
  } catch (error) {
    console.error('Failed to get shipment analytics:', error);
    throw error;
  }
};

export const getCustomerList = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .select('Customer', { distinct: true })
      .not('Customer', 'is', null)
      .order('Customer');
    
    if (error) {
      console.error('Error fetching customer list:', error);
      throw error;
    }
    
    // Get unique customer names
    const uniqueCustomers = [...new Set(data?.map(d => d.Customer) || [])];
    return uniqueCustomers.filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch customer list:', error);
    throw error;
  }
};

export const getBranchList = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .select('Branch', { distinct: true })
      .not('Branch', 'is', null)
      .order('Branch');
    
    if (error) {
      console.error('Error fetching branch list:', error);
      throw error;
    }
    
    // Get unique branch names
    const uniqueBranches = [...new Set(data?.map(d => d.Branch) || [])];
    return uniqueBranches.filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch branch list:', error);
    throw error;
  }
};

export const getSalesRepList = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .select('Sales Rep', { distinct: true })
      .not('Sales Rep', 'is', null)
      .order('Sales Rep');
    
    if (error) {
      console.error('Error fetching sales rep list:', error);
      throw error;
    }
    
    // Get unique sales rep names
    const uniqueSalesReps = [...new Set(data?.map(d => d["Sales Rep"]) || [])];
    return uniqueSalesReps.filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch sales rep list:', error);
    throw error;
  }
};