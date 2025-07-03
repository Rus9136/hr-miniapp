-- Migration to add hall_area, kitchen_area and seats_count to departments table
-- Author: Claude
-- Date: 2025-07-03

-- Add new columns to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS hall_area numeric,
ADD COLUMN IF NOT EXISTS kitchen_area numeric,
ADD COLUMN IF NOT EXISTS seats_count integer;

-- Add comments to columns for documentation
COMMENT ON COLUMN departments.hall_area IS 'Площадь зала в квадратных метрах';
COMMENT ON COLUMN departments.kitchen_area IS 'Площадь кухни в квадратных метрах';
COMMENT ON COLUMN departments.seats_count IS 'Количество посадочных мест';