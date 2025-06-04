-- Migration: 004_work_schedules_1c.sql
-- Description: Create table for work schedules imported from 1C
-- Date: 2025-06-04

BEGIN;

-- Create table for work schedules data from 1C
CREATE TABLE IF NOT EXISTS work_schedules_1c (
    id SERIAL PRIMARY KEY,
    schedule_name VARCHAR(255) NOT NULL,      -- НаименованиеГрафика
    schedule_code VARCHAR(255) NOT NULL,     -- КодГрафика (changed from UUID to VARCHAR for flexibility)
    work_date DATE NOT NULL,                 -- Дата
    work_month DATE NOT NULL,                -- Месяц (as date of first day of month)
    time_type VARCHAR(100) NOT NULL,         -- ВидУчетаВремени
    work_hours INTEGER NOT NULL,             -- ЧасыРаботы (from ДополнительноеЗначение)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT unique_schedule_date UNIQUE(schedule_code, work_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_code 
    ON work_schedules_1c(schedule_code);

CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_date 
    ON work_schedules_1c(work_date);

CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_month 
    ON work_schedules_1c(work_month);

CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_name 
    ON work_schedules_1c(schedule_name);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_schedules_1c_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_schedules_1c_updated_at_trigger
    BEFORE UPDATE ON work_schedules_1c 
    FOR EACH ROW EXECUTE FUNCTION update_work_schedules_1c_updated_at();

-- Add comments for documentation
COMMENT ON TABLE work_schedules_1c IS 'Work schedules data imported from 1C system';
COMMENT ON COLUMN work_schedules_1c.schedule_name IS 'Name of work schedule from 1C (НаименованиеГрафика)';
COMMENT ON COLUMN work_schedules_1c.schedule_code IS 'Unique code of work schedule from 1C (КодГрафика)';
COMMENT ON COLUMN work_schedules_1c.work_date IS 'Work date (Дата)';
COMMENT ON COLUMN work_schedules_1c.work_month IS 'Work month as first day of month (Месяц)';
COMMENT ON COLUMN work_schedules_1c.time_type IS 'Type of time accounting (ВидУчетаВремени)';
COMMENT ON COLUMN work_schedules_1c.work_hours IS 'Number of work hours (ЧасыРаботы)';

COMMIT;