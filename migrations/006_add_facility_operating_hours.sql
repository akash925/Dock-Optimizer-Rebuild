-- Add operating hours columns to facilities table

-- Monday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS monday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS monday_end TEXT DEFAULT '17:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS monday_break_start TEXT DEFAULT '12:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS monday_break_end TEXT DEFAULT '13:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS monday_open BOOLEAN DEFAULT true;

-- Tuesday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tuesday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tuesday_end TEXT DEFAULT '17:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tuesday_break_start TEXT DEFAULT '12:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tuesday_break_end TEXT DEFAULT '13:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tuesday_open BOOLEAN DEFAULT true;

-- Wednesday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS wednesday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS wednesday_end TEXT DEFAULT '17:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS wednesday_break_start TEXT DEFAULT '12:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS wednesday_break_end TEXT DEFAULT '13:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS wednesday_open BOOLEAN DEFAULT true;

-- Thursday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS thursday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS thursday_end TEXT DEFAULT '17:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS thursday_break_start TEXT DEFAULT '12:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS thursday_break_end TEXT DEFAULT '13:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS thursday_open BOOLEAN DEFAULT true;

-- Friday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS friday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS friday_end TEXT DEFAULT '17:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS friday_break_start TEXT DEFAULT '12:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS friday_break_end TEXT DEFAULT '13:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS friday_open BOOLEAN DEFAULT true;

-- Saturday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS saturday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS saturday_end TEXT DEFAULT '13:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS saturday_break_start TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS saturday_break_end TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS saturday_open BOOLEAN DEFAULT false;

-- Sunday
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS sunday_start TEXT DEFAULT '08:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS sunday_end TEXT DEFAULT '17:00';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS sunday_break_start TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS sunday_break_end TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS sunday_open BOOLEAN DEFAULT false;