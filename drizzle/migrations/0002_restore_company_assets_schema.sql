-- Migration: Restore company_assets table schema
-- Date: 2025-01-24
-- Description: Add back all the missing columns that were dropped in 0001_loose_flatman.sql

-- Add all missing columns to company_assets table
ALTER TABLE "company_assets" 
  ADD COLUMN IF NOT EXISTS "manufacturer" text,
  ADD COLUMN IF NOT EXISTS "owner" text,
  ADD COLUMN IF NOT EXISTS "department" text,
  ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'EQUIPMENT',
  ADD COLUMN IF NOT EXISTS "serial_number" text,
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "purchase_price" text,
  ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "purchase_date" date,
  ADD COLUMN IF NOT EXISTS "warranty_expiration" date,
  ADD COLUMN IF NOT EXISTS "depreciation" text,
  ADD COLUMN IF NOT EXISTS "asset_value" text,
  ADD COLUMN IF NOT EXISTS "location" text DEFAULT 'WAREHOUSE',
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "template" text,
  ADD COLUMN IF NOT EXISTS "tags" jsonb,
  ADD COLUMN IF NOT EXISTS "model" text,
  ADD COLUMN IF NOT EXISTS "condition" text,
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "manufacturer_part_number" text,
  ADD COLUMN IF NOT EXISTS "supplier_name" text,
  ADD COLUMN IF NOT EXISTS "po_number" text,
  ADD COLUMN IF NOT EXISTS "vendor_information" text,
  ADD COLUMN IF NOT EXISTS "photo_url" text,
  ADD COLUMN IF NOT EXISTS "document_urls" jsonb,
  ADD COLUMN IF NOT EXISTS "last_maintenance_date" date,
  ADD COLUMN IF NOT EXISTS "next_maintenance_date" date,
  ADD COLUMN IF NOT EXISTS "maintenance_schedule" text,
  ADD COLUMN IF NOT EXISTS "maintenance_contact" text,
  ADD COLUMN IF NOT EXISTS "maintenance_notes" text,
  ADD COLUMN IF NOT EXISTS "expected_lifetime" text,
  ADD COLUMN IF NOT EXISTS "certification_date" date,
  ADD COLUMN IF NOT EXISTS "certification_expiry" date,
  ADD COLUMN IF NOT EXISTS "created_by" integer,
  ADD COLUMN IF NOT EXISTS "updated_by" integer;

-- Update the tenant_id foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'company_assets_tenant_id_tenants_id_fk'
    AND table_name = 'company_assets'
  ) THEN
    ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
  END IF;
END $$; 