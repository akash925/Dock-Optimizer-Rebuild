-- Add compressed image fields for database storage
-- This allows storing compressed images directly in the database instead of S3

-- Add compressed image fields to company_assets table
ALTER TABLE company_assets 
ADD COLUMN compressed_image TEXT,
ADD COLUMN image_metadata JSONB;

-- Add compressed image fields to schedules table for release/checkout photos
ALTER TABLE schedules 
ADD COLUMN release_image TEXT,
ADD COLUMN release_image_metadata JSONB;

-- Add compressed image field to bol_documents table
ALTER TABLE bol_documents 
ADD COLUMN compressed_image TEXT,
ADD COLUMN image_metadata JSONB;

-- Create an index on image metadata for performance
CREATE INDEX IF NOT EXISTS idx_company_assets_image_metadata ON company_assets USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_schedules_release_image_metadata ON schedules USING GIN (release_image_metadata);
CREATE INDEX IF NOT EXISTS idx_bol_documents_image_metadata ON bol_documents USING GIN (image_metadata);

-- Add comments for documentation
COMMENT ON COLUMN company_assets.compressed_image IS 'Base64 encoded compressed image data';
COMMENT ON COLUMN company_assets.image_metadata IS 'Metadata about the compressed image (original size, compression ratio, etc.)';
COMMENT ON COLUMN schedules.release_image IS 'Base64 encoded release/checkout photo';
COMMENT ON COLUMN schedules.release_image_metadata IS 'Metadata about the release image';
COMMENT ON COLUMN bol_documents.compressed_image IS 'Base64 encoded BOL document image';
COMMENT ON COLUMN bol_documents.image_metadata IS 'Metadata about the BOL document image'; 