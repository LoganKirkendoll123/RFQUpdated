/*
  # Add missing columns to Shipments table

  1. New Columns
    - `carrier_name` (text) - Name of the carrier
    - `carrier_scac` (text) - Carrier SCAC code
    - `origin_city` (text) - Origin city name
    - `origin_state` (text) - Origin state
    - `destination_city` (text) - Destination city name
    - `destination_state` (text) - Destination state
    - `freight_class` (text) - Freight classification
    - `service_level` (text) - Service level description
    - `accessorial_services` (text[]) - Array of accessorial services
    - `tracking_number` (text) - Shipment tracking number
    - `pickup_date` (date) - Scheduled pickup date
    - `delivery_date` (date) - Actual delivery date
    - `notes` (text) - Additional notes
    - `temperature` (text) - Temperature requirements for reefer
    - `commodity` (text) - Commodity description
    - `quoted_rate` (numeric) - Initial quoted rate
    - `final_rate` (numeric) - Final agreed rate
    - `transit_days` (integer) - Expected transit days
    - `shipment_status` (text) - Current shipment status
    - `updated_at` (timestamptz) - Last update timestamp

  2. Updates
    - All new columns are nullable to accommodate existing data
    - Set default values where appropriate
*/

-- Add carrier information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'carrier_name'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN carrier_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'carrier_scac'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN carrier_scac text;
  END IF;
END $$;

-- Add location detail columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'origin_city'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN origin_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'origin_state'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN origin_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'destination_city'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN destination_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'destination_state'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN destination_state text;
  END IF;
END $$;

-- Add freight and service columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'freight_class'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN freight_class text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'service_level'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN service_level text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'accessorial_services'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN accessorial_services text[];
  END IF;
END $$;

-- Add commodity and temperature columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'commodity'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN commodity text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'temperature'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN temperature text;
  END IF;
END $$;

-- Add pricing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'quoted_rate'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN quoted_rate numeric(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'final_rate'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN final_rate numeric(10,2);
  END IF;
END $$;

-- Add transit and tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'transit_days'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN transit_days integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN tracking_number text;
  END IF;
END $$;

-- Add status and date columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'shipment_status'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN shipment_status text DEFAULT 'QUOTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'pickup_date'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN pickup_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'delivery_date'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN delivery_date date;
  END IF;
END $$;

-- Add notes and timestamp columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Shipments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "Shipments" ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create an index on commonly queried columns for better performance
CREATE INDEX IF NOT EXISTS idx_shipments_customer_name ON "Shipments"(customer_name);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_name ON "Shipments"(carrier_name);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON "Shipments"(shipment_status);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON "Shipments"(shipment_date);