/*
  # Fix carrier foreign key constraints

  1. Changes
    - Drop existing foreign key constraints that prevent carrier deletion
    - Re-add constraints with ON DELETE SET NULL behavior
    - Update CustomerCarriers constraint to allow carrier deletion

  2. Security
    - Maintains existing RLS policies
    - No changes to table structure, only constraint behavior
*/

-- Drop the existing foreign key constraint on CustomerCarriers table
ALTER TABLE "CustomerCarriers" DROP CONSTRAINT IF EXISTS customercarriers_carrier_id_fkey;

-- Re-add the CustomerCarriers constraint with ON DELETE SET NULL
ALTER TABLE "CustomerCarriers" 
ADD CONSTRAINT customercarriers_carrier_id_fkey 
FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;

-- Add comment to document the behavior
COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 
'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';