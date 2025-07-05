/*
  # Add second phase to margin analysis

  1. New Fields
    - Add `first_phase_completed` boolean to MarginAnalysisJobs
    - Add `second_phase_started_at` and `second_phase_completed_at` timestamps
    - Add `first_phase_data` and `second_phase_data` JSON fields to store results from each phase
    - Add `discount_analysis_data` to store discount patterns found between phases

  2. Changes
    - Update MarginRecommendations to include discount-based fields
    - Add indexes for new fields
*/

-- Add second phase fields to MarginAnalysisJobs
ALTER TABLE "MarginAnalysisJobs" 
  ADD COLUMN IF NOT EXISTS first_phase_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_phase_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS second_phase_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_phase_data jsonb,
  ADD COLUMN IF NOT EXISTS second_phase_data jsonb,
  ADD COLUMN IF NOT EXISTS discount_analysis_data jsonb;

-- Add discount-related fields to MarginRecommendations
ALTER TABLE "MarginRecommendations"
  ADD COLUMN IF NOT EXISTS discount_pattern_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS avg_discount_percentage numeric,
  ADD COLUMN IF NOT EXISTS discount_confidence_score numeric,
  ADD COLUMN IF NOT EXISTS discount_data jsonb;

-- Create index for first_phase_completed to easily find jobs ready for second phase
CREATE INDEX IF NOT EXISTS idx_margin_analysis_jobs_first_phase_completed
  ON "MarginAnalysisJobs" (first_phase_completed)
  WHERE first_phase_completed = true;

-- Create function to find jobs ready for second phase (completed first phase but not started second)
CREATE OR REPLACE FUNCTION get_jobs_ready_for_second_phase()
RETURNS SETOF "MarginAnalysisJobs" AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM "MarginAnalysisJobs"
  WHERE 
    status = 'completed' AND
    first_phase_completed = true AND
    second_phase_started_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to update job for second phase
CREATE OR REPLACE FUNCTION start_second_phase_analysis(job_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE "MarginAnalysisJobs"
  SET 
    second_phase_started_at = now(),
    status = 'running'
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to complete second phase analysis
CREATE OR REPLACE FUNCTION complete_second_phase_analysis(
  job_id uuid,
  second_phase_results jsonb,
  discount_results jsonb
)
RETURNS void AS $$
BEGIN
  UPDATE "MarginAnalysisJobs"
  SET 
    second_phase_completed_at = now(),
    second_phase_data = second_phase_results,
    discount_analysis_data = discount_results,
    status = 'completed'
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;