-- Migration: Add organization_default_hours table
-- This table stores default operating hours for organizations

CREATE TABLE IF NOT EXISTS "organization_default_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"open_time" text DEFAULT '09:00',
	"close_time" text DEFAULT '17:00',
	"break_start" text,
	"break_end" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add unique constraint to prevent duplicate tenant/day combinations
ALTER TABLE "organization_default_hours" ADD CONSTRAINT "organization_default_hours_tenant_day_unique" UNIQUE("tenant_id","day_of_week");

-- Add foreign key constraint to tenants table
ALTER TABLE "organization_default_hours" ADD CONSTRAINT "organization_default_hours_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;

-- Insert default business hours for existing tenants (Monday-Friday 8:00-17:00)
INSERT INTO "organization_default_hours" ("tenant_id", "day_of_week", "is_open", "open_time", "close_time", "break_start", "break_end")
SELECT 
  t.id as tenant_id,
  dow.day_of_week,
  CASE WHEN dow.day_of_week BETWEEN 1 AND 5 THEN true ELSE false END as is_open,
  '08:00' as open_time,
  '17:00' as close_time,
  '12:00' as break_start,
  '13:00' as break_end
FROM tenants t
CROSS JOIN (
  SELECT generate_series(0, 6) as day_of_week
) dow
ON CONFLICT (tenant_id, day_of_week) DO NOTHING; 