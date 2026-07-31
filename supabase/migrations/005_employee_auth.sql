-- EMDPOS Retail OS - Employee Auth Support
-- Updates the signup trigger to handle employee accounts
-- Employees are added to an existing store instead of creating a new one

-- ============================================
-- ADD permissions COLUMN TO store_members
-- ============================================
ALTER TABLE store_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';

-- ============================================
-- UPDATE TRIGGER: Handle employee vs admin signups
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_store_id UUID;
  is_employee BOOLEAN;
  existing_store_id UUID;
  emp_role TEXT;
  emp_permissions JSONB;
BEGIN
  -- Check if this is an employee being added to an existing store
  is_employee := COALESCE((NEW.raw_user_meta_data->>'is_employee')::BOOLEAN, FALSE);
  
  IF is_employee THEN
    -- Get the store_id from user_metadata
    existing_store_id := (NEW.raw_user_meta_data->>'store_id')::UUID;
    emp_role := COALESCE(NEW.raw_user_meta_data->>'role', 'cashier');
    emp_permissions := COALESCE(NEW.raw_user_meta_data->'permissions', '[]'::jsonb);
    
    -- Add the employee to the existing store
    INSERT INTO store_members (store_id, user_id, role, permissions)
    VALUES (existing_store_id, NEW.id, emp_role, emp_permissions)
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;
    
    RETURN NEW;
  END IF;
  
  -- Default: Create a new store for this user (admin/owner signup)
  INSERT INTO stores (name, owner_email)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'store_name', NEW.email), NEW.email)
  RETURNING id INTO new_store_id;

  -- Link the user to the store as admin
  INSERT INTO store_members (store_id, user_id, role, permissions)
  VALUES (new_store_id, NEW.id, 'admin', '["*"]'::jsonb);

  RETURN NEW;
END;
$$;
