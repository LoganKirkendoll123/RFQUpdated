/*
  # Create customers and carriers tables with proper data migration

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

  2. Data Migration
    - Populate customers table from existing CustomerCarriers data
    - Populate carriers table from existing CustomerCarriers data
    - Update CustomerCarriers with proper foreign key references
    - Update Shipments with proper foreign key references

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read
    - Add policies for admins to insert/update
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

-- Add foreign key columns to CustomerCarriers table if they don't exist
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

-- Add foreign key columns to Shipments table if they don't exist
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

-- Populate customers table from existing CustomerCarriers data
INSERT INTO customers (name, is_active, created_at, updated_at)
SELECT DISTINCT 
  "InternalName" as name,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM "CustomerCarriers"
WHERE "InternalName" IS NOT NULL 
  AND "InternalName" != ''
  AND NOT EXISTS (
    SELECT 1 FROM customers WHERE customers.name = "CustomerCarriers"."InternalName"
  );

-- Populate carriers table from existing CustomerCarriers data
INSERT INTO carriers (name, scac, account_code, is_active, created_at, updated_at)
SELECT DISTINCT 
  COALESCE(NULLIF("P44CarrierCode", ''), 'Unknown Carrier') as name,
  "P44CarrierCode" as scac,
  "P44CarrierCode" as account_code,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM "CustomerCarriers"
WHERE "P44CarrierCode" IS NOT NULL 
  AND "P44CarrierCode" != ''
  AND NOT EXISTS (
    SELECT 1 FROM carriers WHERE carriers.name = COALESCE(NULLIF("CustomerCarriers"."P44CarrierCode", ''), 'Unknown Carrier')
  );

-- Also populate carriers from Shipments data to capture any additional carriers
INSERT INTO carriers (name, is_active, created_at, updated_at)
SELECT DISTINCT 
  carrier_name,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM (
  SELECT "Booked Carrier" as carrier_name FROM "Shipments" WHERE "Booked Carrier" IS NOT NULL AND "Booked Carrier" != ''
  UNION
  SELECT "Quoted Carrier" as carrier_name FROM "Shipments" WHERE "Quoted Carrier" IS NOT NULL AND "Quoted Carrier" != ''
) carriers_from_shipments
WHERE NOT EXISTS (
  SELECT 1 FROM carriers WHERE carriers.name = carriers_from_shipments.carrier_name
);

-- Update CustomerCarriers with customer_id references
UPDATE "CustomerCarriers" 
SET customer_id = customers.id
FROM customers
WHERE customers.name = "CustomerCarriers"."InternalName"
  AND "CustomerCarriers".customer_id IS NULL;

-- Update CustomerCarriers with carrier_id references
UPDATE "CustomerCarriers" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.name = "CustomerCarriers"."P44CarrierCode"
  AND "CustomerCarriers".carrier_id IS NULL;

-- Update Shipments with customer_id references
UPDATE "Shipments" 
SET customer_id = customers.id
FROM customers
WHERE customers.name = "Shipments"."Customer"
  AND "Shipments".customer_id IS NULL;

-- Update Shipments with carrier_id references (using Booked Carrier first, then Quoted Carrier)
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.name = COALESCE("Shipments"."Booked Carrier", "Shipments"."Quoted Carrier")
  AND "Shipments".carrier_id IS NULL;

-- Now add foreign key constraints (only after data is properly linked)
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

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_customercarriers_customer_id ON "CustomerCarriers"(customer_id);
CREATE INDEX IF NOT EXISTS idx_customercarriers_carrier_id ON "CustomerCarriers"(carrier_id);
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