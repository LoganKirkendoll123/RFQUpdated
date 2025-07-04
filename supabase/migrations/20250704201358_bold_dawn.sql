/*
  # Fix carrier_id constraint in Shipments table
  
  1. Changes
    - Removes the attempt to update non-existent carrier_id column in Shipments
    - Adds proper ON DELETE SET NULL constraint for CustomerCarriers table
  
  2. Security
    - No changes to RLS policies
*/

-- First, check if carrier_id column exists in Shipments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'carrier_id'
  ) THEN
    -- If it exists, drop the constraint and re-add it with ON DELETE SET NULL
    ALTER TABLE "Shipments" DROP CONSTRAINT IF EXISTS shipments_carrier_id_fkey;
    
    ALTER TABLE "Shipments" 
    ADD CONSTRAINT shipments_carrier_id_fkey 
    FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;
    
    COMMENT ON CONSTRAINT shipments_carrier_id_fkey ON "Shipments" IS 
    'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';
  END IF;
END $$;

-- Always fix the CustomerCarriers constraint
ALTER TABLE "CustomerCarriers" DROP CONSTRAINT IF EXISTS customercarriers_carrier_id_fkey;

ALTER TABLE "CustomerCarriers" 
ADD CONSTRAINT customercarriers_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';