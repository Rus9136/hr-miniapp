-- Migration: 015_create_organizations_table.sql
-- Description: Create organizations table with iiko_department_ids (JSONB array)
-- Date: 2025-11-25

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    object_bin VARCHAR(50) UNIQUE NOT NULL,           -- БИН организации (уникальный)
    object_company VARCHAR(255) NOT NULL,             -- Название организации
    iiko_department_ids JSONB DEFAULT '[]'::jsonb,    -- Массив UUID точек продаж из iiko
    is_active BOOLEAN DEFAULT true,                   -- Активна ли организация
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_bin ON organizations(object_bin);
CREATE INDEX IF NOT EXISTS idx_organizations_company ON organizations(object_company);
CREATE INDEX IF NOT EXISTS idx_organizations_iiko_ids ON organizations USING GIN (iiko_department_ids);

-- Comments
COMMENT ON TABLE organizations IS 'Справочник организаций с привязкой к iiko';
COMMENT ON COLUMN organizations.object_bin IS 'БИН организации (уникальный идентификатор)';
COMMENT ON COLUMN organizations.object_company IS 'Название организации';
COMMENT ON COLUMN organizations.iiko_department_ids IS 'Массив UUID точек продаж из iiko в формате ["uuid1", "uuid2"]';
COMMENT ON COLUMN organizations.is_active IS 'Флаг активности организации';

-- Populate table with existing organizations from departments
INSERT INTO organizations (object_bin, object_company, iiko_department_ids)
SELECT DISTINCT
    d.object_bin,
    d.object_company,
    COALESCE(
        (
            SELECT jsonb_agg(DISTINCT sub.id_iiko)
            FROM departments sub
            WHERE sub.object_bin = d.object_bin
              AND sub.id_iiko IS NOT NULL
        ),
        '[]'::jsonb
    ) as iiko_department_ids
FROM departments d
WHERE d.object_bin IS NOT NULL
  AND d.object_company IS NOT NULL
ON CONFLICT (object_bin) DO UPDATE SET
    object_company = EXCLUDED.object_company,
    iiko_department_ids = EXCLUDED.iiko_department_ids,
    updated_at = CURRENT_TIMESTAMP;

-- Verify migration
DO $$
DECLARE
    org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    RAISE NOTICE 'Migration completed: % organizations created', org_count;
END $$;
