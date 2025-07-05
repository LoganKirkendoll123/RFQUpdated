/*
  # Fix RPC function column references

  1. Functions Updated
    - `get_job_status_with_progress` - Fix column reference from `phase_one_api_calls` to correct column names
    - `get_live_job_results` - Ensure proper column references
    - `store_phase_one_results` - Update to use correct column names
    - `store_phase_two_results` - Update to use correct column names

  2. Changes Made
    - Replace incorrect column references with actual schema column names
    - Ensure all RPC functions work with the existing MarginAnalysisJobs table structure
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_job_status_with_progress(uuid);
DROP FUNCTION IF EXISTS get_live_job_results(uuid);
DROP FUNCTION IF EXISTS store_phase_one_results(uuid, jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS store_phase_two_results(uuid, jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS start_second_phase_analysis(uuid);
DROP FUNCTION IF EXISTS get_valid_phase_one_shipments(uuid);

-- Function to get job status with progress
CREATE OR REPLACE FUNCTION get_job_status_with_progress(job_id uuid)
RETURNS TABLE (
  id uuid,
  customer_name text,
  carrier_name text,
  status text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  shipment_count integer,
  first_phase_completed boolean,
  second_phase_started_at timestamptz,
  second_phase_completed_at timestamptz,
  progress_percentage double precision,
  valid_shipment_count integer,
  phase_one_call_count integer,
  phase_two_call_count integer
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.customer_name,
    j.carrier_name,
    j.status,
    j.created_at,
    j.started_at,
    j.completed_at,
    j.shipment_count,
    j.first_phase_completed,
    j.second_phase_started_at,
    j.second_phase_completed_at,
    CASE 
      WHEN j.shipment_count > 0 THEN 
        COALESCE(
          (jsonb_array_length(COALESCE(j.phase_one_valid_shipments, '[]'::jsonb))::double precision / j.shipment_count::double precision) * 100,
          0
        )
      ELSE 0
    END as progress_percentage,
    COALESCE(jsonb_array_length(j.phase_one_valid_shipments), 0) as valid_shipment_count,
    COALESCE(jsonb_array_length(j.phase_one_api_calls), 0) as phase_one_call_count,
    COALESCE(jsonb_array_length(j.phase_two_api_calls), 0) as phase_two_call_count
  FROM "MarginAnalysisJobs" j
  WHERE j.id = job_id;
END;
$$;

-- Function to get live job results by customer
CREATE OR REPLACE FUNCTION get_live_job_results(job_id uuid)
RETURNS TABLE (
  customer_name text,
  shipment_count bigint,
  avg_carrier_quote numeric,
  avg_revenue numeric,
  total_profit numeric,
  current_margin_percentage numeric,
  margin_category text
) LANGUAGE plpgsql AS $$
DECLARE
  job_record RECORD;
  shipment_record RECORD;
  customer_data RECORD;
BEGIN
  -- Get job details
  SELECT * INTO job_record FROM "MarginAnalysisJobs" WHERE id = job_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return aggregated results by customer from the Shipments table
  -- Filter by the job's date range
  RETURN QUERY
  SELECT 
    s."Customer" as customer_name,
    COUNT(*)::bigint as shipment_count,
    AVG(COALESCE(NULLIF(regexp_replace(s."Carrier Quote", '[^0-9.]', '', 'g'), ''), '0')::numeric) as avg_carrier_quote,
    AVG(COALESCE(NULLIF(regexp_replace(s."Revenue", '[^0-9.]', '', 'g'), ''), '0')::numeric) as avg_revenue,
    SUM(COALESCE(NULLIF(regexp_replace(s."Profit", '[^0-9.]', '', 'g'), ''), '0')::numeric) as total_profit,
    CASE 
      WHEN AVG(COALESCE(NULLIF(regexp_replace(s."Carrier Quote", '[^0-9.]', '', 'g'), ''), '0')::numeric) > 0 THEN
        (SUM(COALESCE(NULLIF(regexp_replace(s."Profit", '[^0-9.]', '', 'g'), ''), '0')::numeric) / 
         SUM(COALESCE(NULLIF(regexp_replace(s."Carrier Quote", '[^0-9.]', '', 'g'), ''), '0')::numeric)) * 100
      ELSE 0
    END as current_margin_percentage,
    CASE 
      WHEN AVG(COALESCE(NULLIF(regexp_replace(s."Carrier Quote", '[^0-9.]', '', 'g'), ''), '0')::numeric) > 0 THEN
        CASE 
          WHEN (SUM(COALESCE(NULLIF(regexp_replace(s."Profit", '[^0-9.]', '', 'g'), ''), '0')::numeric) / 
                SUM(COALESCE(NULLIF(regexp_replace(s."Carrier Quote", '[^0-9.]', '', 'g'), ''), '0')::numeric)) * 100 < 15 THEN 'Low Margin'
          WHEN (SUM(COALESCE(NULLIF(regexp_replace(s."Profit", '[^0-9.]', '', 'g'), ''), '0')::numeric) / 
                SUM(COALESCE(NULLIF(regexp_replace(s."Carrier Quote", '[^0-9.]', '', 'g'), ''), '0')::numeric)) * 100 < 25 THEN 'Target Margin'
          ELSE 'High Margin'
        END
      ELSE 'No Data'
    END as margin_category
  FROM "Shipments" s
  WHERE s."Scheduled Pickup Date" >= job_record.date_range_start::text
    AND s."Scheduled Pickup Date" <= job_record.date_range_end::text
    AND s."Customer" IS NOT NULL
    AND s."Customer" != ''
  GROUP BY s."Customer"
  ORDER BY shipment_count DESC;
END;
$$;

-- Function to store phase one results
CREATE OR REPLACE FUNCTION store_phase_one_results(
  job_id uuid,
  api_calls jsonb,
  valid_shipments jsonb,
  api_responses jsonb,
  rate_data jsonb
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "MarginAnalysisJobs"
  SET 
    phase_one_api_calls = api_calls,
    phase_one_valid_shipments = valid_shipments,
    phase_one_api_responses = api_responses,
    phase_one_rate_data = rate_data,
    first_phase_completed = true,
    status = 'completed'
  WHERE id = job_id;
END;
$$;

-- Function to store phase two results
CREATE OR REPLACE FUNCTION store_phase_two_results(
  job_id uuid,
  api_calls jsonb,
  api_responses jsonb,
  rate_data jsonb,
  discount_analysis jsonb
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "MarginAnalysisJobs"
  SET 
    phase_two_api_calls = api_calls,
    phase_two_api_responses = api_responses,
    phase_two_rate_data = rate_data,
    discount_analysis_data = discount_analysis,
    second_phase_completed_at = now(),
    status = 'completed'
  WHERE id = job_id;
END;
$$;

-- Function to start second phase analysis
CREATE OR REPLACE FUNCTION start_second_phase_analysis(job_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "MarginAnalysisJobs"
  SET 
    second_phase_started_at = now(),
    status = 'running'
  WHERE id = job_id;
END;
$$;

-- Function to get valid shipments from phase one
CREATE OR REPLACE FUNCTION get_valid_phase_one_shipments(job_id uuid)
RETURNS TABLE (
  shipment_id bigint,
  rfq_data jsonb,
  original_shipment jsonb
) LANGUAGE plpgsql AS $$
DECLARE
  job_record RECORD;
BEGIN
  -- Get job details
  SELECT * INTO job_record FROM "MarginAnalysisJobs" WHERE id = job_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return valid shipments from phase one
  RETURN QUERY
  SELECT 
    (shipment->>'shipment_id')::bigint as shipment_id,
    shipment->'rfq_data' as rfq_data,
    shipment->'original_shipment' as original_shipment
  FROM jsonb_array_elements(COALESCE(job_record.phase_one_valid_shipments, '[]'::jsonb)) as shipment;
END;
$$;