-- Migration: V20250623_org_holidays.sql
-- Modify existing organization_holidays table to match requirements

-- First, let's check if we need to rename the columns to match requirements
-- Note: tenantId is equivalent to organizationId in this system, date is equivalent to holidayDate

-- Add composite unique index on (tenantId, date) for organization holidays
-- This ensures no duplicate holidays per organization on the same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_holidays_tenant_date 
ON organization_holidays (tenant_id, date);

-- Modify timestamps to be timezone-aware if they aren't already
-- Note: We'll check if this is needed based on current schema
DO $$
BEGIN
    -- Check if createdAt is already timestamptz
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_holidays' 
        AND column_name = 'created_at' 
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE organization_holidays 
        ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
    END IF;
    
    -- Check if updatedAt is already timestamptz
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_holidays' 
        AND column_name = 'updated_at' 
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE organization_holidays 
        ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
    END IF;
END $$;

-- Ensure updated_at has a default value for new records
ALTER TABLE organization_holidays 
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add comment to document the table purpose
COMMENT ON TABLE organization_holidays IS 'Per-organization holiday calendar with US federal holidays seeded by default';
COMMENT ON COLUMN organization_holidays.tenant_id IS 'References organizations(tenants) table - equivalent to organizationId';
COMMENT ON COLUMN organization_holidays.date IS 'Holiday date - equivalent to holidayDate in API'; 