-- Create Fresh Connect Central organization
INSERT INTO organizations (name, subdomain, status, contact_email, primary_contact, created_at, updated_at)
VALUES ('Fresh Connect Central', 'fresh-connect-central', 'ACTIVE', 'akash@agarwalhome.com', 'Akash Agarwal', NOW(), NOW())
RETURNING id;

-- Create or find user Akash Agarwal
WITH user_check AS (
    SELECT id FROM users WHERE email = 'akash@agarwalhome.com'
),
inserted_user AS (
    INSERT INTO users (email, first_name, last_name, password, created_at)
    SELECT 'akash@agarwalhome.com', 'Akash', 'Agarwal', 
           -- Using a default hashed password 'Password123!'
           'e863c76f34f349cb366247071aa085253d18457b8d08df53028dedd480208b512bf2bc2bfe0598cfdb18cdd0752432fe8b6d19b575fb2deebb588d5048ed9e4b.47d60c67a9377d7a8fa6a24cfdedb11a',
           NOW()
    WHERE NOT EXISTS (SELECT 1 FROM user_check)
    RETURNING id
)
SELECT id FROM user_check
UNION ALL
SELECT id FROM inserted_user;

-- Get organization ID
WITH org_id AS (
    SELECT id FROM organizations WHERE name = 'Fresh Connect Central'
),
-- Get user ID
user_id AS (
    SELECT id FROM users WHERE email = 'akash@agarwalhome.com'
),
-- Get admin role ID
role_id AS (
    SELECT id FROM roles WHERE name = 'admin'
)
-- Add user to organization
INSERT INTO organization_users (organization_id, user_id, role_id)
SELECT org.id, u.id, r.id
FROM org_id org, user_id u, role_id r
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Get organization ID again for module setup
WITH org_id AS (
    SELECT id FROM organizations WHERE name = 'Fresh Connect Central'
)
-- Enable modules for the organization
INSERT INTO organization_modules (organization_id, module_name, enabled, created_at, updated_at)
SELECT org.id, m.module_name, 
       CASE WHEN m.module_name = 'companyAssets' THEN FALSE ELSE TRUE END as enabled,
       NOW(), NOW()
FROM org_id org
CROSS JOIN (
    VALUES ('appointments'),
           ('doorManager'),
           ('calendar'),
           ('analytics'),
           ('bookingPages'),
           ('companyAssets'),
           ('facilityManagement'),
           ('userManagement'),
           ('emailNotifications')
) as m(module_name)
ON CONFLICT (organization_id, module_name) DO UPDATE
SET enabled = EXCLUDED.enabled, updated_at = NOW();

-- Create facility for the organization
WITH org_id AS (
    SELECT id FROM organizations WHERE name = 'Fresh Connect Central'
)
INSERT INTO facilities (
    name, address, city, state, zip_code, timezone,
    organization_id, created_at, updated_at
)
SELECT 
    'Fresh Connect Central', 
    '3737 Waldemere Ave.', 
    'Indianapolis', 
    'IN', 
    '46241', 
    'America/Indiana/Indianapolis',
    org.id,
    NOW(), NOW()
FROM org_id org
RETURNING id;