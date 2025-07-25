-- Migration: Restore assets table schema
-- Date: 2025-01-24  
-- Description: Add back all the missing columns that were dropped from assets table in 0001_loose_flatman.sql

-- Add all missing columns to assets table
ALTER TABLE "assets" 
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "file_type" text,
  ADD COLUMN IF NOT EXISTS "file_size" integer,
  ADD COLUMN IF NOT EXISTS "url" text,
  ADD COLUMN IF NOT EXISTS "tags" jsonb,
  ADD COLUMN IF NOT EXISTS "uploaded_by" integer,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now(); 