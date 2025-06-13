-- Add missing tables and columns to complete schema
-- This migration adds all the tables and columns defined in schema.ts that are missing from the database

-- Add missing columns to existing tables
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS facility_id INTEGER;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS creator_email TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS confirmation_code TEXT;

-- Fix carrier_id to allow NULL (removing NOT NULL constraint if it exists)
ALTER TABLE schedules ALTER COLUMN carrier_id DROP NOT NULL;

-- Add missing columns to facilities table
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Add tenant_id column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Create roles table
CREATE TABLE IF NOT EXISTS "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL UNIQUE,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create tenants table
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL UNIQUE,
	"status" text DEFAULT 'ACTIVE',
	"primary_contact" text,
	"contact_email" text,
	"contact_phone" text,
	"billing_email" text,
	"billing_address" text,
	"subscription" text DEFAULT 'basic',
	"plan_start_date" date,
	"plan_end_date" date,
	"timezone" text DEFAULT 'America/New_York',
	"logo_url" text,
	"settings" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_by" integer
);

-- Create organization_users table
CREATE TABLE IF NOT EXISTS "organization_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	UNIQUE("organization_id", "user_id")
);

-- Create organization_modules table
CREATE TABLE IF NOT EXISTS "organization_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"module_name" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	UNIQUE("organization_id", "module_name")
);

-- Create organization_facilities table
CREATE TABLE IF NOT EXISTS "organization_facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"facility_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	UNIQUE("organization_id", "facility_id")
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"email_schedule_changes" boolean DEFAULT true NOT NULL,
	"email_truck_arrivals" boolean DEFAULT true NOT NULL,
	"email_dock_assignments" boolean DEFAULT true NOT NULL,
	"email_weekly_reports" boolean DEFAULT false NOT NULL,
	"push_notifications_enabled" boolean DEFAULT true NOT NULL,
	"push_urgent_alerts_only" boolean DEFAULT true NOT NULL,
	"push_all_updates" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"module" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	UNIQUE("tenant_id", "module")
);

-- Create file_storage table
CREATE TABLE IF NOT EXISTS "file_storage" (
	"id" text PRIMARY KEY NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"path" text NOT NULL,
	"url" text NOT NULL,
	"folder" text DEFAULT 'general',
	"tenant_id" integer,
	"uploaded_by" integer,
	"is_temporary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create standard_questions table
CREATE TABLE IF NOT EXISTS "standard_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_type_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"order_position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Update custom_questions table to add order_position column if it doesn't exist
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS order_position INTEGER;

-- Update the order column to order_position if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_questions' AND column_name = 'order') THEN
        -- Copy data from order to order_position if order_position is NULL
        UPDATE custom_questions SET order_position = "order" WHERE order_position IS NULL;
        -- Drop the old order column
        ALTER TABLE custom_questions DROP COLUMN IF EXISTS "order";
    END IF;
END $$;

-- Set default values for order_position where it's NULL
UPDATE custom_questions SET order_position = 1 WHERE order_position IS NULL;

-- Make order_position NOT NULL
ALTER TABLE custom_questions ALTER COLUMN order_position SET NOT NULL;

-- Add tenant_id to appointment_types if not exists
ALTER TABLE appointment_types ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Add tenant_id to booking_pages if not exists  
ALTER TABLE booking_pages ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Add foreign key constraints (these will only be added if the columns and referenced tables exist)
DO $$
BEGIN
    -- Add foreign key for schedules.facility_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'schedules_facility_id_fkey') THEN
        ALTER TABLE schedules ADD CONSTRAINT schedules_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES facilities(id);
    END IF;
    
    -- Add foreign key for facilities.tenant_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'facilities_tenant_id_fkey') THEN
        ALTER TABLE facilities ADD CONSTRAINT facilities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
    
    -- Add foreign key for users.tenant_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_tenant_id_fkey') THEN
        ALTER TABLE users ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
    
    -- Add foreign key for appointment_types.tenant_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'appointment_types_tenant_id_fkey') THEN
        ALTER TABLE appointment_types ADD CONSTRAINT appointment_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
    
    -- Add foreign key for booking_pages.tenant_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'booking_pages_tenant_id_fkey') THEN
        ALTER TABLE booking_pages ADD CONSTRAINT booking_pages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
    
    -- Add foreign keys for organization tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_users_organization_id_fkey') THEN
        ALTER TABLE organization_users ADD CONSTRAINT organization_users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_users_user_id_fkey') THEN
        ALTER TABLE organization_users ADD CONSTRAINT organization_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_users_role_id_fkey') THEN
        ALTER TABLE organization_users ADD CONSTRAINT organization_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_modules_organization_id_fkey') THEN
        ALTER TABLE organization_modules ADD CONSTRAINT organization_modules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_facilities_organization_id_fkey') THEN
        ALTER TABLE organization_facilities ADD CONSTRAINT organization_facilities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_facilities_facility_id_fkey') THEN
        ALTER TABLE organization_facilities ADD CONSTRAINT organization_facilities_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'feature_flags_tenant_id_fkey') THEN
        ALTER TABLE feature_flags ADD CONSTRAINT feature_flags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activity_logs_organization_id_fkey') THEN
        ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'standard_questions_appointment_type_id_fkey') THEN
        ALTER TABLE standard_questions ADD CONSTRAINT standard_questions_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'file_storage_tenant_id_fkey') THEN
        ALTER TABLE file_storage ADD CONSTRAINT file_storage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
EXCEPTION
    WHEN others THEN
        -- If any constraint creation fails, log it but continue
        RAISE NOTICE 'Some foreign key constraints could not be created: %', SQLERRM;
END $$;

-- Insert default roles if they don't exist
INSERT INTO roles (name, description) VALUES 
    ('super-admin', 'Super administrator with full system access'),
    ('admin', 'Organization administrator'),
    ('manager', 'Manager with elevated permissions'),
    ('facility-manager', 'Facility manager'),
    ('staff', 'Regular staff member'),
    ('facility-staff', 'Facility staff'),
    ('maintenance', 'Maintenance worker'),
    ('worker', 'General worker')
ON CONFLICT (name) DO NOTHING; 