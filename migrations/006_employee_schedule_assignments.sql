-- Migration: Create employee_schedule_assignments table
-- Date: 2025-06-04
-- Purpose: Link employees with work schedules from 1C system with history tracking

-- Create table for employee schedule assignments
CREATE TABLE IF NOT EXISTS employee_schedule_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_number VARCHAR(255) NOT NULL,
    schedule_code VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    assigned_by VARCHAR(255) DEFAULT '1C',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- We'll ensure uniqueness through application logic
    -- Simple unique constraint for employee + start_date
    CONSTRAINT unique_employee_start_date UNIQUE(employee_number, start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_employee 
    ON employee_schedule_assignments(employee_number);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_schedule 
    ON employee_schedule_assignments(schedule_code);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_dates 
    ON employee_schedule_assignments(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_active 
    ON employee_schedule_assignments(employee_number, end_date) 
    WHERE end_date IS NULL;

-- Add comments to describe the table
COMMENT ON TABLE employee_schedule_assignments IS 'История назначения графиков работы сотрудникам из системы 1С';
COMMENT ON COLUMN employee_schedule_assignments.employee_id IS 'ID сотрудника в нашей системе';
COMMENT ON COLUMN employee_schedule_assignments.employee_number IS 'Табельный номер сотрудника';
COMMENT ON COLUMN employee_schedule_assignments.schedule_code IS 'Код графика из системы 1С';
COMMENT ON COLUMN employee_schedule_assignments.start_date IS 'Дата начала действия графика';
COMMENT ON COLUMN employee_schedule_assignments.end_date IS 'Дата окончания действия графика (NULL = действует)';
COMMENT ON COLUMN employee_schedule_assignments.assigned_by IS 'Кто назначил график (1C, admin, etc)';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_schedule_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_schedule_assignments_updated_at_trigger
    BEFORE UPDATE ON employee_schedule_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_schedule_assignments_updated_at();

-- Create view for current assignments
CREATE OR REPLACE VIEW current_employee_schedules AS
SELECT 
    esa.id,
    esa.employee_number,
    e.full_name as employee_name,
    esa.schedule_code,
    ws.schedule_name,
    esa.start_date,
    esa.assigned_by,
    esa.created_at
FROM employee_schedule_assignments esa
LEFT JOIN employees e ON esa.employee_id = e.id
LEFT JOIN (
    SELECT DISTINCT schedule_code, schedule_name 
    FROM work_schedules_1c
) ws ON esa.schedule_code = ws.schedule_code
WHERE esa.end_date IS NULL;