-- Migration: 007_schedule_organizations.sql
-- Description: Create table for many-to-many relationship between work schedules and organizations
-- Date: 2025-01-XX

BEGIN;

-- Create table for schedule-organization relationships
CREATE TABLE IF NOT EXISTS schedule_organizations (
    id SERIAL PRIMARY KEY,
    schedule_code VARCHAR(255) NOT NULL,
    organization_bin VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique combination of schedule and organization
    CONSTRAINT unique_schedule_organization UNIQUE(schedule_code, organization_bin)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_schedule_organizations_schedule 
    ON schedule_organizations(schedule_code);

CREATE INDEX IF NOT EXISTS idx_schedule_organizations_org 
    ON schedule_organizations(organization_bin);

CREATE INDEX IF NOT EXISTS idx_schedule_organizations_composite 
    ON schedule_organizations(schedule_code, organization_bin);

-- Add comments for documentation
COMMENT ON TABLE schedule_organizations IS 'Связь графиков работы с организациями (many-to-many)';
COMMENT ON COLUMN schedule_organizations.schedule_code IS 'Код графика из системы 1С';
COMMENT ON COLUMN schedule_organizations.organization_bin IS 'БИН организации';
COMMENT ON COLUMN schedule_organizations.created_at IS 'Дата создания связи';

COMMIT;






