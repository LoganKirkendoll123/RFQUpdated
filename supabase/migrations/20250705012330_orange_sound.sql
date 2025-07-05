/*
  # Create Margin Analysis Tables

  1. New Tables
    - `MarginAnalysisJobs`
      - `id` (uuid, primary key)
      - `customer_name` (text)
      - `carrier_name` (text)
      - `analysis_type` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `started_at` (timestamp)
      - `completed_at` (timestamp)
      - `shipment_count` (integer)
      - `benchmark_data` (jsonb)
      - `comparison_data` (jsonb)
      - `recommended_margin` (numeric)
      - `current_margin` (numeric)
      - `confidence_score` (numeric)
      - `error_message` (text)
      - `date_range_start` (date)
      - `date_range_end` (date)
      - `selected_carriers` (text[])
    
    - `MarginRecommendations`
      - `id` (uuid, primary key)
      - `customer_name` (text)
      - `carrier_name` (text)
      - `current_margin` (numeric)
      - `recommended_margin` (numeric)
      - `confidence_score` (numeric)
      - `potential_revenue_impact` (numeric)
      - `shipment_count` (integer)
      - `avg_shipment_value` (numeric)
      - `margin_variance` (numeric)
      - `last_updated` (timestamp)
      - `applied` (boolean)
      - `applied_at` (timestamp)
      - `applied_by` (text)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create MarginAnalysisJobs table
CREATE TABLE IF NOT EXISTS "MarginAnalysisJobs" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  carrier_name text NOT NULL,
  analysis_type text NOT NULL CHECK (analysis_type IN ('benchmark', 'comparison')),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  shipment_count integer NOT NULL DEFAULT 0,
  benchmark_data jsonb,
  comparison_data jsonb,
  recommended_margin numeric,
  current_margin numeric,
  confidence_score numeric,
  error_message text,
  date_range_start date,
  date_range_end date,
  selected_carriers text[]
);

-- Create MarginRecommendations table
CREATE TABLE IF NOT EXISTS "MarginRecommendations" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  carrier_name text NOT NULL,
  current_margin numeric NOT NULL,
  recommended_margin numeric NOT NULL,
  confidence_score numeric NOT NULL,
  potential_revenue_impact numeric NOT NULL,
  shipment_count integer NOT NULL,
  avg_shipment_value numeric NOT NULL,
  margin_variance numeric NOT NULL,
  last_updated timestamptz NOT NULL DEFAULT now(),
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  applied_by text
);

-- Enable Row Level Security
ALTER TABLE "MarginAnalysisJobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarginRecommendations" ENABLE ROW LEVEL SECURITY;

-- Create policies for MarginAnalysisJobs
CREATE POLICY "MarginAnalysisJobs are viewable by authenticated users"
  ON "MarginAnalysisJobs"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "MarginAnalysisJobs are insertable by authenticated users"
  ON "MarginAnalysisJobs"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "MarginAnalysisJobs are updatable by authenticated users"
  ON "MarginAnalysisJobs"
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create policies for MarginRecommendations
CREATE POLICY "MarginRecommendations are viewable by authenticated users"
  ON "MarginRecommendations"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "MarginRecommendations are insertable by authenticated users"
  ON "MarginRecommendations"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "MarginRecommendations are updatable by authenticated users"
  ON "MarginRecommendations"
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_margin_analysis_jobs_customer_carrier" 
  ON "MarginAnalysisJobs" (customer_name, carrier_name);

CREATE INDEX IF NOT EXISTS "idx_margin_analysis_jobs_status" 
  ON "MarginAnalysisJobs" (status);

CREATE INDEX IF NOT EXISTS "idx_margin_analysis_jobs_date_range" 
  ON "MarginAnalysisJobs" (date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS "idx_margin_recommendations_customer_carrier" 
  ON "MarginRecommendations" (customer_name, carrier_name);

CREATE INDEX IF NOT EXISTS "idx_margin_recommendations_applied" 
  ON "MarginRecommendations" (applied);