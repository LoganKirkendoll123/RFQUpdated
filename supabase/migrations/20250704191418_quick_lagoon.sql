/*
  # Create Customers and Carriers Tables

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `company_name` (text)
      - `email` (text)
      - `phone` (text)
      - `address_line1` (text)
      - `address_line2` (text)
      - `city` (text)
      - `state` (text)
      - `zip_code` (text)
      - `country` (text, default 'US')
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `carriers`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `scac` (text)
      - `mc_number` (text)
      - `dot_number` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - `account_code` (text)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read data
    - Add policies for admins to insert/update data

  3. Indexes
    - Add indexes on name fields for both tables
    - Add index on carriers account_code field

  4. Foreign Key Updates
    - Update CustomerCarriers table to reference new tables
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  company_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'US',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  scac text,
  mc_number text,
  dot_number text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  account_code text
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_carriers_name ON carriers(name);
CREATE INDEX IF NOT EXISTS idx_carriers_account_code ON carriers(account_code);

-- Add foreign key columns to CustomerCarriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CustomerCarriers' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE "CustomerCarriers" ADD COLUMN customer_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CustomerCarriers' AND column_name = 'carrier_id'
  ) THEN
    ALTER TABLE "CustomerCarriers" ADD COLUMN carrier_id uuid;
  END IF;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CustomerCarriers_customer_id_fkey'
  ) THEN
    ALTER TABLE "CustomerCarriers" 
    ADD CONSTRAINT CustomerCarriers_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CustomerCarriers_carrier_id_fkey'
  ) THEN
    ALTER TABLE "CustomerCarriers" 
    ADD CONSTRAINT CustomerCarriers_carrier_id_fkey 
    FOREIGN KEY (carrier_id) REFERENCES carriers(id);
  END IF;
END $$;

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_customercarriers_customer_id ON "CustomerCarriers"(customer_id);
CREATE INDEX IF NOT EXISTS idx_customercarriers_carrier_id ON "CustomerCarriers"(carrier_id);

-- Add foreign key columns to Shipments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN customer_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'carrier_id'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN carrier_id uuid;
  END IF;
END $$;

-- Add foreign key constraints for Shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Shipments_customer_id_fkey'
  ) THEN
    ALTER TABLE "Shipments" 
    ADD CONSTRAINT Shipments_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Shipments_carrier_id_fkey'
  ) THEN
    ALTER TABLE "Shipments" 
    ADD CONSTRAINT Shipments_carrier_id_fkey 
    FOREIGN KEY (carrier_id) REFERENCES carriers(id);
  END IF;
END $$;

-- Add indexes for Shipments foreign keys
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON "Shipments"(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_id ON "Shipments"(carrier_id);

-- RLS Policies for customers table
CREATE POLICY "Customers visible to all authenticated users"
  ON customers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert customers"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_approved = true
    )
  );

CREATE POLICY "Only admins can update customers"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_approved = true
    )
  );

-- RLS Policies for carriers table
CREATE POLICY "Carriers visible to all authenticated users"
  ON carriers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert carriers"
  ON carriers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_approved = true
    )
  );

CREATE POLICY "Only admins can update carriers"
  ON carriers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_approved = true
    )
  );