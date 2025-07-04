/*
  # Authentication System Setup

  1. New Tables
    - `user_profiles` - Extended user information with roles
    - `customers` - Customer accounts linked to existing data
    - `sales_rep_customers` - Many-to-many relationship between sales reps and customers
    - `pending_registrations` - User registrations awaiting admin approval

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Create functions for user management

  3. Data Migration
    - Create customer accounts from existing CustomerCarriers data
    - Add customer_id foreign keys to existing tables
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'sales_rep', 'customer');

-- Create enum for approval status
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  company_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'US',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  role user_role NOT NULL DEFAULT 'customer',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales rep customers relationship table
CREATE TABLE IF NOT EXISTS sales_rep_customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_rep_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  UNIQUE(sales_rep_id, customer_id)
);

-- Create pending registrations table
CREATE TABLE IF NOT EXISTS pending_registrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  requested_role user_role NOT NULL,
  customer_name text,
  company_name text,
  phone text,
  message text,
  status approval_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

-- Add customer_id to existing tables
ALTER TABLE "CustomerCarriers" 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

ALTER TABLE "Shipments" 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_customer_id ON user_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_rep_customers_sales_rep ON sales_rep_customers(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_sales_rep_customers_customer ON sales_rep_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customercarriers_customer_id ON "CustomerCarriers"(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON "Shipments"(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rep_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies for customers table
CREATE POLICY "Customers visible to all authenticated users"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

CREATE POLICY "Only admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Create policies for user_profiles table
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

CREATE POLICY "Sales reps can view their assigned customers' profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    role = 'customer' AND 
    customer_id IN (
      SELECT customer_id FROM sales_rep_customers 
      WHERE sales_rep_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Create policies for sales_rep_customers table
CREATE POLICY "Sales reps can view their assignments"
  ON sales_rep_customers FOR SELECT
  TO authenticated
  USING (sales_rep_id = auth.uid());

CREATE POLICY "Admins can view all assignments"
  ON sales_rep_customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

CREATE POLICY "Only admins can manage assignments"
  ON sales_rep_customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Create policies for pending_registrations table
CREATE POLICY "Only admins can view pending registrations"
  ON pending_registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

CREATE POLICY "Anyone can insert registration requests"
  ON pending_registrations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Only admins can update registrations"
  ON pending_registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, email, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    'customer', -- Default role
    false -- Requires admin approval
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to create customer from unique names in CustomerCarriers
CREATE OR REPLACE FUNCTION migrate_customers_from_carriers()
RETURNS void AS $$
DECLARE
  customer_record RECORD;
  new_customer_id uuid;
BEGIN
  -- Create customers from unique InternalName values
  FOR customer_record IN 
    SELECT DISTINCT "InternalName" as name
    FROM "CustomerCarriers" 
    WHERE "InternalName" IS NOT NULL 
    AND "InternalName" != ''
  LOOP
    -- Insert customer if not exists
    INSERT INTO customers (name, company_name)
    VALUES (customer_record.name, customer_record.name)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO new_customer_id;
    
    -- Get the customer ID if it already existed
    IF new_customer_id IS NULL THEN
      SELECT id INTO new_customer_id 
      FROM customers 
      WHERE name = customer_record.name;
    END IF;
    
    -- Update CustomerCarriers with customer_id
    UPDATE "CustomerCarriers" 
    SET customer_id = new_customer_id
    WHERE "InternalName" = customer_record.name
    AND customer_id IS NULL;
    
    -- Update Shipments with customer_id
    UPDATE "Shipments" 
    SET customer_id = new_customer_id
    WHERE "Customer" = customer_record.name
    AND customer_id IS NULL;
  END LOOP;
  
  RAISE NOTICE 'Customer migration completed';
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_customers_from_carriers();

-- Create admin user function (to be called manually)
CREATE OR REPLACE FUNCTION create_admin_user(admin_email text)
RETURNS void AS $$
BEGIN
  -- Update user profile to admin if user exists
  UPDATE user_profiles 
  SET 
    role = 'admin',
    is_approved = true,
    approved_at = now()
  WHERE email = admin_email;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'User with email % not found. Please register first, then run this function.', admin_email;
  ELSE
    RAISE NOTICE 'User % has been granted admin privileges', admin_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to approve user registration
CREATE OR REPLACE FUNCTION approve_user_registration(
  user_email text,
  approved_role user_role DEFAULT 'customer',
  assigned_customer_name text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  target_customer_id uuid;
BEGIN
  -- Get customer ID if customer name provided
  IF assigned_customer_name IS NOT NULL THEN
    SELECT id INTO target_customer_id 
    FROM customers 
    WHERE name = assigned_customer_name;
  END IF;
  
  -- Update user profile
  UPDATE user_profiles 
  SET 
    role = approved_role,
    customer_id = target_customer_id,
    is_approved = true,
    approved_by = auth.uid(),
    approved_at = now()
  WHERE email = user_email;
  
  -- Update pending registration
  UPDATE pending_registrations
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE email = user_email;
  
  RAISE NOTICE 'User % approved with role %', user_email, approved_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign customer to sales rep
CREATE OR REPLACE FUNCTION assign_customer_to_sales_rep(
  sales_rep_email text,
  customer_name text
)
RETURNS void AS $$
DECLARE
  sales_rep_id uuid;
  target_customer_id uuid;
BEGIN
  -- Get sales rep ID
  SELECT id INTO sales_rep_id 
  FROM user_profiles 
  WHERE email = sales_rep_email AND role = 'sales_rep';
  
  -- Get customer ID
  SELECT id INTO target_customer_id 
  FROM customers 
  WHERE name = customer_name;
  
  IF sales_rep_id IS NULL THEN
    RAISE EXCEPTION 'Sales rep with email % not found', sales_rep_email;
  END IF;
  
  IF target_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer % not found', customer_name;
  END IF;
  
  -- Insert assignment
  INSERT INTO sales_rep_customers (sales_rep_id, customer_id, assigned_by)
  VALUES (sales_rep_id, target_customer_id, auth.uid())
  ON CONFLICT (sales_rep_id, customer_id) 
  DO UPDATE SET 
    is_active = true,
    assigned_by = auth.uid(),
    assigned_at = now();
  
  RAISE NOTICE 'Customer % assigned to sales rep %', customer_name, sales_rep_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;