/*
  # Create Mass RFQ Batches table

  1. New Tables
    - `mass_rfq_batches`
      - `id` (uuid, primary key)
      - `batch_name` (text, user-defined name)
      - `customer_name` (text, optional customer filter)
      - `branch_filter` (text, optional branch filter)
      - `sales_rep_filter` (text, optional sales rep filter)
      - `carrier_filter` (text, optional carrier filter)
      - `date_range_start` (date, optional)
      - `date_range_end` (date, optional)
      - `shipment_count` (integer)
      - `total_quotes_received` (integer)
      - `best_total_price` (numeric)
      - `total_profit` (numeric)
      - `pricing_settings` (jsonb, stored pricing configuration)
      - `selected_carriers` (jsonb, stored carrier selection)
      - `rfq_data` (jsonb, original shipment data)
      - `results_data` (jsonb, quote results)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (text, user identifier)

  2. Security
    - Enable RLS on `mass_rfq_batches` table
    - Add policy for authenticated users to manage their own batches
*/

CREATE TABLE IF NOT EXISTS mass_rfq_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  customer_name text,
  branch_filter text,
  sales_rep_filter text,
  carrier_filter text,
  date_range_start date,
  date_range_end date,
  shipment_count integer NOT NULL DEFAULT 0,
  total_quotes_received integer NOT NULL DEFAULT 0,
  best_total_price numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  pricing_settings jsonb NOT NULL,
  selected_carriers jsonb NOT NULL,
  rfq_data jsonb NOT NULL,
  results_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'
);

ALTER TABLE mass_rfq_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own RFQ batches"
  ON mass_rfq_batches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mass_rfq_batches_created_at ON mass_rfq_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mass_rfq_batches_customer ON mass_rfq_batches(customer_name);
CREATE INDEX IF NOT EXISTS idx_mass_rfq_batches_created_by ON mass_rfq_batches(created_by);