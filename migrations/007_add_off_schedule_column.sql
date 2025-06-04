-- Migration 007: Add off_schedule column to time_records table
-- This column will track if employee worked outside their assigned schedule

-- Add off_schedule column to time_records table
ALTER TABLE time_records 
ADD COLUMN off_schedule BOOLEAN DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN time_records.off_schedule IS 'TRUE if employee worked outside their assigned schedule (e.g., on weekend, holiday, or outside normal hours)';

-- Create index for faster queries on off_schedule filtering
CREATE INDEX idx_time_records_off_schedule ON time_records(off_schedule);

-- Update existing records to default FALSE (working within schedule)
UPDATE time_records SET off_schedule = FALSE WHERE off_schedule IS NULL;

-- Make column NOT NULL after setting defaults
ALTER TABLE time_records ALTER COLUMN off_schedule SET NOT NULL;