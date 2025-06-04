-- Migration: Refactor work schedules to use specific dates instead of rules
-- Date: 2025-06-03

-- Start transaction
BEGIN;

-- Drop dependent objects first
DROP VIEW IF EXISTS employee_current_schedules;
DROP FUNCTION IF EXISTS get_employee_schedule_for_date(INTEGER, DATE);

-- Drop existing test data and tables
DELETE FROM employee_schedule_history;
DELETE FROM work_schedule_rules;
DELETE FROM work_schedule_templates;

-- Drop the rules table
DROP TABLE IF EXISTS work_schedule_rules;

-- Remove unnecessary columns and add time fields to templates
ALTER TABLE work_schedule_templates 
    DROP COLUMN IF EXISTS schedule_type,
    DROP COLUMN IF EXISTS cycle_days,
    ADD COLUMN check_in_time TIME NOT NULL DEFAULT '09:00',
    ADD COLUMN check_out_time TIME NOT NULL DEFAULT '18:00';

-- Create new table for specific work dates
CREATE TABLE work_schedule_dates (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES work_schedule_templates(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, work_date)
);

-- Create indexes
CREATE INDEX idx_schedule_dates_template ON work_schedule_dates(template_id);
CREATE INDEX idx_schedule_dates_date ON work_schedule_dates(work_date);

-- Insert test data and get the first template ID
WITH inserted_templates AS (
    INSERT INTO work_schedule_templates (name, description, check_in_time, check_out_time) VALUES
    ('Дневная смена', 'Стандартная дневная смена с 9 до 18', '09:00', '18:00'),
    ('Утренняя смена', 'Ранняя смена с 7 до 15', '07:00', '15:00'),
    ('Вечерняя смена', 'Вечерняя смена с 15 до 23', '15:00', '23:00')
    RETURNING id, name
)
-- Add some test dates for the first schedule (weekdays in June 2025)
INSERT INTO work_schedule_dates (template_id, work_date) 
SELECT 
    (SELECT id FROM inserted_templates WHERE name = 'Дневная смена'),
    date::date
FROM generate_series('2025-06-02'::date, '2025-06-30'::date, '1 day'::interval) date
WHERE EXTRACT(DOW FROM date) NOT IN (0, 6); -- Exclude weekends

COMMIT;