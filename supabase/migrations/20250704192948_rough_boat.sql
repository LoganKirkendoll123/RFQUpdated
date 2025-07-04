/*
# Customer Carrier Management Schema

1. New Tables
   - None (uses existing tables)

2. Changes
   - Adds RLS policies for customers and carriers tables
   - Adds RLS policies for CustomerCarriers table

3. Security
   - Enables authenticated users to manage customer carrier relationships
*/

-- Add RLS policies for customers table
CREATE POLICY "Customers are viewable by all users"
  ON customers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Customers are insertable by all users"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Customers are updatable by all users"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Customers are deletable by all users"
  ON customers
  FOR DELETE
  TO authenticated
  USING (true);

-- Add RLS policies for carriers table
CREATE POLICY "Carriers are viewable by all users"
  ON carriers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Carriers are insertable by all users"
  ON carriers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Carriers are updatable by all users"
  ON carriers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Carriers are deletable by all users"
  ON carriers
  FOR DELETE
  TO authenticated
  USING (true);

-- Enable RLS on CustomerCarriers table if not already enabled
ALTER TABLE "CustomerCarriers" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for CustomerCarriers table
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