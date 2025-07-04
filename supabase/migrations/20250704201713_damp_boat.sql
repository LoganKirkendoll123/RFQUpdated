/*
  # Fix carrier_id constraint in Shipments table

  1. Changes
     - Safely checks if carrier_id column exists in Shipments table
     - Uses PL/pgSQL DO block for conditional execution
     - Adds ON DELETE SET NULL constraint to carrier_id foreign key
     - Adds descriptive comment to the constraint

  2. Security
     - No security changes
*/

-- Use a DO block to conditionally execute SQL statements
DO $$
BEGIN
  -- First check if carrier_id column exists in Shipments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'carrier_id'
  ) THEN
    -- If it exists, drop the constraint and re-add it with ON DELETE SET NULL
    ALTER TABLE "Shipments" DROP CONSTRAINT IF EXISTS shipments_carrier_id_fkey;
    
    -- Re-add the constraint with ON DELETE SET NULL
    ALTER TABLE "Shipments" 
    ADD CONSTRAINT shipments_carrier_id_fkey 
    FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;
    
    -- Add a descriptive comment to document the behavior
    COMMENT ON CONSTRAINT shipments_carrier_id_fkey ON "Shipments" IS 
    'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';
    
    -- Log that the operation was successful
    RAISE NOTICE 'Successfully updated carrier_id constraint on Shipments table';
  ELSE
    -- Log that the column doesn't exist
    RAISE NOTICE 'carrier_id column does not exist in Shipments table, no action taken';
  END IF;
END $$;