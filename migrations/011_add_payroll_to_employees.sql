-- Migration: Add payroll field to employees table
-- Date: 2025-07-01
-- Description: Add payroll (ФОТ) field to store employee salary information

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS payroll NUMERIC(12,2);

-- Add index for better performance on payroll queries
CREATE INDEX IF NOT EXISTS idx_employees_payroll ON employees(payroll);

-- Add comment to describe the field
COMMENT ON COLUMN employees.payroll IS 'Employee payroll amount (ФОТ) - salary information from 1C';