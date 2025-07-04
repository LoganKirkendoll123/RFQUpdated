/*
  # Fix carrier table to use unique P44 account codes

  1. Changes
    - Recreate carriers table with account_code as the primary identifier
    - Populate carriers from CustomerCarriers P44CarrierCode values
    - Update foreign key references in CustomerCarriers and Shipments
  
  2. Security
    - Maintain existing RLS policies
*/

-- First, clear any existing carrier_id references to avoid constraint issues
UPDATE "CustomerCarriers" SET carrier_id = NULL;
UPDATE "Shipments" SET carrier_id = NULL;

-- Create a temporary table to store existing carrier data
CREATE TEMP TABLE temp_carriers AS
SELECT * FROM carriers;

-- Drop existing carriers table
DROP TABLE IF EXISTS carriers CASCADE;

-- Recreate carriers table with account_code as the primary identifier
CREATE TABLE carriers (
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
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_carriers_name ON carriers(name);
CREATE INDEX idx_carriers_account_code ON carriers(account_code);

-- Populate carriers table from CustomerCarriers P44CarrierCode values
INSERT INTO carriers (name, scac, account_code, is_active, created_at, updated_at)
SELECT DISTINCT 
  COALESCE("P44CarrierCode", 'Unknown Carrier') as name,
  CASE WHEN LENGTH("P44CarrierCode") = 4 THEN "P44CarrierCode" ELSE NULL END as scac,
  "P44CarrierCode" as account_code,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM "CustomerCarriers"
WHERE "P44CarrierCode" IS NOT NULL 
  AND "P44CarrierCode" != ''
ON CONFLICT (account_code) DO NOTHING;

-- Also populate carriers from Shipments data for any carriers not in CustomerCarriers
-- We'll use the carrier name as the account_code for these since we don't have a better identifier
INSERT INTO carriers (name, account_code, is_active, created_at, updated_at)
SELECT DISTINCT 
  carrier_name as name,
  carrier_name as account_code,
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
)
ON CONFLICT (account_code) DO NOTHING;

-- Update CustomerCarriers with carrier_id references based on P44CarrierCode
UPDATE "CustomerCarriers" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.account_code = "CustomerCarriers"."P44CarrierCode"
  AND "CustomerCarriers"."P44CarrierCode" IS NOT NULL
  AND "CustomerCarriers"."P44CarrierCode" != '';

-- Update Shipments with carrier_id references
-- First try to match on exact carrier name to account_code
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.account_code = "Shipments"."Booked Carrier"
  AND "Shipments"."Booked Carrier" IS NOT NULL
  AND "Shipments"."Booked Carrier" != '';

-- Then try to match on carrier name to name
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.name = "Shipments"."Booked Carrier"
  AND "Shipments".carrier_id IS NULL
  AND "Shipments"."Booked Carrier" IS NOT NULL
  AND "Shipments"."Booked Carrier" != '';

-- Try the same with Quoted Carrier for any remaining unmatched shipments
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.account_code = "Shipments"."Quoted Carrier"
  AND "Shipments".carrier_id IS NULL
  AND "Shipments"."Quoted Carrier" IS NOT NULL
  AND "Shipments"."Quoted Carrier" != '';

UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE carriers.name = "Shipments"."Quoted Carrier"
  AND "Shipments".carrier_id IS NULL
  AND "Shipments"."Quoted Carrier" IS NOT NULL
  AND "Shipments"."Quoted Carrier" != '';

-- Add RLS policies for carriers table
CREATE POLICY "Carriers are viewable by all users"
  ON carriers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Carriers are insertable by all users"
  ON carriers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Carriers are updatable by all users"
  ON carriers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Carriers are deletable by all users"
  ON carriers
  FOR DELETE
  TO authenticated
  USING (true);