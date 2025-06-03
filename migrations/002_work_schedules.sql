-- Migration: 002_work_schedules.sql
-- Description: Create work schedule management tables
-- Date: 2025-01-06

BEGIN;

-- Drop existing basic work_schedules table if exists (will be replaced with more comprehensive solution)
DROP TABLE IF EXISTS work_schedules CASCADE;

-- 1. Work Schedule Templates table
-- Stores different work schedule patterns (e.g., 5/2, 2/2, shift work, etc.)
CREATE TABLE IF NOT EXISTS work_schedule_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('fixed', 'shift', 'flexible', 'custom')),
    cycle_days INTEGER, -- Number of days in a cycle (e.g., 7 for weekly, 14 for bi-weekly)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Work Schedule Rules table
-- Defines the rules for each day in the schedule template
CREATE TABLE IF NOT EXISTS work_schedule_rules (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES work_schedule_templates(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL, -- Day number in the cycle (1 to cycle_days)
    is_workday BOOLEAN DEFAULT TRUE,
    check_in_time TIME,
    check_out_time TIME,
    break_duration_minutes INTEGER DEFAULT 60, -- Lunch break duration
    tolerance_late_minutes INTEGER DEFAULT 15, -- Grace period for being late
    tolerance_early_minutes INTEGER DEFAULT 15, -- Allowed early departure
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_template_day UNIQUE(template_id, day_number),
    CONSTRAINT valid_day_number CHECK (day_number > 0)
);

-- 3. Employee Schedule History table
-- Tracks which schedule template is assigned to each employee and when
CREATE TABLE IF NOT EXISTS employee_schedule_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_number VARCHAR(255) NOT NULL,
    template_id INTEGER REFERENCES work_schedule_templates(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE, -- NULL means currently active
    assigned_by VARCHAR(255), -- Who assigned this schedule
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_schedule_rules_template 
    ON work_schedule_rules(template_id);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_history_employee 
    ON employee_schedule_history(employee_id, employee_number);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_history_dates 
    ON employee_schedule_history(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_history_active 
    ON employee_schedule_history(employee_id, end_date) 
    WHERE end_date IS NULL;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_schedule_templates_updated_at 
    BEFORE UPDATE ON work_schedule_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default schedule templates
INSERT INTO work_schedule_templates (name, description, schedule_type, cycle_days) VALUES
    ('Standard 5/2', 'Monday to Friday, 9:00-18:00, weekends off', 'fixed', 7),
    ('Shift 2/2', 'Two days work, two days off', 'shift', 4),
    ('Shift 3/3', 'Three days work, three days off', 'shift', 6),
    ('24h Shift', '24 hours work, 48 hours off', 'shift', 3),
    ('Flexible', 'Flexible working hours', 'flexible', NULL)
ON CONFLICT DO NOTHING;

-- Insert rules for Standard 5/2 schedule (assuming it gets ID 1)
INSERT INTO work_schedule_rules (template_id, day_number, is_workday, check_in_time, check_out_time) 
SELECT 
    t.id,
    d.day_number,
    CASE 
        WHEN d.day_number IN (6, 7) THEN FALSE 
        ELSE TRUE 
    END as is_workday,
    CASE 
        WHEN d.day_number IN (6, 7) THEN NULL 
        ELSE '09:00'::TIME 
    END as check_in_time,
    CASE 
        WHEN d.day_number IN (6, 7) THEN NULL 
        ELSE '18:00'::TIME 
    END as check_out_time
FROM work_schedule_templates t
CROSS JOIN generate_series(1, 7) as d(day_number)
WHERE t.name = 'Standard 5/2'
ON CONFLICT DO NOTHING;

-- Insert rules for Shift 2/2 schedule
INSERT INTO work_schedule_rules (template_id, day_number, is_workday, check_in_time, check_out_time) 
SELECT 
    t.id,
    d.day_number,
    CASE 
        WHEN d.day_number IN (1, 2) THEN TRUE 
        ELSE FALSE 
    END as is_workday,
    CASE 
        WHEN d.day_number IN (1, 2) THEN '08:00'::TIME 
        ELSE NULL 
    END as check_in_time,
    CASE 
        WHEN d.day_number IN (1, 2) THEN '20:00'::TIME 
        ELSE NULL 
    END as check_out_time
FROM work_schedule_templates t
CROSS JOIN generate_series(1, 4) as d(day_number)
WHERE t.name = 'Shift 2/2'
ON CONFLICT DO NOTHING;

-- Create a view for easier querying of current employee schedules
CREATE OR REPLACE VIEW employee_current_schedules AS
SELECT 
    e.id as employee_id,
    e.table_number as employee_number,
    e.full_name,
    esh.template_id,
    wst.name as schedule_name,
    wst.schedule_type,
    esh.start_date,
    esh.assigned_by
FROM employees e
LEFT JOIN employee_schedule_history esh ON e.id = esh.employee_id AND esh.end_date IS NULL
LEFT JOIN work_schedule_templates wst ON esh.template_id = wst.id;

-- Create a function to get employee's schedule for a specific date
CREATE OR REPLACE FUNCTION get_employee_schedule_for_date(
    p_employee_number VARCHAR(255),
    p_date DATE
) RETURNS TABLE (
    template_id INTEGER,
    schedule_name VARCHAR(255),
    is_workday BOOLEAN,
    check_in_time TIME,
    check_out_time TIME,
    break_duration_minutes INTEGER,
    tolerance_late_minutes INTEGER,
    tolerance_early_minutes INTEGER
) AS $$
DECLARE
    v_template_id INTEGER;
    v_cycle_days INTEGER;
    v_start_date DATE;
    v_day_in_cycle INTEGER;
BEGIN
    -- Find the active schedule template for the employee on the given date
    SELECT 
        esh.template_id,
        wst.cycle_days,
        esh.start_date
    INTO 
        v_template_id,
        v_cycle_days,
        v_start_date
    FROM employee_schedule_history esh
    JOIN work_schedule_templates wst ON esh.template_id = wst.id
    WHERE esh.employee_number = p_employee_number
        AND esh.start_date <= p_date
        AND (esh.end_date IS NULL OR esh.end_date >= p_date)
    ORDER BY esh.start_date DESC
    LIMIT 1;
    
    -- If no schedule found, return NULL
    IF v_template_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Calculate which day in the cycle this date falls on
    IF v_cycle_days IS NOT NULL THEN
        v_day_in_cycle = ((p_date - v_start_date) % v_cycle_days) + 1;
    ELSE
        -- For flexible schedules, use day of week (1=Monday, 7=Sunday)
        v_day_in_cycle = EXTRACT(ISODOW FROM p_date)::INTEGER;
    END IF;
    
    -- Return the schedule rules for this day
    RETURN QUERY
    SELECT 
        wst.id as template_id,
        wst.name as schedule_name,
        wsr.is_workday,
        wsr.check_in_time,
        wsr.check_out_time,
        wsr.break_duration_minutes,
        wsr.tolerance_late_minutes,
        wsr.tolerance_early_minutes
    FROM work_schedule_templates wst
    JOIN work_schedule_rules wsr ON wst.id = wsr.template_id
    WHERE wst.id = v_template_id
        AND wsr.day_number = v_day_in_cycle;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE work_schedule_templates IS 'Stores different work schedule patterns used by employees';
COMMENT ON TABLE work_schedule_rules IS 'Defines working hours and rules for each day in a schedule template';
COMMENT ON TABLE employee_schedule_history IS 'Tracks schedule assignments to employees over time';
COMMENT ON FUNCTION get_employee_schedule_for_date IS 'Returns the work schedule rules for an employee on a specific date';

COMMIT;