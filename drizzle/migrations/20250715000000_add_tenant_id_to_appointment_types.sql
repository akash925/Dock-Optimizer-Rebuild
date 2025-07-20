-- Add tenant_id column to appointment_types table
ALTER TABLE appointment_types ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Update existing appointment types to associate with their tenant based on facilities
UPDATE appointment_types at
SET tenant_id = (
  SELECT DISTINCT of.organization_id
  FROM organization_facilities of
  WHERE of.facility_id = at.facility_id
  LIMIT 1
)
WHERE at.tenant_id IS NULL;

-- After migration, all appointment types should have their tenant_id set
-- This query will show any appointment types still missing tenant_id for verification
-- SELECT id, name, facility_id FROM appointment_types WHERE tenant_id IS NULL;