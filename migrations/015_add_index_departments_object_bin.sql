-- Migration: 015_add_index_departments_object_bin.sql
-- Purpose: Add index on departments.object_bin for faster JOIN with schedule_organizations
-- Created: 2025-11-27

-- Index for accelerating JOIN between schedule_organizations and departments
CREATE INDEX IF NOT EXISTS idx_departments_object_bin ON departments(object_bin);

-- Verify index creation
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'departments';
