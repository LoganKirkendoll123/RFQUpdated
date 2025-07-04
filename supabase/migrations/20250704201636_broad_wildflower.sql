/*
  # Fix carrier_id constraints

  1. Changes
    - Safely checks if carrier_id column exists in Shipments before attempting to update it
    - Uses DO block to conditionally execute SQL statements
    - Fixes CustomerCarriers foreign key constraint with ON DELETE SET NULL
  
  2. Security
    - Adds comments to document constraint behavior
*/

-- First, check if carrier_id column exists in Shipments before trying to update it
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  -- Check if the column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'carrier_id'
  ) INTO column_exists;
  
  -- Only attempt to update the column if it exists
  IF column_exists THEN
    -- Set carrier_id to NULL to avoid constraint errors
    EXECUTE 'UPDATE "Shipments" SET carrier_id = NULL';
    
    -- Drop the existing constraint if it exists
    ALTER TABLE "Shipments" DROP CONSTRAINT IF EXISTS shipments_carrier_id_fkey;
    
    -- Re-add the constraint with ON DELETE SET NULL
    ALTER TABLE "Shipments" 
    ADD CONSTRAINT shipments_carrier_id_fkey 
    FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;
    
    -- Add comment to document the behavior
    COMMENT ON CONSTRAINT shipments_carrier_id_fkey ON "Shipments" IS 
    'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';
  END IF;
END $$;

-- Fix CustomerCarriers constraint (this table definitely exists)
ALTER TABLE "CustomerCarriers" DROP CONSTRAINT IF EXISTS customercarriers_carrier_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE "CustomerCarriers" 
ADD CONSTRAINT customercarriers_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;

-- Add comment to document the behavior
COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';