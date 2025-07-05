/*
  # Add live results view for margin analysis

  1. New Views
    - `margin_analysis_live_results` - Shows real-time results grouped by customer during phase one processing
    - `margin_analysis_customer_summary` - Summarizes results by customer for each job

  2. Changes
    - Updates the existing view to include more detailed status information
    - Adds functions to extract and process live results during analysis
*/

-- Create a view to show live results during phase one processing
CREATE OR REPLACE VIEW margin_analysis_live_results AS
SELECT 
  j.id as job_id,
  j.carrier_name,
  j.status,
  j.created_at,
  j.started_at,
  s->'original_shipment'->>'Customer' as customer_name,
  COUNT(*) as shipment_count,
  AVG(CASE 
    WHEN (s->'original_shipment'->>'Carrier Quote')::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 
      (s->'original_shipment'->>'Carrier Quote')::numeric 
    ELSE 0 
  END) as avg_carrier_quote,
  AVG(CASE 
    WHEN (s->'original_shipment'->>'Revenue')::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 
      (s->'original_shipment'->>'Revenue')::numeric 
    ELSE 0 
  END) as avg_revenue,
  SUM(CASE 
    WHEN (s->'original_shipment'->>'Profit')::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 
      (s->'original_shipment'->>'Profit')::numeric 
    ELSE 0 
  END) as total_profit,
  CASE 
    WHEN SUM(CASE 
      WHEN (s->'original_shipment'->>'Carrier Quote')::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 
        (s->'original_shipment'->>'Carrier Quote')::numeric 
      ELSE 0 
    END) > 0 THEN
      (SUM(CASE 
        WHEN (s->'original_shipment'->>'Profit')::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 
          (s->'original_shipment'->>'Profit')::numeric 
        ELSE 0 
      END) / SUM(CASE 
        WHEN (s->'original_shipment'->>'Carrier Quote')::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 
          (s->'original_shipment'->>'Carrier Quote')::numeric 
        ELSE 0 
      END)) * 100
    ELSE 0
  END as current_margin_percentage
FROM 
  "MarginAnalysisJobs" j,
  jsonb_array_elements(COALESCE(j.phase_one_valid_shipments, '[]'::jsonb)) AS s
WHERE 
  s->'original_shipment'->>'Customer' IS NOT NULL
GROUP BY 
  j.id, j.carrier_name, j.status, j.created_at, j.started_at, s->'original_shipment'->>'Customer'
ORDER BY 
  j.created_at DESC, customer_name;

-- Create a summary view for customer results
CREATE OR REPLACE VIEW margin_analysis_customer_summary AS
SELECT 
  job_id,
  carrier_name,
  customer_name,
  shipment_count,
  avg_carrier_quote,
  avg_revenue,
  total_profit,
  current_margin_percentage,
  CASE 
    WHEN current_margin_percentage < 15 THEN 'Low Margin'
    WHEN current_margin_percentage BETWEEN 15 AND 25 THEN 'Target Margin'
    ELSE 'High Margin'
  END as margin_category
FROM 
  margin_analysis_live_results;

-- Update the main view to include processing status details
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
  jsonb_array_length(COALESCE(phase_one_api_calls, '[]'::jsonb)) as phase_one_call_count,
  jsonb_array_length(COALESCE(phase_two_api_calls, '[]'::jsonb)) as phase_two_call_count,
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
  CASE
    WHEN jsonb_array_length(COALESCE(phase_two_api_responses, '[]'::jsonb)) > 0 THEN true
    ELSE false
  END as has_phase_two_data,
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
      jsonb_array_length(COALESCE(phase_one_api_calls, '[]'::jsonb))::float / 
      NULLIF(shipment_count, 0)::float * 100
    WHEN status = 'running' AND first_phase_completed AND second_phase_started_at IS NOT NULL THEN
      jsonb_array_length(COALESCE(phase_two_api_calls, '[]'::jsonb))::float / 
      NULLIF(jsonb_array_length(COALESCE(phase_one_valid_shipments, '[]'::jsonb)), 0)::float * 100
    WHEN first_phase_completed THEN 100
    ELSE 0
  END as progress_percentage
FROM "MarginAnalysisJobs";

-- Create function to get live results for a specific job
CREATE OR REPLACE FUNCTION get_live_job_results(job_id uuid)
RETURNS TABLE (
  customer_name text,
  shipment_count bigint,
  avg_carrier_quote numeric,
  avg_revenue numeric,
  total_profit numeric,
  current_margin_percentage numeric,
  margin_category text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.customer_name,
    r.shipment_count,
    r.avg_carrier_quote,
    r.avg_revenue,
    r.total_profit,
    r.current_margin_percentage,
    r.margin_category
  FROM margin_analysis_customer_summary r
  WHERE r.job_id = get_live_job_results.job_id
  ORDER BY r.shipment_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get the latest job status with progress
CREATE OR REPLACE FUNCTION get_job_status_with_progress(job_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'status', status,
    'phase_status', phase_status,
    'progress_percentage', progress_percentage,
    'shipment_count', shipment_count,
    'valid_shipment_count', valid_shipment_count,
    'started_at', started_at,
    'completed_at', completed_at,
    'first_phase_completed', first_phase_completed,
    'second_phase_started_at', second_phase_started_at,
    'second_phase_completed_at', second_phase_completed_at,
    'customer_list', customer_list
  ) INTO result
  FROM margin_analysis_job_phases
  WHERE id = job_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;