/*
  # Fix carrier deletion constraint issue

  1. Changes
     - Add ON DELETE SET NULL to foreign key constraints for carrier_id in Shipments table
     - Add ON DELETE SET NULL to foreign key constraints for carrier_id in CustomerCarriers table
     - This allows deleting carriers even when they're referenced by shipments or customer carriers
     - The references will be set to NULL automatically

  2. Security
     - No changes to RLS policies
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

-- Update the CarrierManagement component to handle this behavior
COMMENT ON CONSTRAINT shipments_carrier_id_fkey ON "Shipments" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';

COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';