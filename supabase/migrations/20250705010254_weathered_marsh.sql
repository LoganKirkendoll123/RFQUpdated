/*
  # Add SCAC column to Shipments table

  1. Changes
    - Add SCAC column to Shipments table if it doesn't already exist
    - Add comment explaining the purpose of the column

  2. Security
    - No RLS changes needed as this is just adding a column
*/

-- Add SCAC column to Shipments table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'SCAC'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN "SCAC" text;
  END IF;
END $$;

-- Add comment explaining the purpose of the column
COMMENT ON COLUMN "Shipments"."SCAC" IS 'Standard Carrier Alpha Code - unique identifier for carriers';