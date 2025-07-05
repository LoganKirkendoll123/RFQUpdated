/*
  # Update margin analysis view with additional fields

  1. Changes
    - Update the margin_analysis_job_phases view to include additional fields
    - Add customer grouping functionality to the view
    - Add function to get unique customers from shipments
*/

-- Update the view to include more details and customer grouping
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
  END as customer_list
FROM "MarginAnalysisJobs";

-- Create function to get unique customers from a job's shipments
CREATE OR REPLACE FUNCTION get_unique_customers_for_job(job_id uuid)
RETURNS TABLE (customer_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT s->'original_shipment'->>'Customer' as customer_name
  FROM "MarginAnalysisJobs" m,
       jsonb_array_elements(COALESCE(m.phase_one_valid_shipments, '[]'::jsonb)) AS s
  WHERE m.id = job_id
    AND s->'original_shipment'->>'Customer' IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to get shipment data grouped by customer
CREATE OR REPLACE FUNCTION get_customer_shipment_data(job_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  WITH customer_shipments AS (
    SELECT 
      s->'original_shipment'->>'Customer' as customer_name,
      jsonb_agg(s) as shipments
    FROM "MarginAnalysisJobs" m,
         jsonb_array_elements(COALESCE(m.phase_one_valid_shipments, '[]'::jsonb)) AS s
    WHERE m.id = job_id
      AND s->'original_shipment'->>'Customer' IS NOT NULL
    GROUP BY s->'original_shipment'->>'Customer'
  )
  SELECT jsonb_object_agg(customer_name, shipments) INTO result
  FROM customer_shipments;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;