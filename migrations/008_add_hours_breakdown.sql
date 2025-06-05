-- Migration 008: Add planned_hours, actual_hours, overtime_hours columns to time_records
-- Date: 2025-06-04
-- Purpose: Support for planned vs actual hours calculation with overtime tracking

-- Add new columns to time_records table
ALTER TABLE time_records 
ADD COLUMN planned_hours DECIMAL(4,2) DEFAULT NULL,
ADD COLUMN actual_hours DECIMAL(4,2) DEFAULT NULL, 
ADD COLUMN overtime_hours DECIMAL(4,2) DEFAULT 0,
ADD COLUMN has_lunch_break BOOLEAN DEFAULT TRUE,
ADD COLUMN is_scheduled_workday BOOLEAN DEFAULT TRUE;

-- Add comments for documentation
COMMENT ON COLUMN time_records.planned_hours IS 'Planned work hours according to employee schedule';
COMMENT ON COLUMN time_records.actual_hours IS 'Actual hours worked (raw time difference)';
COMMENT ON COLUMN time_records.overtime_hours IS 'Overtime hours beyond scheduled time';
COMMENT ON COLUMN time_records.has_lunch_break IS 'Whether lunch break should be deducted';
COMMENT ON COLUMN time_records.is_scheduled_workday IS 'Whether this date is in employee work schedule';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_time_records_planned_actual 
ON time_records(planned_hours, actual_hours);

-- Update existing records to have default values
UPDATE time_records 
SET 
    actual_hours = hours_worked,
    planned_hours = 8.0,  -- Default 8 hours
    overtime_hours = CASE 
        WHEN hours_worked > 8 THEN hours_worked - 8 
        ELSE 0 
    END
WHERE planned_hours IS NULL;