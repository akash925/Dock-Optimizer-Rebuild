-- Migration: Add OCR jobs table for BOL document processing queue
-- Created: 2025-01-24

CREATE TABLE IF NOT EXISTS "ocr_jobs" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "created_at" TIMESTAMP DEFAULT now() NOT NULL,
    "processed_at" TIMESTAMP,
    "retry_count" INTEGER DEFAULT 0,
    "error_message" TEXT,
    CONSTRAINT "ocr_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- Add index for faster status-based queries (for worker polling)
CREATE INDEX IF NOT EXISTS "idx_ocr_jobs_status" ON "ocr_jobs" ("status");

-- Add index for tenant-based queries
CREATE INDEX IF NOT EXISTS "idx_ocr_jobs_tenant_id" ON "ocr_jobs" ("tenant_id");

-- Add index for created_at for cleanup operations
CREATE INDEX IF NOT EXISTS "idx_ocr_jobs_created_at" ON "ocr_jobs" ("created_at"); 