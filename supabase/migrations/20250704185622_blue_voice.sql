/*
  # Add P44 Account Code to Carriers Table

  1. Changes
    - Add account_code column to carriers table
    - Update migration function to populate account_code from existing data
*/

-- Add account_code column to carriers table
ALTER TABLE carriers
ADD COLUMN IF NOT EXISTS account_code text;

-- Create index for account_code
CREATE INDEX IF NOT EXISTS idx_carriers_account_code ON carriers(account_code);

-- Update migration function to include account_code
CREATE OR REPLACE FUNCTION migrate_carriers_from_data()
RETURNS void AS $$
DECLARE
  carrier_record RECORD;
  new_carrier_id uuid;
BEGIN
  -- Create carriers from unique carrier names in CustomerCarriers
  FOR carrier_record IN 
    SELECT DISTINCT "P44CarrierCode" as name, "CarrierId" as account_code
    FROM "CustomerCarriers" 
    WHERE "P44CarrierCode" IS NOT NULL 
    AND "P44CarrierCode" != ''
  LOOP
    -- Insert carrier if not exists
    INSERT INTO carriers (name, account_code)
    VALUES (carrier_record.name, carrier_record.account_code)
    ON CONFLICT (name) DO UPDATE
    SET account_code = COALESCE(carriers.account_code, carrier_record.account_code)
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