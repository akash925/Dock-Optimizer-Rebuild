# Manual Steps to Create Fresh Connect Central Organization

## Prerequisites
- Login to the system as an admin user (testadmin/password)
- Navigate to the Admin Console by clicking "Admin Console" in the main navigation

## Step 1: Create the Organization
1. Go to the "Organizations" tab in the Admin Console
2. Click the "Add Organization" button at the top-right of the page
3. Fill in the organization details in the modal that appears:
   - Name: Fresh Connect Central
   - Subdomain: fresh-connect-central
   - Status: ACTIVE
   - Contact Email: akash@agarwalhome.com
   - Primary Contact: Akash Agarwal
   - Phone: 317-555-1234 (optional)
4. Click "Create Organization" button at the bottom of the modal
5. Wait for the confirmation message that the organization was created successfully

## Step 2: Add Akash as a User (if not already in the system)
1. Go to the "Users" tab in the Admin Console
2. Check if a user with email "akash@agarwalhome.com" already exists in the user list
3. If not found, click the "Add User" button at the top-right
4. Fill in the user details in the modal:
   - First Name: Akash
   - Last Name: Agarwal
   - Email: akash@agarwalhome.com
   - Username: akash.agarwal (if required)
   - Password: Password123!
   - Confirm Password: Password123!
5. Click "Create User" button
6. Verify the user appears in the users list

## Step 3: Add Akash to the Fresh Connect Central Organization
1. Return to the "Organizations" tab in the Admin Console
2. Find "Fresh Connect Central" in the list and click the "View Details" or "Manage" button next to it
3. In the organization details view, navigate to the "Users" tab
4. Click "Add User to Organization" button
5. In the modal that appears:
   - Select "Akash Agarwal" from the user dropdown menu
   - Select "Admin" from the role dropdown menu
   - If available, you may need to check "Active" status
6. Click "Add User" button
7. Verify the user appears in the organization's user list with the Admin role

## Step 4: Configure Organization Modules
1. While still in the organization details view for Fresh Connect Central, go to the "Modules" tab
2. You should see a list of available modules with toggle switches
3. Enable ALL modules EXCEPT "Asset Manager":
   - Appointments ✓
   - Door Manager ✓
   - Calendar ✓
   - Analytics ✓
   - Booking Pages ✓
   - Asset Manager ✗ (leave disabled)
   - Facility Management ✓
   - User Management ✓
   - Email Notifications ✓
4. For each module, click the toggle switch to turn it ON (the toggle should turn green)
5. After configuring all modules, look for a "Save" or "Apply Changes" button and click it
   - Note: Some systems may save each toggle individually without a global save button

## Step 5: Create Initial Facility
1. Navigate back to the main dashboard (exit Admin Console)
2. Click on "Facilities" in the main navigation
3. Click the "Add Facility" or "New Facility" button
4. Fill in the facility form with these details:
   - Name: Fresh Connect Central
   - Organization: Fresh Connect Central (select from dropdown if available)
   - Address: 3737 Waldemere Ave.
   - City: Indianapolis
   - State: IN
   - Zip Code: 46241
   - Country: USA
   - Timezone: America/Indiana/Indianapolis
   - Status: Active
5. If there are additional fields for facility hours:
   - Set operating hours for weekdays from 8:00 AM to 6:00 PM
   - Set weekend hours as closed or as appropriate
6. Click "Create Facility" or "Save" button
7. Wait for confirmation message and verify the facility appears in the facilities list

## Verification Steps
After completing all the steps above, perform these checks:

1. **Organization Check**:
   - Go to Admin Console → Organizations
   - Verify "Fresh Connect Central" appears in the list
   - Check that its status shows as "ACTIVE"

2. **User Assignment Check**:
   - Go to Admin Console → Organizations → Fresh Connect Central → Users
   - Verify "Akash Agarwal" appears with "Admin" role

3. **Module Configuration Check**:
   - Go to Admin Console → Organizations → Fresh Connect Central → Modules
   - Verify all modules are enabled EXCEPT "Asset Manager"

4. **Facility Check**:
   - Go to main dashboard → Facilities
   - Verify "Fresh Connect Central" facility appears in the list
   - Click on it to ensure all details were saved correctly

5. **Login Test (optional)**:
   - If possible, log out and try logging in as Akash Agarwal
   - Verify they can access the Fresh Connect Central organization

## Troubleshooting
- If any step fails, check error messages and review your inputs
- For missing users or roles, check with system administrator
- If modules don't appear after enabling, try refreshing the page
- If the facility doesn't appear in the list, verify it's associated with the correct organization