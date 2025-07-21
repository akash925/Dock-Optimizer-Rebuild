CREATE TABLE "appointment_bol_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"bol_document_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bol_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer,
	"file_key" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"page_count" integer,
	"compressed_image" text,
	"image_metadata" jsonb,
	"original_file_name" text,
	"file_path" text,
	"file_size" integer,
	"tenant_id" integer,
	"ocr_data" jsonb,
	"parsed_data" jsonb,
	"ocr_status" text,
	"updated_at" timestamp,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"open_time" text DEFAULT '08:00',
	"close_time" text DEFAULT '17:00',
	"break_start" text,
	"break_end" text
);
--> statement-breakpoint
CREATE TABLE "ocr_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"file_key" text NOT NULL,
	"raw_text" text,
	"parsed_data" jsonb,
	"backend" text DEFAULT 'tesseract',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"source_asset_id" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_default_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text DEFAULT '08:00',
	"end_time" text DEFAULT '17:00',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"facility_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_facilities_organization_id_facility_id_unique" UNIQUE("organization_id","facility_id")
);
--> statement-breakpoint
CREATE TABLE "organization_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"holiday_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"module_name" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_modules_organization_id_module_name_unique" UNIQUE("organization_id","module_name")
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_users_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_type_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"order_position" integer NOT NULL,
	"options" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL,
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
	"settings" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "custom_questions" ALTER COLUMN "type" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "custom_questions" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_availability" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_availability" ALTER COLUMN "end_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "carrier_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_types" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "booking_pages" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "company_assets" ADD COLUMN "implemented_date" date;--> statement-breakpoint
ALTER TABLE "company_assets" ADD COLUMN "last_service_date" date;--> statement-breakpoint
ALTER TABLE "company_assets" ADD COLUMN "next_service_date" date;--> statement-breakpoint
ALTER TABLE "company_assets" ADD COLUMN "tenant_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_questions" ADD COLUMN "tenant_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_questions" ADD COLUMN "question" text NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_availability" ADD COLUMN "facility_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_availability" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "monday_start" text DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "monday_end" text DEFAULT '17:00';--> statement-breakpoint
ALTER TABLE "holidays" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "holidays" ADD COLUMN "holiday_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "holidays" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "holidays" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "facility_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "appointment_bol_links" ADD CONSTRAINT "appointment_bol_links_appointment_id_schedules_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_bol_links" ADD CONSTRAINT "appointment_bol_links_bol_document_id_bol_documents_id_fk" FOREIGN KEY ("bol_document_id") REFERENCES "public"."bol_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bol_documents" ADD CONSTRAINT "bol_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_analytics" ADD CONSTRAINT "ocr_analytics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_default_hours" ADD CONSTRAINT "organization_default_hours_organization_id_tenants_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_facilities" ADD CONSTRAINT "organization_facilities_organization_id_tenants_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_facilities" ADD CONSTRAINT "organization_facilities_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_holidays" ADD CONSTRAINT "organization_holidays_organization_id_tenants_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_holidays" ADD CONSTRAINT "organization_holidays_holiday_id_holidays_id_fk" FOREIGN KEY ("holiday_id") REFERENCES "public"."holidays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_modules" ADD CONSTRAINT "organization_modules_organization_id_tenants_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_tenants_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "max_concurrent_inbound";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "max_concurrent_outbound";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "share_availability_info";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "sunday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "monday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "tuesday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "wednesday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "thursday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "friday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "saturday";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "sunday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "sunday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "monday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "monday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "tuesday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "tuesday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "wednesday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "wednesday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "thursday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "thursday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "friday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "friday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "saturday_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "saturday_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "sunday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "sunday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "monday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "monday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "tuesday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "tuesday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "wednesday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "wednesday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "thursday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "thursday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "friday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "friday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "saturday_break_start_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "saturday_break_end_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "sunday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "monday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "tuesday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "wednesday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "thursday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "friday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "saturday_max_appointments";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "default_buffer_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "default_grace_period";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "default_email_reminder_time";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "allow_appointments_through_breaks";--> statement-breakpoint
ALTER TABLE "appointment_settings" DROP COLUMN "allow_appointments_past_business_hours";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "color";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "show_remaining_slots";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "grace_period";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "buffer_time";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "max_appointments_per_day";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "max_concurrent";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "email_reminder_time";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "allow_appointments_through_breaks";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "allow_appointments_past_business_hours";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "override_facility_hours";--> statement-breakpoint
ALTER TABLE "appointment_types" DROP COLUMN "timezone";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "file_type";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "file_size";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "uploaded_by";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "welcome_message";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "confirmation_message";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "facilities";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "excluded_appointment_types";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "use_organization_logo";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "custom_logo";--> statement-breakpoint
ALTER TABLE "booking_pages" DROP COLUMN "primary_color";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "manufacturer";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "owner";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "barcode";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "serial_number";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "purchase_price";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "purchase_date";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "warranty_expiration";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "depreciation";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "asset_value";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "location";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "template";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "model";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "condition";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "manufacturer_part_number";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "supplier_name";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "po_number";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "vendor_information";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "photo_url";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "document_urls";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "last_maintenance_date";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "next_maintenance_date";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "maintenance_schedule";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "maintenance_contact";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "maintenance_notes";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "expected_lifetime";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "certification_date";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "certification_expiry";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "company_assets" DROP COLUMN "updated_by";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "label";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "is_required";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "placeholder";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "options";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "default_value";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "order";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "appointment_type_id";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "applicable_type";--> statement-breakpoint
ALTER TABLE "custom_questions" DROP COLUMN "last_modified_at";--> statement-breakpoint
ALTER TABLE "daily_availability" DROP COLUMN "appointment_type_id";--> statement-breakpoint
ALTER TABLE "daily_availability" DROP COLUMN "is_available";--> statement-breakpoint
ALTER TABLE "daily_availability" DROP COLUMN "max_appointments";--> statement-breakpoint
ALTER TABLE "daily_availability" DROP COLUMN "break_start_time";--> statement-breakpoint
ALTER TABLE "daily_availability" DROP COLUMN "break_end_time";--> statement-breakpoint
ALTER TABLE "holidays" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "holidays" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "holidays" DROP COLUMN "last_modified_at";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "truck_number";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "trailer_number";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "driver_name";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "driver_phone";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "driver_email";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "customer_name";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "carrier_name";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "mc_number";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "bol_number";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "po_number";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "pallet_count";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "weight";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "appointment_mode";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "actual_start_time";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "actual_end_time";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "custom_form_data";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "last_modified_by";