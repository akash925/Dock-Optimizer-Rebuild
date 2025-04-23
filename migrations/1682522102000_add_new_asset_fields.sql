-- Add new fields to company_assets table
ALTER TABLE "company_assets" 
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "depreciation" TEXT,
  ADD COLUMN IF NOT EXISTS "asset_value" TEXT,
  ADD COLUMN IF NOT EXISTS "manufacturer_part_number" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier_name" TEXT,
  ADD COLUMN IF NOT EXISTS "po_number" TEXT,
  ADD COLUMN IF NOT EXISTS "vendor_information" TEXT,
  ADD COLUMN IF NOT EXISTS "last_maintenance_date" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "next_maintenance_date" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "maintenance_schedule" TEXT,
  ADD COLUMN IF NOT EXISTS "maintenance_contact" TEXT,
  ADD COLUMN IF NOT EXISTS "maintenance_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "implementation_date" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "expected_lifetime" TEXT,
  ADD COLUMN IF NOT EXISTS "certification_date" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "certification_expiry" TIMESTAMP;

-- Rename columns if they exist and need to be renamed
DO $$ 
BEGIN
  -- Check if old column exists and new column doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'company_assets' 
              AND column_name = 'implemented_date') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'company_assets' 
                     AND column_name = 'implementation_date') THEN
    -- Rename column
    ALTER TABLE "company_assets" RENAME COLUMN "implemented_date" TO "implementation_date";
  END IF;

  -- Check if old column exists and new column doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'company_assets' 
              AND column_name = 'last_service_date') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'company_assets' 
                     AND column_name = 'last_maintenance_date') THEN
    -- Rename column
    ALTER TABLE "company_assets" RENAME COLUMN "last_service_date" TO "last_maintenance_date";
  END IF;

  -- Check if old column exists and new column doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'company_assets' 
              AND column_name = 'next_service_date') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'company_assets' 
                     AND column_name = 'next_maintenance_date') THEN
    -- Rename column
    ALTER TABLE "company_assets" RENAME COLUMN "next_service_date" TO "next_maintenance_date";
  END IF;
END $$;