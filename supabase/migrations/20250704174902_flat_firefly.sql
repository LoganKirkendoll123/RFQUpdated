/*
  # Create Customer Carriers Table

  1. New Tables
    - `customer_carriers`
      - `id` (uuid, primary key)
      - `customer_name` (text, not null)
      - `carrier_name` (text, not null)
      - `carrier_scac` (text)
      - `carrier_mc_number` (text)
      - `preferred_carrier` (boolean, default false)
      - `rate_discount_percentage` (numeric, default 0)
      - `contract_number` (text)
      - `effective_date` (date)
      - `expiration_date` (date)
      - `notes` (text)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `customer_carriers` table
    - Add policy for authenticated users to read all records
    - Add policy for admins to manage all records
    - Add policy for users to read their own customer records
  
  3. Triggers
    - Add trigger to update `updated_at` timestamp on record changes
*/

-- Create customer_carriers table
CREATE TABLE IF NOT EXISTS public.customer_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  carrier_name text NOT NULL,
  carrier_scac text,
  carrier_mc_number text,
  preferred_carrier boolean DEFAULT false,
  rate_discount_percentage numeric DEFAULT 0,
  contract_number text,
  effective_date date,
  expiration_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on customer_name for faster lookups
CREATE INDEX IF NOT EXISTS customer_carriers_customer_name_idx ON public.customer_carriers (customer_name);

-- Create index on carrier_name for faster lookups
CREATE INDEX IF NOT EXISTS customer_carriers_carrier_name_idx ON public.customer_carriers (carrier_name);

-- Create index on carrier_scac for faster lookups
CREATE INDEX IF NOT EXISTS customer_carriers_carrier_scac_idx ON public.customer_carriers (carrier_scac);

-- Enable Row Level Security
ALTER TABLE public.customer_carriers ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage all records
CREATE POLICY "Admins can manage all customer carriers"
  ON public.customer_carriers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for managers to manage all records
CREATE POLICY "Managers can manage all customer carriers"
  ON public.customer_carriers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'manager'
    )
  );

-- Create policy for users to read records related to their company
CREATE POLICY "Users can read customer carriers for their company"
  ON public.customer_carriers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() 
      AND company = (
        SELECT company FROM public.user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Create trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_carrier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamp on record changes
CREATE TRIGGER on_customer_carrier_updated
  BEFORE UPDATE ON public.customer_carriers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_carrier_timestamp();

-- Add comments to table and columns for better documentation
COMMENT ON TABLE public.customer_carriers IS 'Stores customer-specific carrier relationships and pricing';
COMMENT ON COLUMN public.customer_carriers.customer_name IS 'Name of the customer';
COMMENT ON COLUMN public.customer_carriers.carrier_name IS 'Name of the carrier';
COMMENT ON COLUMN public.customer_carriers.carrier_scac IS 'Standard Carrier Alpha Code (SCAC)';
COMMENT ON COLUMN public.customer_carriers.carrier_mc_number IS 'Motor Carrier (MC) number';
COMMENT ON COLUMN public.customer_carriers.preferred_carrier IS 'Indicates if this is a preferred carrier for the customer';
COMMENT ON COLUMN public.customer_carriers.rate_discount_percentage IS 'Discount percentage applied to carrier rates';
COMMENT ON COLUMN public.customer_carriers.contract_number IS 'Contract reference number';
COMMENT ON COLUMN public.customer_carriers.effective_date IS 'Date when the contract/rate becomes effective';
COMMENT ON COLUMN public.customer_carriers.expiration_date IS 'Date when the contract/rate expires';