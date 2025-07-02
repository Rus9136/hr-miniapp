-- Migration: Add id_iiko column to departments table
-- This column will store IIKO system identifiers in UUID format
-- Example: "0d30c200-87b5-45a5-89f0-eb76e2892b4a"

BEGIN;

-- Add id_iiko column as UUID type (can store standard UUID format)
ALTER TABLE departments 
ADD COLUMN id_iiko UUID;

-- Add comment to document the purpose of this column
COMMENT ON COLUMN departments.id_iiko IS 'IIKO system identifier in UUID format';

-- Create index for efficient lookups by IIKO ID
CREATE INDEX idx_departments_id_iiko ON departments(id_iiko);

-- Update the updated_at timestamp trigger to include the new column
-- (This assumes there's already a trigger for updated_at, which is common)

COMMIT;

-- Success message
SELECT 'Migration 012: id_iiko column added to departments table successfully' as result;