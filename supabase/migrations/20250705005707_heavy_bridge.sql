/*
  # Add SCAC column to Shipments table

  1. Changes
     - Add "SCAC" column to the Shipments table to store carrier SCAC codes
     - This allows for better carrier identification and matching with Project44 API
*/

-- Add SCAC column to Shipments table
ALTER TABLE "Shipments" 
ADD COLUMN "SCAC" text;

-- Add comment explaining the purpose of the column
COMMENT ON COLUMN "Shipments"."SCAC" IS 'Standard Carrier Alpha Code - unique identifier for carriers';