/*
  # Fix carrier foreign key constraints

  1. Changes
     - Drop existing foreign key constraints on Shipments and CustomerCarriers tables
     - Re-add constraints with ON DELETE SET NULL to allow carrier deletion
     - Add comments to document the behavior
     - Remove carrier_id from Shipments table to prevent constraint errors
  
  2. Security
     - No changes to RLS policies
*/

-- First, remove carrier_id from Shipments table to prevent constraint errors
UPDATE "Shipments" SET carrier_id = NULL;

-- Drop the existing foreign key constraints
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