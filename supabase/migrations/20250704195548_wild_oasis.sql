/*
  # Fix foreign key constraints for carrier deletion

  1. New Tables
    - No new tables created
  
  2. Changes
    - Drops existing foreign key constraints
    - Re-adds constraints with ON DELETE SET NULL
    - Updates carrier references in Shipments and CustomerCarriers tables
    - Adds comments to document the behavior
  
  3. Security
    - No security changes
*/

-- First, drop the existing foreign key constraints
ALTER TABLE "Shipments" DROP CONSTRAINT IF EXISTS shipments_carrier_id_fkey;
ALTER TABLE "CustomerCarriers" DROP CONSTRAINT IF EXISTS customercarriers_carrier_id_fkey;

-- Re-add the constraints with ON DELETE SET NULL
ALTER TABLE "Shipments" 
ADD CONSTRAINT shipments_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;

ALTER TABLE "CustomerCarriers" 
ADD CONSTRAINT customercarriers_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;

-- Add comments to document the behavior
COMMENT ON CONSTRAINT shipments_carrier_id_fkey ON "Shipments" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';

COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';

-- Update Shipments to use carrier SCAC code for lookup
-- First, update any Shipments where carrier_id is NULL but we have a Booked Carrier or Quoted Carrier
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE "Shipments".carrier_id IS NULL
  AND carriers.scac = "Shipments"."Booked Carrier"
  AND "Shipments"."Booked Carrier" IS NOT NULL
  AND "Shipments"."Booked Carrier" != '';

-- Then try with Quoted Carrier
UPDATE "Shipments" 
SET carrier_id = carriers.id
FROM carriers
WHERE "Shipments".carrier_id IS NULL
  AND carriers.scac = "Shipments"."Quoted Carrier"
  AND "Shipments"."Quoted Carrier" IS NOT NULL
  AND "Shipments"."Quoted Carrier" != '';

-- Update CustomerCarriers to use carrier SCAC code for lookup
UPDATE "CustomerCarriers" 
SET carrier_id = carriers.id
FROM carriers
WHERE "CustomerCarriers".carrier_id IS NULL
  AND carriers.scac = "CustomerCarriers"."P44CarrierCode"
  AND "CustomerCarriers"."P44CarrierCode" IS NOT NULL
  AND "CustomerCarriers"."P44CarrierCode" != '';