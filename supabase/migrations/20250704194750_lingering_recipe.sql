/*
  # Database Schema Update for Customer and Carrier Management

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
      - `account_code` (text, unique, not null)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Foreign Key Relationships
    - Add `customer_id` and `carrier_id` to `CustomerCarriers` table
    - Add `customer_id` and `carrier_id` to `Shipments` table
    - Create foreign key constraints linking to new tables

  3. Data Migration
    - Populate customers from existing `CustomerCarriers` and `Shipments` data
    - Populate carriers from existing `CustomerCarriers` and `Shipments` data
    - Update foreign key references in existing tables

  4. Security
    - Enable RLS on new tables
    - Add policies for authenticated users to perform CRUD operations
    - Create indexes for performance
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
  name text NOT NULL,
  scac text,
  mc_number text,
  dot_number text,
  account_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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

-- CRITICAL: Clear any existing invalid UUID values in foreign key columns
UPDATE "CustomerCarriers" SET customer_id = NULL, carrier_id = NULL;
UPDATE "Shipments" SET customer_id = NULL, carrier_id = NULL;

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

-- Also populate customers from Shipments data to capture any additional customers
INSERT INTO customers (name, is_active, created_at, updated_at)
SELECT DISTINCT 
  "Customer" as name,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM "Shipments"
WHERE "Customer" IS NOT NULL 
  AND "Customer" != ''
  AND NOT EXISTS (
    SELECT 1 FROM customers WHERE customers.name = "Shipments"."Customer"
  );

-- Populate carriers table from existing CustomerCarriers data
INSERT INTO carriers (name, scac, account_code, is_active, created_at, updated_at)
SELECT DISTINCT 
  COALESCE(NULLIF("P44CarrierCode", ''), 'Unknown Carrier') as name,
  NULLIF("P44CarrierCode", '') as scac,
  COALESCE(NULLIF("P44CarrierCode", ''), 'UNKNOWN_' || "MarkupId"::text) as account_code,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM "CustomerCarriers"
WHERE "P44CarrierCode" IS NOT NULL 
  AND "P44CarrierCode" != ''
  AND NOT EXISTS (
    SELECT 1 FROM carriers WHERE carriers.account_code = COALESCE(NULLIF("CustomerCarriers"."P44CarrierCode", ''), 'UNKNOWN_' || "CustomerCarriers"."MarkupId"::text)
  );

-- Also populate carriers from Shipments data to capture any additional carriers
INSERT INTO carriers (name, account_code, is_active, created_at, updated_at)
SELECT DISTINCT 
  carrier_name,
  'SHIPMENT_' || ROW_NUMBER() OVER (ORDER BY carrier_name) as account_code,
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
  AND "CustomerCarriers"."InternalName" IS NOT NULL
  AND "CustomerCarriers"."InternalName" != '';

-- Update CustomerCarriers with carrier_id references
UPDATE "CustomerCarriers" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.account_code = COALESCE(NULLIF("CustomerCarriers"."P44CarrierCode", ''), 'UNKNOWN_' || "CustomerCarriers"."MarkupId"::text)
  AND "CustomerCarriers"."P44CarrierCode" IS NOT NULL;

-- Update Shipments with customer_id references
UPDATE "Shipments" 
SET customer_id = customers.id
FROM customers
WHERE customers.name = "Shipments"."Customer"
  AND "Shipments"."Customer" IS NOT NULL
  AND "Shipments"."Customer" != '';

-- Update Shipments with carrier_id references (using Booked Carrier first, then Quoted Carrier)
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.name = COALESCE("Shipments"."Booked Carrier", "Shipments"."Quoted Carrier")
  AND COALESCE("Shipments"."Booked Carrier", "Shipments"."Quoted Carrier") IS NOT NULL
  AND COALESCE("Shipments"."Booked Carrier", "Shipments"."Quoted Carrier") != '';

-- Drop existing foreign key constraints if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customercarriers_customer_id_fkey'
      AND table_name = 'CustomerCarriers'
  ) THEN
    ALTER TABLE "CustomerCarriers" DROP CONSTRAINT customercarriers_customer_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customercarriers_carrier_id_fkey'
      AND table_name = 'CustomerCarriers'
  ) THEN
    ALTER TABLE "CustomerCarriers" DROP CONSTRAINT customercarriers_carrier_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shipments_customer_id_fkey'
      AND table_name = 'Shipments'
  ) THEN
    ALTER TABLE "Shipments" DROP CONSTRAINT shipments_customer_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shipments_carrier_id_fkey'
      AND table_name = 'Shipments'
  ) THEN
    ALTER TABLE "Shipments" DROP CONSTRAINT shipments_carrier_id_fkey;
  END IF;
END $$;

-- Now add foreign key constraints (only after data is properly linked)
ALTER TABLE "CustomerCarriers" 
ADD CONSTRAINT customercarriers_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id);

ALTER TABLE "CustomerCarriers" 
ADD CONSTRAINT customercarriers_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id);

ALTER TABLE "Shipments" 
ADD CONSTRAINT shipments_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id);

ALTER TABLE "Shipments" 
ADD CONSTRAINT shipments_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id);

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_customercarriers_customer_id ON "CustomerCarriers"(customer_id);
CREATE INDEX IF NOT EXISTS idx_customercarriers_carrier_id ON "CustomerCarriers"(carrier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON "Shipments"(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_id ON "Shipments"(carrier_id);

-- Drop existing RLS policies if they exist
DO $$
BEGIN
  -- Drop customers policies
  DROP POLICY IF EXISTS "Customers are viewable by all authenticated users" ON customers;
  DROP POLICY IF EXISTS "Customers are insertable by all authenticated users" ON customers;
  DROP POLICY IF EXISTS "Customers are updatable by all authenticated users" ON customers;
  DROP POLICY IF EXISTS "Customers are deletable by all authenticated users" ON customers;
  
  -- Drop carriers policies
  DROP POLICY IF EXISTS "Carriers are viewable by all authenticated users" ON carriers;
  DROP POLICY IF EXISTS "Carriers are insertable by all authenticated users" ON carriers;
  DROP POLICY IF EXISTS "Carriers are updatable by all authenticated users" ON carriers;
  DROP POLICY IF EXISTS "Carriers are deletable by all authenticated users" ON carriers;
END $$;

-- RLS Policies for customers table
CREATE POLICY "Customers are viewable by all authenticated users"
  ON customers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Customers are insertable by all authenticated users"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Customers are updatable by all authenticated users"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Customers are deletable by all authenticated users"
  ON customers
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for carriers table
CREATE POLICY "Carriers are viewable by all authenticated users"
  ON carriers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Carriers are insertable by all authenticated users"
  ON carriers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Carriers are updatable by all authenticated users"
  ON carriers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Carriers are deletable by all authenticated users"
  ON carriers
  FOR DELETE
  TO authenticated
  USING (true);