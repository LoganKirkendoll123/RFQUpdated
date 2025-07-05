/*
  # Add SCAC column to Shipments table
  
  1. Changes
     - Adds a SCAC (Standard Carrier Alpha Code) column to the Shipments table
     - Adds a descriptive comment explaining the purpose of the column
  
  2. Purpose
     - Enables accurate carrier identification for API calls to Project44
     - Supports carrier matching in margin analysis tools
     - Allows for direct comparison between historical shipments and current rates
*/

-- Add SCAC column to Shipments table
ALTER TABLE "Shipments" 
ADD COLUMN "SCAC" text;

-- Add comment explaining the purpose of the column
COMMENT ON COLUMN "Shipments"."SCAC" IS 'Standard Carrier Alpha Code - unique identifier for carriers';