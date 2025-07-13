-- Migration to add trade_point column to departments table
-- Author: Claude
-- Date: 2025-07-04

-- Add trade_point column to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS trade_point text;

-- Add comment to column for documentation
COMMENT ON COLUMN departments.trade_point IS 'Торговая точка/адрес подразделения';