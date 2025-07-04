/*
  # Fix Carrier Migration

  1. Changes
     - Add account_code column to carriers table
     - Create index for account_code
     - Fix type conversion issues with CarrierId
     - Properly handle NULL values
     - Use explicit variable declaration for account_code_text
  
  2. Security
     - No changes to RLS policies
*/

-- Add account_code column to carriers table if it doesn't exist
ALTER TABLE carriers
ADD COLUMN IF NOT EXISTS account_code text;

-- Create index for account_code if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_carriers_account_code ON carriers(account_code);

-- Create a new migration function with fixed type handling
CREATE OR REPLACE FUNCTION migrate_carriers_from_data()
RETURNS void AS $$
DECLARE
  carrier_record RECORD;
  new_carrier_id uuid;
  account_code_text text;
BEGIN
  -- Create carriers from unique carrier names in CustomerCarriers
  FOR carrier_record IN 
    SELECT DISTINCT 
      "P44CarrierCode" as name, 
      "CarrierId" as carrier_id_num
    FROM "CustomerCarriers" 
    WHERE "P44CarrierCode" IS NOT NULL 
    AND "P44CarrierCode" != ''
  LOOP
    -- Convert CarrierId to text safely
    account_code_text := NULL;
    IF carrier_record.carrier_id_num IS NOT NULL THEN
      account_code_text := carrier_record.carrier_id_num::text;
    END IF;
    
    -- Insert carrier if not exists
    INSERT INTO carriers (name, account_code)
    VALUES (carrier_record.name, account_code_text)
    ON CONFLICT (name) DO UPDATE
    SET account_code = CASE
      WHEN carriers.account_code IS NULL AND account_code_text IS NOT NULL THEN account_code_text
      ELSE carriers.account_code
    END
    RETURNING id INTO new_carrier_id;
    
    -- Get the carrier ID if it already existed
    IF new_carrier_id IS NULL THEN
      SELECT id INTO new_carrier_id 
      FROM carriers 
      WHERE name = carrier_record.name;
    END IF;
    
    -- Update CustomerCarriers with carrier_id
    UPDATE "CustomerCarriers" 
    SET carrier_id = new_carrier_id
    WHERE "P44CarrierCode" = carrier_record.name
    AND carrier_id IS NULL;
  END LOOP;
  
  -- Create carriers from unique carrier names in Shipments (Booked Carrier)
  FOR carrier_record IN 
    SELECT DISTINCT "Booked Carrier" as name
    FROM "Shipments" 
    WHERE "Booked Carrier" IS NOT NULL 
    AND "Booked Carrier" != ''
  LOOP
    -- Insert carrier if not exists
    INSERT INTO carriers (name)
    VALUES (carrier_record.name)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO new_carrier_id;
    
    -- Get the carrier ID if it already existed
    IF new_carrier_id IS NULL THEN
      SELECT id INTO new_carrier_id 
      FROM carriers 
      WHERE name = carrier_record.name;
    END IF;
    
    -- Update Shipments with carrier_id
    UPDATE "Shipments" 
    SET carrier_id = new_carrier_id
    WHERE "Booked Carrier" = carrier_record.name
    AND carrier_id IS NULL;
  END LOOP;
  
  -- Create carriers from unique carrier names in Shipments (Quoted Carrier)
  FOR carrier_record IN 
    SELECT DISTINCT "Quoted Carrier" as name
    FROM "Shipments" 
    WHERE "Quoted Carrier" IS NOT NULL 
    AND "Quoted Carrier" != ''
    AND "Quoted Carrier" != "Booked Carrier"
  LOOP
    -- Insert carrier if not exists
    INSERT INTO carriers (name)
    VALUES (carrier_record.name)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO new_carrier_id;
    
    -- Get the carrier ID if it already existed
    IF new_carrier_id IS NULL THEN
      SELECT id INTO new_carrier_id 
      FROM carriers 
      WHERE name = carrier_record.name;
    END IF;
    
    -- Update Shipments with carrier_id where Quoted Carrier matches but Booked Carrier doesn't
    UPDATE "Shipments" 
    SET carrier_id = new_carrier_id
    WHERE "Quoted Carrier" = carrier_record.name
    AND ("Booked Carrier" IS NULL OR "Booked Carrier" != carrier_record.name)
    AND carrier_id IS NULL;
  END LOOP;
  
  RAISE NOTICE 'Carrier migration completed';
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_carriers_from_data();

-- Drop the migration function after use
DROP FUNCTION migrate_carriers_from_data();