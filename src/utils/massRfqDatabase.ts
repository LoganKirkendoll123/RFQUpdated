import { supabase } from './supabase';
import { ProcessingResult, PricingSettings } from '../types';

export interface MassRFQBatch {
  id?: string;
  batch_name: string;
  customer_name?: string;
  branch_filter?: string;
  sales_rep_filter?: string;
  carrier_filter?: string;
  date_range_start?: string;
  date_range_end?: string;
  shipment_count: number;
  total_quotes_received: number;
  best_total_price: number;
  total_profit: number;
  pricing_settings: PricingSettings;
  selected_carriers: { [carrierId: string]: boolean };
  rfq_data: any[];
  results_data?: ProcessingResult[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const saveMassRFQBatch = async (batch: Omit<MassRFQBatch, 'id' | 'created_at' | 'updated_at'>): Promise<MassRFQBatch> => {
  try {
    console.log('💾 Saving Mass RFQ batch:', batch.batch_name);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .insert([{
        ...batch,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error saving Mass RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ Mass RFQ batch saved successfully:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Failed to save Mass RFQ batch:', error);
    throw error;
  }
};

export const updateMassRFQBatch = async (
  id: string, 
  updates: Partial<MassRFQBatch>
): Promise<MassRFQBatch> => {
  try {
    console.log('🔄 Updating Mass RFQ batch:', id);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating Mass RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ Mass RFQ batch updated successfully');
    return data;
  } catch (error) {
    console.error('❌ Failed to update Mass RFQ batch:', error);
    throw error;
  }
};

export const getMassRFQBatches = async (limit: number = 50): Promise<MassRFQBatch[]> => {
  try {
    console.log('📋 Loading Mass RFQ batches...');
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Error loading Mass RFQ batches:', error);
      throw error;
    }
    
    console.log(`✅ Loaded ${data?.length || 0} Mass RFQ batches`);
    return data || [];
  } catch (error) {
    console.error('❌ Failed to load Mass RFQ batches:', error);
    throw error;
  }
};

export const getMassRFQBatch = async (id: string): Promise<MassRFQBatch | null> => {
  try {
    console.log('🔍 Loading Mass RFQ batch:', id);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ Mass RFQ batch not found:', id);
        return null;
      }
      console.error('❌ Error loading Mass RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ Mass RFQ batch loaded successfully');
    return data;
  } catch (error) {
    console.error('❌ Failed to load Mass RFQ batch:', error);
    throw error;
  }
};

export const deleteMassRFQBatch = async (id: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting Mass RFQ batch:', id);
    
    const { error } = await supabase
      .from('mass_rfq_batches')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('❌ Error deleting Mass RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ Mass RFQ batch deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete Mass RFQ batch:', error);
    throw error;
  }
};

export const calculateBatchSummary = (results: ProcessingResult[]) => {
  const successfulResults = results.filter(r => r.status === 'success' && r.quotes.length > 0);
  
  const totalQuotes = successfulResults.reduce((sum, r) => sum + r.quotes.length, 0);
  
  const bestTotalPrice = successfulResults.reduce((sum, result) => {
    if (result.quotes.length === 0) return sum;
    
    const bestQuote = result.quotes.reduce((best, current) => {
      const bestPrice = (best as any).customerPrice || (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
      const currentPrice = (current as any).customerPrice || (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
      return currentPrice < bestPrice ? current : best;
    });
    
    const price = (bestQuote as any).customerPrice || (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts);
    return sum + price;
  }, 0);
  
  const totalProfit = successfulResults.reduce((sum, result) => {
    if (result.quotes.length === 0) return sum;
    
    const bestQuote = result.quotes.reduce((best, current) => {
      const bestPrice = (best as any).customerPrice || (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
      const currentPrice = (current as any).customerPrice || (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
      return currentPrice < bestPrice ? current : best;
    });
    
    const profit = (bestQuote as any).profit || 0;
    return sum + profit;
  }, 0);
  
  return {
    shipment_count: results.length,
    total_quotes_received: totalQuotes,
    best_total_price: bestTotalPrice,
    total_profit: totalProfit
  };
};