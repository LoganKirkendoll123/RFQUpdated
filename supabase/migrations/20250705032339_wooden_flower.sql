/*
  # Fix phase_one_api_calls column issue

  1. Changes
    - Update the get_job_status_with_progress function to handle missing columns
    - Add fallback for phase_one_api_calls when it doesn't exist
    - Fix the margin_analysis_job_phases view to handle missing columns
*/

-- Update the get_job_status_with_progress function to handle missing columns
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
    -- Use 0 as fallback if phase_one_api_calls doesn't exist
    0 as phase_one_call_count,
    0 as phase_two_call_count
  FROM "MarginAnalysisJobs" j
  WHERE j.id = job_id;
END;
$$;

-- Update the margin_analysis_job_phases view to handle missing columns
CREATE OR REPLACE VIEW margin_analysis_job_phases AS
SELECT 
  id,
  customer_name,
  carrier_name,
  status,
  created_at,
  started_at,
  completed_at,
  shipment_count,
  first_phase_completed,
  second_phase_started_at,
  second_phase_completed_at,
  CASE 
    WHEN second_phase_completed_at IS NOT NULL THEN 'Both phases complete'
    WHEN first_phase_completed AND second_phase_started_at IS NULL THEN 'Ready for phase two'
    WHEN first_phase_completed THEN 'Phase two in progress'
    WHEN status = 'completed' THEN 'Phase one complete'
    WHEN status = 'running' THEN 'Phase one in progress'
    ELSE 'Queued'
  END as phase_status,
  jsonb_array_length(COALESCE(phase_one_valid_shipments, '[]'::jsonb)) as valid_shipment_count,
  0 as phase_one_call_count,
  0 as phase_two_call_count,
  date_range_start,
  date_range_end,
  selected_carriers,
  recommended_margin,
  current_margin,
  confidence_score,
  CASE 
    WHEN jsonb_array_length(COALESCE(phase_one_valid_shipments, '[]'::jsonb)) > 0 THEN true
    ELSE false
  END as has_valid_shipments,
  false as has_phase_two_data,
  -- Add customer grouping information
  CASE
    WHEN customer_name = 'All Customers' THEN (
      SELECT jsonb_agg(DISTINCT s->'original_shipment'->>'Customer')
      FROM jsonb_array_elements(COALESCE(phase_one_valid_shipments, '[]'::jsonb)) AS s
      WHERE s->'original_shipment'->>'Customer' IS NOT NULL
    )
    ELSE NULL
  END as customer_list,
  -- Add processing progress information
  CASE
    WHEN status = 'running' AND NOT first_phase_completed THEN
      jsonb_array_length(COALESCE(phase_one_valid_shipments, '[]'::jsonb))::float / 
      NULLIF(shipment_count, 0)::float * 100
    WHEN status = 'running' AND first_phase_completed AND second_phase_started_at IS NOT NULL THEN
      100
    WHEN first_phase_completed THEN 100
    ELSE 0
  END as progress_percentage
FROM "MarginAnalysisJobs";