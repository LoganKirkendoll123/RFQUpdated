/*
  # Enhanced Live Results View

  1. New Views
    - `margin_analysis_live_results` - Shows real-time results grouped by customer
    - `margin_analysis_customer_summary` - Provides a summary of each customer's data
  
  2. Functions
    - `get_live_job_results` - Fetches live job results with customer grouping
    - `get_job_status_with_progress` - Gets detailed job status with progress information
  
  3. Changes
    - Updated main view to include progress percentage and customer list information
*/

-- Create a view to show live results during phase one processing with enhanced metrics
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

-- Create a summary view for customer results with margin categorization
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

-- Create function to get live results for a specific job with enhanced details
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
  ORDER BY r.current_margin_percentage ASC, r.shipment_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get the latest job status with detailed progress information
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
    'customer_list', customer_list,
    'processed_count', jsonb_array_length(COALESCE(phase_one_api_calls, '[]'::jsonb)),
    'total_count', shipment_count
  ) INTO result
  FROM margin_analysis_job_phases
  WHERE id = job_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;