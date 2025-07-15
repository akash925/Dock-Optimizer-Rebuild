-- Fix appointment_types table ID sequence generation
-- This addresses the null constraint violation when creating appointment types

-- Check if the sequence exists and recreate it if necessary
DO $$
BEGIN
    -- Drop the existing sequence if it exists (it might be corrupted)
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'appointment_types_id_seq') THEN
        DROP SEQUENCE IF EXISTS appointment_types_id_seq CASCADE;
    END IF;
    
    -- Create the sequence with proper start value
    CREATE SEQUENCE appointment_types_id_seq START 1;
    
    -- Set the sequence as the default for the id column
    ALTER TABLE appointment_types ALTER COLUMN id SET DEFAULT nextval('appointment_types_id_seq');
    
    -- Set the sequence ownership to the table column
    ALTER SEQUENCE appointment_types_id_seq OWNED BY appointment_types.id;
    
    -- Update the sequence to start from the maximum existing ID + 1
    -- This ensures we don't have ID conflicts with existing data
    PERFORM setval('appointment_types_id_seq', COALESCE((SELECT MAX(id) FROM appointment_types), 0) + 1, false);
    
    RAISE NOTICE 'Fixed appointment_types ID sequence generation';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error fixing appointment_types sequence: %', SQLERRM;
END $$;

-- Ensure the id column is properly configured as serial
ALTER TABLE appointment_types ALTER COLUMN id SET NOT NULL;

-- Add index on id column if it doesn't exist (should already exist as primary key)
CREATE INDEX IF NOT EXISTS idx_appointment_types_id ON appointment_types(id); 