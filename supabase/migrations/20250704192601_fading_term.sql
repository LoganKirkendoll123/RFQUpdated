/*
  # Create customers and carriers tables with relationships

  1. New Tables
    - `customers` - Stores customer information
    - `carriers` - Stores carrier information
  
  2. Relationships
    - Links existing CustomerCarriers and Shipments tables to the new tables
    - Adds foreign key constraints after data migration
  
  3. Indexes
    - Creates appropriate indexes for performance
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
  NULLIF("P44CarrierCode", '') as account_code,
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
  AND "CustomerCarriers"."InternalName" IS NOT NULL
  AND "CustomerCarriers"."InternalName" != '';

-- Update CustomerCarriers with carrier_id references
UPDATE "CustomerCarriers" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.name = COALESCE(NULLIF("CustomerCarriers"."P44CarrierCode", ''), 'Unknown Carrier')
  AND "CustomerCarriers"."P44CarrierCode" IS NOT NULL
  AND "CustomerCarriers"."P44CarrierCode" != '';

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

-- Now add foreign key constraints (only after data is properly linked)
-- Note: We don't enforce NOT NULL on these foreign keys since some records might not have matches
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

-- RLS Policies for carriers table
CREATE POLICY "Carriers visible to all authenticated users"
  ON carriers
  FOR SELECT
  TO authenticated
  USING (true);