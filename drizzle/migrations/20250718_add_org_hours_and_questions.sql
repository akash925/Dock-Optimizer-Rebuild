CREATE TABLE IF NOT EXISTS public.organization_default_hours (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER       NOT NULL,
  day_of_week  SMALLINT      NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TIME          NOT NULL DEFAULT '08:00',
  close_time   TIME          NOT NULL DEFAULT '17:00',
  break_start  TIME,
  break_end    TIME,
  is_open      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_default_hours_uq UNIQUE (tenant_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.appointment_types_questions (
  id                  SERIAL PRIMARY KEY,
  appointment_type_id INTEGER      NOT NULL,
  tenant_id           INTEGER      NOT NULL,
  label               TEXT         NOT NULL,
  field_key           TEXT         NOT NULL,
  field_type          TEXT         NOT NULL DEFAULT 'text',
  required            BOOLEAN      NOT NULL DEFAULT FALSE,
  included            BOOLEAN      NOT NULL DEFAULT TRUE,
  order_position      INTEGER      NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT appointment_types_questions_uq UNIQUE (appointment_type_id, field_key)
);