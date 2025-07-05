/*
  # Fix customer-carrier margin lookup

  1. New Functions
    - `get_customer_carrier_margin`: Retrieves the margin percentage for a specific customer-carrier pair
    - `get_customer_carriers_for_analysis`: Returns all carriers with margins for a specific customer
  
  2. Updates
    - Fixes the margin lookup to use CustomerCarriers table
    - Adds support for retrieving all carrier margins for a customer
*/

-- Function to get the margin percentage for a specific customer-carrier pair
CREATE OR REPLACE FUNCTION get_customer_carrier_margin(
  customer_name text,
  carrier_name text
)
RETURNS numeric AS $$
DECLARE
  margin_percentage numeric;
BEGIN
  -- Look for an exact match first
  SELECT "Percentage"::numeric INTO margin_percentage
  FROM "CustomerCarriers"
  WHERE "InternalName" = customer_name
    AND "P44CarrierCode" = carrier_name;
  
  -- If no exact match, try a partial match on carrier name
  IF margin_percentage IS NULL THEN
    SELECT "Percentage"::numeric INTO margin_percentage
    FROM "CustomerCarriers"
    WHERE "InternalName" = customer_name
      AND position(lower(carrier_name) in lower("P44CarrierCode")) > 0
    LIMIT 1;
  END IF;
  
  -- If still no match, try a partial match the other way
  IF margin_percentage IS NULL THEN
    SELECT "Percentage"::numeric INTO margin_percentage
    FROM "CustomerCarriers"
    WHERE "InternalName" = customer_name
      AND position(lower("P44CarrierCode") in lower(carrier_name)) > 0
    LIMIT 1;
  END IF;
  
  RETURN margin_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to get all carriers with margins for a specific customer
CREATE OR REPLACE FUNCTION get_customer_carriers_for_analysis(
  customer_name text
)
RETURNS TABLE (
  carrier_code text,
  carrier_name text,
  margin_percentage numeric,
  min_dollar numeric,
  max_dollar numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    "P44CarrierCode" as carrier_code,
    "P44CarrierCode" as carrier_name,
    "Percentage"::numeric as margin_percentage,
    "MinDollar"::numeric as min_dollar,
    CASE 
      WHEN "MaxDollar" ~ '^[0-9]+(\.[0-9]+)?$' THEN "MaxDollar"::numeric
      ELSE NULL
    END as max_dollar
  FROM "CustomerCarriers"
  WHERE "InternalName" = customer_name
  ORDER BY "Percentage" DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to apply customer-specific margin to a carrier quote
CREATE OR REPLACE FUNCTION apply_customer_margin(
  customer_name text,
  carrier_name text,
  carrier_quote numeric,
  fallback_margin numeric DEFAULT 23
)
RETURNS TABLE (
  customer_price numeric,
  profit numeric,
  margin_percentage numeric,
  is_customer_specific boolean
) AS $$
DECLARE
  margin numeric;
BEGIN
  -- Get customer-specific margin if available
  margin := get_customer_carrier_margin(customer_name, carrier_name);
  
  -- If no customer-specific margin found, use fallback
  IF margin IS NULL THEN
    margin := fallback_margin;
    RETURN QUERY
    SELECT
      carrier_quote / (1 - (margin / 100)) as customer_price,
      (carrier_quote / (1 - (margin / 100))) - carrier_quote as profit,
      margin as margin_percentage,
      false as is_customer_specific;
  ELSE
    -- Use customer-specific margin
    RETURN QUERY
    SELECT
      carrier_quote / (1 - (margin / 100)) as customer_price,
      (carrier_quote / (1 - (margin / 100))) - carrier_quote as profit,
      margin as margin_percentage,
      true as is_customer_specific;
  END IF;
END;
$$ LANGUAGE plpgsql;