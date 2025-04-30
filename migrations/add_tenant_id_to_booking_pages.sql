-- Add tenant_id column to booking_pages table
ALTER TABLE booking_pages ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Update existing booking pages to associate with their tenant based on facilities
UPDATE booking_pages bp
SET tenant_id = (
  SELECT DISTINCT of.organization_id
  FROM organization_facilities of
  JOIN jsonb_array_elements_text(bp.facilities) AS f ON of.facility_id::text = f
  LIMIT 1
)
WHERE bp.tenant_id IS NULL;

-- After migration, all booking pages should have their tenant_id set
-- This query will show any booking pages still missing tenant_id for verification
-- SELECT id, name, facilities FROM booking_pages WHERE tenant_id IS NULL;