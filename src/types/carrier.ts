export interface Carrier {
  id: string;
  name: string;
  scac?: string;
  mc_number?: string;
  dot_number?: string;
  account_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarrierWithStats extends Carrier {
  shipment_count?: number;
  customer_count?: number;
  avg_margin?: number;
}