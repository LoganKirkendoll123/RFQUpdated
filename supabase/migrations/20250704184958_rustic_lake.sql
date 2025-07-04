/*
  # Add customer_id foreign key to CustomerCarriers table

  1. New Foreign Keys
    - Add foreign key constraint from CustomerCarriers.customer_id to customers.id
  
  2. Changes
    - Ensures CustomerCarriers table has proper relationship to customers table
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CustomerCarriers_customer_id_fkey' 
    AND table_name = 'CustomerCarriers'
  ) THEN
    ALTER TABLE "CustomerCarriers" 
    ADD CONSTRAINT "CustomerCarriers_customer_id_fkey" 
    FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
END $$;