-- Drop asset_manager table if it exists (safely protect production)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'asset_manager') THEN
    ALTER TABLE asset_manager RENAME TO asset_manager_deprecated;
    COMMENT ON TABLE asset_manager_deprecated IS 'Renamed; safe to drop after 30 days';
    
    RAISE NOTICE 'Renamed asset_manager table to asset_manager_deprecated';
  ELSE
    RAISE NOTICE 'asset_manager table does not exist - nothing to do';
  END IF;
END $$; 