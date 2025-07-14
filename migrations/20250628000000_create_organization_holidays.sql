CREATE TABLE IF NOT EXISTS organization_holidays (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  holiday_date DATE NOT NULL,
  description TEXT DEFAULT ''
); 