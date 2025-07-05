/*
  # Update margin analysis view and functions

  1. Changes
    - Update margin_analysis_job_phases view to include more details
    - Add function to get phase one shipment details
    - Add function to get phase comparison data
    - Add index on carrier_name for faster lookups
*/

-- Update the view to include more details about the analysis
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
  END as has_phase_two_data
FROM "MarginAnalysisJobs";

-- Create function to get detailed phase one shipment information
CREATE OR REPLACE FUNCTION get_phase_one_shipment_details(job_id uuid)
RETURNS jsonb AS $$
DECLARE
  shipment_details jsonb;
BEGIN
  SELECT 
    jsonb_build_object(
      'valid_shipments', phase_one_valid_shipments,
      'api_responses', phase_one_api_responses,
      'rate_data', phase_one_rate_data,
      'shipment_count', shipment_count,
      'carrier_name', carrier_name,
      'date_range', jsonb_build_object(
        'start', date_range_start,
        'end', date_range_end
      )
    ) INTO shipment_details
  FROM "MarginAnalysisJobs"
  WHERE id = job_id;
  
  RETURN shipment_details;
END;
$$ LANGUAGE plpgsql;

-- Create function to get phase comparison data
CREATE OR REPLACE FUNCTION get_phase_comparison_data(job_id uuid)
RETURNS jsonb AS $$
DECLARE
  comparison_data jsonb;
BEGIN
  SELECT 
    jsonb_build_object(
      'phase_one_data', jsonb_build_object(
        'valid_shipments', phase_one_valid_shipments,
        'api_responses', phase_one_api_responses,
        'rate_data', phase_one_rate_data
      ),
      'phase_two_data', jsonb_build_object(
        'api_responses', phase_two_api_responses,
        'rate_data', phase_two_rate_data
      ),
      'discount_analysis', discount_analysis_data,
      'carrier_name', carrier_name,
      'date_range', jsonb_build_object(
        'start', date_range_start,
        'end', date_range_end
      ),
      'shipment_count', shipment_count,
      'valid_shipment_count', jsonb_array_length(COALESCE(phase_one_valid_shipments, '[]'::jsonb)),
      'phase_one_completed_at', completed_at,
      'phase_two_completed_at', second_phase_completed_at
    ) INTO comparison_data
  FROM "MarginAnalysisJobs"
  WHERE id = job_id;
  
  RETURN comparison_data;
END;
$$ LANGUAGE plpgsql;