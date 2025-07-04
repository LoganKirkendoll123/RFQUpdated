/*
  # Fix CustomerCarriers table setup

  1. New Tables
    - `CustomerCarriers` (if not exists)
      - `MarkupId` (bigint, primary key)
      - `CarrierId` (bigint)
      - `CustomerID` (bigint)
      - `InternalName` (text)
      - `P44CarrierCode` (text)
      - `MinDollar` (bigint)
      - `MaxDollar` (text)
      - `Percentage` (text)
      - `customer_id` (uuid)
      - `carrier_id` (uuid)

  2. Security
    - Enable RLS on `CustomerCarriers` table
    - Add policies for authenticated users (with IF NOT EXISTS checks)

  3. Changes
    - Create indexes for performance
    - Add foreign key constraints (with existence checks)
*/

-- Create CustomerCarriers table if it doesn't exist
CREATE TABLE IF NOT EXISTS "CustomerCarriers" (
  "MarkupId" bigint PRIMARY KEY,
  "CarrierId" bigint,
  "CustomerID" bigint,
  "InternalName" text,
  "P44CarrierCode" text,
  "MinDollar" bigint,
  "MaxDollar" text,
  "Percentage" text,
  "customer_id" uuid,
  "carrier_id" uuid
);

-- Create indexes for better performance (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'CustomerCarriers' 
    AND indexname = 'idx_customercarriers_carrier_id'
  ) THEN
    CREATE INDEX idx_customercarriers_carrier_id ON public."CustomerCarriers" USING btree (carrier_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'CustomerCarriers' 
    AND indexname = 'idx_customercarriers_customer_id'
  ) THEN
    CREATE INDEX idx_customercarriers_customer_id ON public."CustomerCarriers" USING btree (customer_id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE "CustomerCarriers" ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (with existence checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'CustomerCarriers' 
    AND policyname = 'CustomerCarriers are viewable by all users'
  ) THEN
    CREATE POLICY "CustomerCarriers are viewable by all users" 
      ON "CustomerCarriers" 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'CustomerCarriers' 
    AND policyname = 'CustomerCarriers are insertable by all users'
  ) THEN
    CREATE POLICY "CustomerCarriers are insertable by all users" 
      ON "CustomerCarriers" 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'CustomerCarriers' 
    AND policyname = 'CustomerCarriers are updatable by all users'
  ) THEN
    CREATE POLICY "CustomerCarriers are updatable by all users" 
      ON "CustomerCarriers" 
      FOR UPDATE 
      TO authenticated 
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'CustomerCarriers' 
    AND policyname = 'CustomerCarriers are deletable by all users'
  ) THEN
    CREATE POLICY "CustomerCarriers are deletable by all users" 
      ON "CustomerCarriers" 
      FOR DELETE 
      TO authenticated 
      USING (true);
  END IF;
END $$;

-- Add foreign key constraints (with existence checks)
DO $$
BEGIN
  -- Check if carriers table exists before adding foreign key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carriers') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'customercarriers_carrier_id_fkey'
      AND table_name = 'CustomerCarriers'
    ) THEN
      ALTER TABLE "CustomerCarriers"
        ADD CONSTRAINT customercarriers_carrier_id_fkey
        FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;
      
      COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  -- Check if customers table exists before adding foreign key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'customercarriers_customer_id_fkey'
      AND table_name = 'CustomerCarriers'
    ) THEN
      ALTER TABLE "CustomerCarriers"
        ADD CONSTRAINT customercarriers_customer_id_fkey
        FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;
  END IF;
END $$;