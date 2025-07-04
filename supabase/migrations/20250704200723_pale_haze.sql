/*
  # Add P44 group to carriers and update carrier display name

  1. New Fields
    - `p44_group` (text) - Project44 carrier group code
    - `display_name` (text) - Friendly display name for the carrier

  2. Changes
    - Add new columns to carriers table
    - Update existing carriers with default values
    - Create indexes for efficient lookups
*/

-- Add new columns to carriers table
ALTER TABLE carriers 
ADD COLUMN IF NOT EXISTS p44_group text,
ADD COLUMN IF NOT EXISTS display_name text;

-- Update display_name with name if it's NULL
UPDATE carriers
SET display_name = name
WHERE display_name IS NULL;

-- Create index on p44_group for efficient lookups
CREATE INDEX IF NOT EXISTS idx_carriers_p44_group ON carriers(p44_group);

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN carriers.p44_group IS 'Project44 carrier group code for API requests';
COMMENT ON COLUMN carriers.display_name IS 'User-friendly display name for the carrier';