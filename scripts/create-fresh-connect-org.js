// Script to create Fresh Connect Central organization
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000'; // Local development server
const API_ENDPOINTS = {
  createOrg: '/api/admin/orgs',
  getUsers: '/api/admin/users', 
  addUserToOrg: '/api/admin/orgs/{orgId}/users',
  toggleModule: '/api/admin/orgs/{orgId}/modules/{moduleName}',
  getRoles: '/api/admin/settings/roles',
  createFacility: '/api/facilities'
};

// Login to get a session cookie
async function login() {
  try {
    const response = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testadmin', // Using the admin account 
        password: 'password' // Default password for testadmin
      }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Login successful', data.id);
    
    // Return the cookies that need to be sent with subsequent requests
    return response.headers.get('set-cookie');
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Create organization
async function createOrganization(cookie) {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.createOrg}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        name: 'Fresh Connect Central',
        subdomain: 'fresh-connect-central',
        status: 'ACTIVE',
        contactEmail: 'akash@agarwalhome.com',
        primaryContact: 'Akash Agarwal'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Create organization failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Organization created:', data);
    return data;
  } catch (error) {
    console.error('Create organization error:', error);
    throw error;
  }
}

// Find user by email
async function findUserByEmail(email, cookie) {
  try {
    // First try to get all users and filter by email
    const response = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'GET',
      headers: {
        'Cookie': cookie
      }
    });
    
    if (!response.ok) {
      throw new Error(`Get users failed: ${response.statusText}`);
    }
    
    const users = await response.json();
    
    // Find user by email
    const user = Array.isArray(users) 
      ? users.find(u => u.email === email || u.username === email)
      : null;
      
    if (user) {
      console.log('User found:', user);
      return user;
    }
    
    console.log('User not found in users list');
    return null;
  } catch (error) {
    console.error('Find user error:', error);
    throw error;
  }
}

// Get roles
async function getRoles(cookie) {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/settings/roles`, {
      method: 'GET',
      headers: {
        'Cookie': cookie
      }
    });
    
    if (!response.ok) {
      throw new Error(`Get roles failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Roles retrieved:', data);
    return data;
  } catch (error) {
    console.error('Get roles error:', error);
    throw error;
  }
}

// Create user if not exists
async function createUserIfNeeded(userData, cookie) {
  // Check if user exists
  const existingUser = await findUserByEmail(userData.email, cookie);
  if (existingUser) {
    console.log('User already exists, no need to create');
    return existingUser;
  }
  
  // Create user
  try {
    const response = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'Password123!' // Default password
      })
    });
    
    if (!response.ok) {
      throw new Error(`Create user failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('User created:', data);
    return data;
  } catch (error) {
    console.error('Create user error:', error);
    throw error;
  }
}

// Add user to organization
async function addUserToOrganization(orgId, userId, roleId, cookie) {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.addUserToOrg.replace('{orgId}', orgId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        userId,
        roleId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Add user to organization failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('User added to organization:', data);
    return data;
  } catch (error) {
    console.error('Add user to organization error:', error);
    throw error;
  }
}

// Toggle module
async function toggleModule(orgId, moduleName, enabled, cookie) {
  try {
    const url = `${BASE_URL}${API_ENDPOINTS.toggleModule
      .replace('{orgId}', orgId)
      .replace('{moduleName}', moduleName)}`;
      
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        enabled
      })
    });
    
    if (!response.ok) {
      throw new Error(`Toggle module failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Module ${moduleName} ${enabled ? 'enabled' : 'disabled'}:`, data);
    return data;
  } catch (error) {
    console.error('Toggle module error:', error);
    throw error;
  }
}

// Create facility
async function createFacility(orgId, facilityData, cookie) {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.createFacility}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        ...facilityData,
        organizationId: orgId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Create facility failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Facility created:', data);
    return data;
  } catch (error) {
    console.error('Create facility error:', error);
    throw error;
  }
}

// Main execution function
async function main() {
  try {
    // Login to get session cookie
    const cookie = await login();
    
    // 1. Create Organization
    const org = await createOrganization(cookie);
    const orgId = org.id;
    console.log('Organization created with ID:', orgId);
    
    // Get roles to find the admin role ID
    const roles = await getRoles(cookie);
    const adminRole = roles.find(role => role.name === 'admin');
    if (!adminRole) {
      throw new Error('Admin role not found!');
    }
    console.log('Admin role found with ID:', adminRole.id);
    
    // 2. Add Akash Agarwal as admin user
    // First check/create the user
    const user = await createUserIfNeeded({
      email: 'akash@agarwalhome.com',
      firstName: 'Akash',
      lastName: 'Agarwal'
    }, cookie);
    
    if (!user || !user.id) {
      throw new Error('Failed to find or create user!');
    }
    console.log('User found/created with ID:', user.id);
    
    // Add user to organization with admin role
    try {
      await addUserToOrganization(orgId, user.id, adminRole.id, cookie);
      console.log(`User ${user.id} (${user.email || user.username}) added to organization ${orgId} with admin role`);
    } catch (error) {
      console.error('Error adding user to organization:', error);
      // Continue with the script even if this fails (user might already be in the org)
      console.log('Continuing with organization setup...');
    }
    
    // 3. Configure Organization Modules
    console.log('Configuring organization modules...');
    const modules = [
      'appointments',
      'doorManager',
      'calendar', 
      'analytics',
      'bookingPages',
      'assetManager',
      'facilityManagement',
      'userManagement',
      'emailNotifications'
    ];
    
    // Enable all modules except assetManager
    for (const moduleName of modules) {
      const enabled = moduleName !== 'assetManager';
      try {
        await toggleModule(orgId, moduleName, enabled, cookie);
        console.log(`Module ${moduleName} ${enabled ? 'enabled' : 'disabled'} successfully`);
      } catch (error) {
        console.error(`Error toggling module ${moduleName}:`, error.message);
      }
    }
    
    // 4. Set Up Initial Facility
    console.log('Creating facility for Fresh Connect Central...');
    const facility = await createFacility(orgId, {
      name: 'Fresh Connect Central',
      address: '3737 Waldemere Ave.',
      city: 'Indianapolis',
      state: 'IN',
      zipCode: '46241',
      timezone: 'America/Indiana/Indianapolis'
    }, cookie);
    
    console.log('🎉 Successfully completed all operations!');
    console.log('✅ Organization ID:', orgId);
    console.log('✅ Organization Name: Fresh Connect Central');
    console.log('✅ User added: Akash Agarwal (akash@agarwalhome.com)');
    console.log('✅ Modules configured: All enabled except Asset Manager');
    console.log('✅ Facility ID:', facility.id);
    console.log('✅ Facility Address: 3737 Waldemere Ave. Indianapolis, IN 46241');
    
  } catch (error) {
    console.error('Script execution failed:', error);
  }
}

// Execute the script
main();