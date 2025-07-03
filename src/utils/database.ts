import { supabase } from './supabase';
import { RFQRow, ProcessingResult, QuoteWithPricing } from '../types';

// Database interfaces matching your Supabase tables
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

export interface Shipment {
  id?: number;
  customer_name: string;
  shipment_date: string;
  origin_zip: string;
  destination_zip: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  pallets: number;
  gross_weight: number;
  is_reefer: boolean;
  temperature?: string;
  commodity?: string;
  freight_class?: string;
  carrier_name?: string;
  carrier_scac?: string;
  quoted_rate?: number;
  final_rate?: number;
  transit_days?: number;
  service_level?: string;
  accessorial_services?: string[];
  shipment_status: string;
  tracking_number?: string;
  pickup_date?: string;
  delivery_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Customer Carrier Management Functions
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

// Shipment Management Functions
export const getShipments = async (filters?: {
  customerName?: string;
  startDate?: string;
  endDate?: string;
  carrierName?: string;
  status?: string;
}): Promise<Shipment[]> => {
  try {
    let query = supabase.from('Shipments').select('*');
    
    if (filters?.customerName) {
      query = query.eq('customer_name', filters.customerName);
    }
    
    if (filters?.startDate) {
      query = query.gte('shipment_date', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.lte('shipment_date', filters.endDate);
    }
    
    if (filters?.carrierName) {
      query = query.eq('carrier_name', filters.carrierName);
    }
    
    if (filters?.status) {
      query = query.eq('shipment_status', filters.status);
    }
    
    const { data, error } = await query.order('shipment_date', { ascending: false });
    
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

export const saveShipment = async (shipment: Omit<Shipment, 'id' | 'created_at' | 'updated_at'>): Promise<Shipment> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .insert([{
        ...shipment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
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

export const updateShipment = async (id: number, updates: Partial<Shipment>): Promise<Shipment> => {
  try {
    const { data, error } = await supabase
      .from('Shipments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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

export const deleteShipment = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('Shipments')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting shipment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete shipment:', error);
    throw error;
  }
};

// Utility Functions
export const saveRFQResultsToDatabase = async (
  results: ProcessingResult[],
  customerName: string
): Promise<void> => {
  try {
    const shipments: Omit<Shipment, 'id' | 'created_at' | 'updated_at'>[] = [];
    
    for (const result of results) {
      if (result.status === 'success' && result.quotes.length > 0) {
        // Get the best quote
        const bestQuote = result.quotes.reduce((best, current) => 
          (current as QuoteWithPricing).customerPrice < (best as QuoteWithPricing).customerPrice ? current : best
        ) as QuoteWithPricing;
        
        const shipment: Omit<Shipment, 'id' | 'created_at' | 'updated_at'> = {
          customer_name: customerName,
          shipment_date: result.originalData.fromDate,
          origin_zip: result.originalData.fromZip,
          destination_zip: result.originalData.toZip,
          origin_city: result.originalData.originCity,
          origin_state: result.originalData.originState,
          destination_city: result.originalData.destinationCity,
          destination_state: result.originalData.destinationState,
          pallets: result.originalData.pallets,
          gross_weight: result.originalData.grossWeight,
          is_reefer: result.originalData.isReefer || false,
          temperature: result.originalData.temperature,
          commodity: result.originalData.commodity,
          freight_class: result.originalData.freightClass,
          carrier_name: bestQuote.carrier.name,
          carrier_scac: bestQuote.carrier.scac,
          quoted_rate: bestQuote.customerPrice,
          final_rate: bestQuote.customerPrice, // Initially same as quoted
          transit_days: bestQuote.transitDays,
          service_level: bestQuote.serviceLevel?.description,
          accessorial_services: result.originalData.accessorial,
          shipment_status: 'QUOTED',
          notes: `Processed via ${(result as any).quotingDecision || 'smart routing'}`
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

export const getShipmentAnalytics = async (customerName?: string) => {
  try {
    let query = supabase.from('Shipments').select('*');
    
    if (customerName) {
      query = query.eq('customer_name', customerName);
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
        totalSpend: 0,
        avgRate: 0,
        topCarriers: [],
        topLanes: [],
        reeferPercentage: 0,
        avgTransitDays: 0
      };
    }
    
    const totalShipments = shipments.length;
    const totalWeight = shipments.reduce((sum, s) => sum + (s.gross_weight || 0), 0);
    const totalSpend = shipments.reduce((sum, s) => sum + (s.final_rate || s.quoted_rate || 0), 0);
    const avgRate = totalSpend / totalShipments;
    
    // Top carriers by shipment count
    const carrierCounts = shipments.reduce((acc, s) => {
      if (s.carrier_name) {
        acc[s.carrier_name] = (acc[s.carrier_name] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topCarriers = Object.entries(carrierCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    // Top lanes by shipment count
    const laneCounts = shipments.reduce((acc, s) => {
      const lane = `${s.origin_zip} → ${s.destination_zip}`;
      acc[lane] = (acc[lane] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topLanes = Object.entries(laneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lane, count]) => ({ lane, count }));
    
    const reeferShipments = shipments.filter(s => s.is_reefer).length;
    const reeferPercentage = (reeferShipments / totalShipments) * 100;
    
    const shipmentsWithTransit = shipments.filter(s => s.transit_days);
    const avgTransitDays = shipmentsWithTransit.length > 0 
      ? shipmentsWithTransit.reduce((sum, s) => sum + (s.transit_days || 0), 0) / shipmentsWithTransit.length
      : 0;
    
    return {
      totalShipments,
      totalWeight,
      totalSpend,
      avgRate,
      topCarriers,
      topLanes,
      reeferPercentage,
      avgTransitDays
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
      .select('customer_name')
      .order('customer_name');
    
    if (error) {
      console.error('Error fetching customer list:', error);
      throw error;
    }
    
    // Get unique customer names
    const uniqueCustomers = [...new Set(data?.map(d => d.customer_name) || [])];
    return uniqueCustomers.filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch customer list:', error);
    throw error;
  }
};