/*
  # Add customer preferences table
  
  1. New Tables
    - `customer_preferences`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `preference_name` (text)
      - `preference_value` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `customer_preferences` table
    - Add policy for authenticated users to manage their customer preferences
*/

-- Create customer preferences table
CREATE TABLE IF NOT EXISTS customer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  preference_name text NOT NULL,
  preference_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer_id ON customer_preferences(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_preferences_unique ON customer_preferences(customer_id, preference_name);

-- Enable row level security
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Customer preferences are viewable by all authenticated users"
  ON customer_preferences
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Customer preferences are insertable by all authenticated users"
  ON customer_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Customer preferences are updatable by all authenticated users"
  ON customer_preferences
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Customer preferences are deletable by all authenticated users"
  ON customer_preferences
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comment to table
COMMENT ON TABLE customer_preferences IS 'Stores customer-specific preferences for the application';