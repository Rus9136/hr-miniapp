-- Migration: Add start and end time columns to work_schedules_1c table
-- Date: 2025-06-04
-- Purpose: Store work start and end times from 1C system

-- Add new columns to existing table
ALTER TABLE work_schedules_1c
ADD COLUMN IF NOT EXISTS work_start_time TIME,
ADD COLUMN IF NOT EXISTS work_end_time TIME;

-- Add comment to describe columns
COMMENT ON COLUMN work_schedules_1c.work_start_time IS 'Время начала работы (ВремяНачалоРаботы)';
COMMENT ON COLUMN work_schedules_1c.work_end_time IS 'Время завершения работы (ВремяЗавершениеРаботы)';

-- Create index on new columns for better query performance
CREATE INDEX IF NOT EXISTS idx_work_schedules_1c_times 
ON work_schedules_1c(work_start_time, work_end_time);

-- Update updated_at trigger to handle updates to new columns
-- (The trigger should already exist from previous migration)