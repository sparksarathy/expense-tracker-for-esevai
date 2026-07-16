-- e-Sevai Maiyam Income & Expense Manager
-- Administrative Factory Reset SQL Script
-- WARNING: This is destructive and clears all transactional records.

BEGIN;

-- 1. Truncate transaction-related tables
TRUNCATE TABLE income_entries CASCADE;
TRUNCATE TABLE expense_entries CASCADE;

-- 2. Delete transaction-related audit logs while preserving auth and configuration changes
DELETE FROM audit_logs 
WHERE entity_type IN ('income_entries', 'expense_entries')
   OR action IN ('RATE_OVERRIDE');

-- Note: All core system metadata is preserved:
-- - organizations
-- - branches
-- - profiles
-- - approved_users
-- - service_categories (services)
-- - service_rate_history (rate audits)
-- - expense_categories
-- - app_settings

COMMIT;
