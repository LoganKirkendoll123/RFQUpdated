/*
  # Update Margin Analysis for Two-Phase API Calls

  1. Changes
    - Add API call tracking fields to MarginAnalysisJobs
    - Add fields to store API response data for both phases
    - Add fields to track which shipments returned valid rates in phase one
    - Modify functions to support the two-phase API call workflow
  
  2. Security
    - No changes to RLS policies
*/

-- Add API call tracking fields to MarginAnalysisJobs
ALTER TABLE "MarginAnalysisJobs" 
  ADD COLUMN IF NOT EXISTS phase_one_api_calls jsonb,
  ADD COLUMN IF NOT EXISTS phase_two_api_calls jsonb,
  ADD COLUMN IF NOT EXISTS phase_one_valid_shipments jsonb,
  ADD COLUMN IF NOT EXISTS phase_one_api_responses jsonb,
  ADD COLUMN IF NOT EXISTS phase_two_api_responses jsonb,
  ADD COLUMN IF NOT EXISTS phase_one_rate_data jsonb,
  ADD COLUMN IF NOT EXISTS phase_two_rate_data jsonb;

-- Create function to store phase one API call results
CREATE OR REPLACE FUNCTION store_phase_one_results(
  job_id uuid,
  api_calls jsonb,
  valid_shipments jsonb,
  api_responses jsonb,
  rate_data jsonb
)
RETURNS void AS $$
BEGIN
  UPDATE "MarginAnalysisJobs"
  SET 
    phase_one_api_calls = api_calls,
    phase_one_valid_shipments = valid_shipments,
    phase_one_api_responses = api_responses,
    phase_one_rate_data = rate_data,
    first_phase_completed = true,
    completed_at = now(),
    status = 'completed'
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to store phase two API call results
CREATE OR REPLACE FUNCTION store_phase_two_results(
  job_id uuid,
  api_calls jsonb,
  api_responses jsonb,
  rate_data jsonb,
  discount_analysis jsonb
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to get valid shipments from phase one for phase two processing
CREATE OR REPLACE FUNCTION get_valid_phase_one_shipments(job_id uuid)
RETURNS jsonb AS $$
DECLARE
  valid_shipments jsonb;
BEGIN
  SELECT phase_one_valid_shipments INTO valid_shipments
  FROM "MarginAnalysisJobs"
  WHERE id = job_id;
  
  RETURN valid_shipments;
END;
$$ LANGUAGE plpgsql;

-- Create view to show jobs with phase information
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
  jsonb_array_length(COALESCE(phase_two_api_calls, '[]'::jsonb)) as phase_two_call_count
FROM "MarginAnalysisJobs";