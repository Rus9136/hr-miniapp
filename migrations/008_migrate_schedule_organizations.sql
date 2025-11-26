-- Migration: 008_migrate_schedule_organizations.sql
-- Description: Migrate existing schedule-organization relationships from employee assignments
-- Date: 2025-01-XX
-- Purpose: Populate schedule_organizations table based on existing employee_schedule_assignments

BEGIN;

-- Insert schedule-organization relationships based on employee assignments
-- This finds all unique combinations of schedule_code and organization_bin
-- from employees who have been assigned to schedules
INSERT INTO schedule_organizations (schedule_code, organization_bin)
SELECT DISTINCT
    esa.schedule_code,
    d.object_bin as organization_bin
FROM employee_schedule_assignments esa
JOIN employees e ON esa.employee_id = e.id
JOIN departments d ON e.object_code = d.object_code
WHERE esa.schedule_code IS NOT NULL
    AND d.object_bin IS NOT NULL
    AND d.object_bin != ''
    AND NOT EXISTS (
        -- Avoid duplicates: check if this combination already exists
        SELECT 1 
        FROM schedule_organizations so 
        WHERE so.schedule_code = esa.schedule_code 
        AND so.organization_bin = d.object_bin
    )
ON CONFLICT (schedule_code, organization_bin) DO NOTHING;

-- Log the results
DO $$
DECLARE
    inserted_count INTEGER;
BEGIN
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % schedule-organization relationships', inserted_count;
END $$;

COMMIT;






