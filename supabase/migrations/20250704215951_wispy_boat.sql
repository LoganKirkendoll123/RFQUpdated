/*
  # Create CustomerCarriers table

  1. New Tables
    - `CustomerCarriers` - Stores customer-carrier relationships and markup settings
      - `MarkupId` (bigint, primary key)
      - `CarrierId` (bigint, nullable)
      - `CustomerID` (bigint, nullable)
      - `InternalName` (text, nullable) - Customer name
      - `P44CarrierCode` (text, nullable) - Project44 carrier code
      - `MinDollar` (bigint, nullable) - Minimum dollar amount
      - `MaxDollar` (text, nullable) - Maximum dollar amount
      - `Percentage` (text, nullable) - Markup percentage
      - `customer_id` (uuid, nullable) - Foreign key to customers table
      - `carrier_id` (uuid, nullable) - Foreign key to carriers table
  
  2. Security
    - Enable RLS on `CustomerCarriers` table
    - Add policies for authenticated users to perform CRUD operations
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customercarriers_carrier_id ON public."CustomerCarriers" USING btree (carrier_id);
CREATE INDEX IF NOT EXISTS idx_customercarriers_customer_id ON public."CustomerCarriers" USING btree (customer_id);

-- Enable Row Level Security
ALTER TABLE "CustomerCarriers" ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "CustomerCarriers are viewable by all users" 
  ON "CustomerCarriers" 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "CustomerCarriers are insertable by all users" 
  ON "CustomerCarriers" 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "CustomerCarriers are updatable by all users" 
  ON "CustomerCarriers" 
  FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "CustomerCarriers are deletable by all users" 
  ON "CustomerCarriers" 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Add foreign key constraints
ALTER TABLE "CustomerCarriers"
  ADD CONSTRAINT customercarriers_carrier_id_fkey
  FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT customercarriers_carrier_id_fkey ON "CustomerCarriers" IS 'Foreign key to carriers table. When a carrier is deleted, this field is set to NULL.';

ALTER TABLE "CustomerCarriers"
  ADD CONSTRAINT customercarriers_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id);