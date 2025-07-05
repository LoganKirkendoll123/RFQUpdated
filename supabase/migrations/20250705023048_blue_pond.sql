/*
  # Update MarginAnalysisJobs for all-customer analysis

  1. Changes
    - Add index on carrier_name for faster lookups
    - Update view to handle all-customer analysis
*/

-- Add index on carrier_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_margin_analysis_jobs_carrier_name
  ON "MarginAnalysisJobs" (carrier_name);

-- Update the view to better handle all-customer analysis
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
  date_range_end
FROM "MarginAnalysisJobs";

-- Create function to get all shipments for a carrier in a date range
CREATE OR REPLACE FUNCTION get_shipments_for_carrier_date_range(
  carrier_name text,
  start_date date,
  end_date date
)
RETURNS TABLE (
  "Invoice #" bigint,
  "Customer" text,
  "Scheduled Pickup Date" text,
  "Zip" text,
  "Zip_1" text,
  "Tot Packages" bigint,
  "Tot Weight" text,
  "Booked Carrier" text,
  "Quoted Carrier" text,
  "Revenue" text,
  "Carrier Quote" text,
  "Profit" text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s."Invoice #",
    s."Customer",
    s."Scheduled Pickup Date",
    s."Zip",
    s."Zip_1",
    s."Tot Packages",
    s."Tot Weight",
    s."Booked Carrier",
    s."Quoted Carrier",
    s."Revenue",
    s."Carrier Quote",
    s."Profit"
  FROM "Shipments" s
  WHERE 
    (s."Booked Carrier" = carrier_name OR s."Quoted Carrier" = carrier_name) AND
    s."Scheduled Pickup Date" >= start_date::text AND
    s."Scheduled Pickup Date" <= end_date::text;
END;
$$ LANGUAGE plpgsql;