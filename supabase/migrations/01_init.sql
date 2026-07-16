-- e-Sevai Maiyam Income & Expense Manager
-- Database Migrations for Supabase PostgreSQL (Phase 2)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at automatic trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata' NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 2. Branches table
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);

CREATE TRIGGER update_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 3. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- references auth.users(id) in Supabase
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) CHECK (role IN ('owner', 'employee')) DEFAULT 'employee' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 4. Approved Users table
CREATE TABLE IF NOT EXISTS approved_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) CHECK (role IN ('owner', 'employee')) DEFAULT 'employee' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    invited_by UUID, -- references profiles(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approved_email ON approved_users(email);

CREATE TRIGGER update_approved_users_updated_at
    BEFORE UPDATE ON approved_users
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 5. Service Categories table
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    default_rate DECIMAL(12, 2) DEFAULT 0.00 NOT NULL CHECK (default_rate >= 0),
    is_active BOOLEAN DEFAULT true NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_categories_org ON service_categories(organization_id);

CREATE TRIGGER update_service_categories_updated_at
    BEFORE UPDATE ON service_categories
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 6. Income Entries table
CREATE TABLE IF NOT EXISTS income_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    service_category_id UUID REFERENCES service_categories(id) ON DELETE RESTRICT NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('GPay', 'Cash in Hand')) NOT NULL,
    service_rate DECIMAL(12, 2) NOT NULL CHECK (service_rate > 0),
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_income_org ON income_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_income_branch ON income_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_income_employee ON income_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON income_entries(transaction_date);

CREATE TRIGGER update_income_entries_updated_at
    BEFORE UPDATE ON income_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 7. Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_org ON expense_categories(organization_id);

CREATE TRIGGER update_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 8. Expense Entries table
CREATE TABLE IF NOT EXISTS expense_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    expense_category_id UUID REFERENCES expense_categories(id) ON DELETE RESTRICT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) CHECK (payment_method IN ('GPay', 'Cash in Hand', 'Bank Transfer', 'Other')) NOT NULL,
    transaction_date DATE NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_expense_org ON expense_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_expense_branch ON expense_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_expense_employee ON expense_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_date ON expense_entries(transaction_date);

CREATE TRIGGER update_expense_entries_updated_at
    BEFORE UPDATE ON expense_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 9. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- 10. App Settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
    allow_employee_editing BOOLEAN DEFAULT true NOT NULL,
    employee_editing_limit_hours INT DEFAULT 24 NOT NULL,
    require_expense_receipt BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    profile_data JSONB;
BEGIN
    SELECT json_build_object('org_id', organization_id, 'role', role, 'is_active', is_active)
    INTO profile_data
    FROM profiles
    WHERE id = user_id;
    RETURN profile_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. Organizations Policies
CREATE POLICY "Users can view their own organization"
    ON organizations FOR SELECT
    USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true));

CREATE POLICY "Owners can update their own organization"
    ON organizations FOR UPDATE
    USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));

-- 2. Branches Policies
CREATE POLICY "Users can view their organization's branches"
    ON branches FOR SELECT
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true));

CREATE POLICY "Owners can manage branches"
    ON branches FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));

-- 3. Profiles Policies
CREATE POLICY "Users can view profiles in their organization"
    ON profiles FOR SELECT
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true));

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid() AND is_active = true)
    WITH CHECK (role = (SELECT role FROM profiles WHERE id = auth.uid())); -- Prevent self role-elevation

CREATE POLICY "Owners can manage all profiles in organization"
    ON profiles FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));

-- 4. Approved Users Policies
CREATE POLICY "Owners can view and manage approved users in organization"
    ON approved_users FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));

-- 5. Service Categories Policies
CREATE POLICY "Users can view service categories"
    ON service_categories FOR SELECT
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true));

CREATE POLICY "Owners can manage service categories"
    ON service_categories FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));

-- 6. Income Entries Policies
CREATE POLICY "Employees can view their own income entries"
    ON income_entries FOR SELECT
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
            OR employee_id = auth.uid()
        )
    );

CREATE POLICY "Employees can insert their own income entries"
    ON income_entries FOR INSERT
    WITH CHECK (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
            OR (employee_id = auth.uid() AND created_by = auth.uid())
        )
    );

CREATE POLICY "Users can update income entries based on limits"
    ON income_entries FOR UPDATE
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
            OR (
                employee_id = auth.uid()
                AND (
                    SELECT allow_employee_editing FROM app_settings WHERE organization_id = income_entries.organization_id
                ) = true
                AND created_at >= (now() - (SELECT employee_editing_limit_hours FROM app_settings WHERE organization_id = income_entries.organization_id) * interval '1 hour')
            )
        )
    );

CREATE POLICY "Owners can delete income entries"
    ON income_entries FOR DELETE
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true)
    );

-- 7. Expense Categories Policies
CREATE POLICY "Users can view expense categories"
    ON expense_categories FOR SELECT
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true));

CREATE POLICY "Owners can manage expense categories"
    ON expense_categories FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));

-- 8. Expense Entries Policies
CREATE POLICY "Employees can view their own expense entries"
    ON expense_entries FOR SELECT
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
            OR employee_id = auth.uid()
        )
    );

CREATE POLICY "Employees can insert their own expense entries"
    ON expense_entries FOR INSERT
    WITH CHECK (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
            OR (employee_id = auth.uid() AND created_by = auth.uid())
        )
    );

CREATE POLICY "Users can update expense entries based on limits"
    ON expense_entries FOR UPDATE
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
            OR (
                employee_id = auth.uid()
                AND (
                    SELECT allow_employee_editing FROM app_settings WHERE organization_id = expense_entries.organization_id
                ) = true
                AND created_at >= (now() - (SELECT employee_editing_limit_hours FROM app_settings WHERE organization_id = expense_entries.organization_id) * interval '1 hour')
            )
        )
    );

CREATE POLICY "Owners can delete expense entries"
    ON expense_entries FOR DELETE
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true)
    );

-- 9. Audit Logs Policies
CREATE POLICY "Owners can view audit logs"
    ON audit_logs FOR SELECT
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true)
    );

-- 10. App Settings Policies
CREATE POLICY "Users can view app settings"
    ON app_settings FOR SELECT
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true));

CREATE POLICY "Owners can update app settings"
    ON app_settings FOR UPDATE
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'owner' AND is_active = true));


-- ==========================================
-- SEED DATA
-- ==========================================

-- Standard sample setup helper to run in a fresh database
-- NOTE: In a production Supabase setup, you would manually run these seeds.

-- 1. Create a default organization
-- INSERT INTO organizations (id, name, timezone, currency) VALUES ('88888888-8888-4888-a888-888888888888', 'e-Sevai Maiyam India', 'Asia/Kolkata', 'INR');

-- 2. Create a default branch
-- INSERT INTO branches (id, organization_id, name, is_active) VALUES ('77777777-7777-4777-a777-777777777777', '88888888-8888-4888-a888-888888888888', 'Main Branch', true);

-- 3. App Settings
-- INSERT INTO app_settings (organization_id, allow_employee_editing, employee_editing_limit_hours, require_expense_receipt)
-- VALUES ('88888888-8888-4888-a888-888888888888', true, 24, false);
