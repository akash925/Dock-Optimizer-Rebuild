-- Create bol_documents table
CREATE TABLE bol_documents (
    id            SERIAL PRIMARY KEY,
    schedule_id   INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    file_key      TEXT    NOT NULL,
    file_name     TEXT    NOT NULL,
    mime_type     TEXT    NOT NULL,
    page_count    INTEGER,
    uploaded_by   INTEGER NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Create index on schedule_id for performance
CREATE INDEX idx_bol_schedule ON bol_documents(schedule_id);

-- Create index on uploaded_by for performance  
CREATE INDEX idx_bol_uploaded_by ON bol_documents(uploaded_by);

-- Back-fill SQL block: migrate data from asset_manager table where asset_type='bol'
-- Note: Adjust table names as needed based on actual schema
DO $$
BEGIN
    -- Check if the source tables exist before attempting migration
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_manager') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_assets') THEN
        
        -- Insert BOL documents from asset_manager with matching schedule_assets links
        INSERT INTO bol_documents (schedule_id, file_key, file_name, mime_type, page_count, uploaded_by, created_at)
        SELECT 
            sa.schedule_id,
            am.file_key,
            am.file_name,
            am.mime_type,
            am.page_count,
            am.uploaded_by,
            am.created_at
        FROM asset_manager am
        INNER JOIN schedule_assets sa ON am.id = sa.asset_id
        WHERE am.asset_type = 'bol';
        
        -- Log the number of migrated records
        RAISE NOTICE 'Migrated % BOL documents from asset_manager to bol_documents', 
            (SELECT COUNT(*) FROM asset_manager am 
             INNER JOIN schedule_assets sa ON am.id = sa.asset_id 
             WHERE am.asset_type = 'bol');
             
        -- Clean up: Delete the migrated data from schedule_assets first (foreign key constraint)
        DELETE FROM schedule_assets 
        WHERE asset_id IN (
            SELECT id FROM asset_manager WHERE asset_type = 'bol'
        );
        
        -- Then delete the BOL records from asset_manager
        DELETE FROM asset_manager WHERE asset_type = 'bol';
        
        RAISE NOTICE 'Cleaned up migrated BOL records from asset_manager and schedule_assets tables';
        
    ELSE
        RAISE NOTICE 'Source tables (asset_manager, schedule_assets) not found - skipping backfill migration';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration backfill failed: %', SQLERRM;
        -- Don't fail the entire migration if backfill fails
END $$; 