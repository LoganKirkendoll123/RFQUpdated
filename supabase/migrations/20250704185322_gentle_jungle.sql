/*
  # Add Carriers Table and Foreign Keys

  1. New Tables
    - `carriers`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `scac` (text)
      - `mc_number` (text)
      - `dot_number` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Changes
    - Add `carrier_id` foreign key to `CustomerCarriers` table
    - Add `carrier_id` foreign key to `Shipments` table
    - Create indexes for performance
  
  3. Security
    - Enable RLS on carriers table
    - Add policies for carriers table
*/

-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  scac text,
  mc_number text,
  dot_number text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add carrier_id to CustomerCarriers
ALTER TABLE "CustomerCarriers" 
ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES carriers(id);

-- Add carrier_id to Shipments
ALTER TABLE "Shipments" 
ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES carriers(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_carriers_name ON carriers(name);
CREATE INDEX IF NOT EXISTS idx_customercarriers_carrier_id ON "CustomerCarriers"(carrier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_id ON "Shipments"(carrier_id);

-- Enable RLS
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;

-- Create policies for carriers table
CREATE POLICY "Carriers visible to all authenticated users"
  ON carriers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert carriers"
  ON carriers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

CREATE POLICY "Only admins can update carriers"
  ON carriers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Create function to migrate carriers from existing data
CREATE OR REPLACE FUNCTION migrate_carriers_from_data()
RETURNS void AS $$
DECLARE
  carrier_record RECORD;
  new_carrier_id uuid;
BEGIN
  -- Create carriers from unique carrier names in CustomerCarriers
  FOR carrier_record IN 
    SELECT DISTINCT "P44CarrierCode" as name
    FROM "CustomerCarriers" 
    WHERE "P44CarrierCode" IS NOT NULL 
    AND "P44CarrierCode" != ''
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