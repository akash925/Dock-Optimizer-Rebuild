// Test script to verify frontend authentication flow
console.log("Testing frontend authentication...");

// Test 1: Check if credentials are being sent with requests
async function testCredentials() {
  console.log("Test 1: Testing credentials handling...");
  
  try {
    const response = await fetch('/api/user', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Response status:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);
    
    if (response.ok) {
      const data = await response.json();
      console.log("User data:", data);
      return true;
    } else {
      console.log("Not authenticated, testing login...");
      return false;
    }
  } catch (error) {
    console.error("Error testing credentials:", error);
    return false;
  }
}

// Test 2: Test login flow
async function testLogin() {
  console.log("Test 2: Testing login flow...");
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testadmin',
        password: 'test123'
      })
    });
    
    console.log("Login response status:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Login successful, user data:", data);
      return true;
    } else {
      const error = await response.json();
      console.log("Login failed:", error);
      return false;
    }
  } catch (error) {
    console.error("Error during login:", error);
    return false;
  }
}

// Test 3: Test protected endpoint after login
async function testProtectedEndpoint() {
  console.log("Test 3: Testing protected endpoint...");
  
  try {
    const response = await fetch('/api/organizations/default-hours', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Protected endpoint response status:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Protected endpoint data:", data);
      return true;
    } else {
      const error = await response.json();
      console.log("Protected endpoint failed:", error);
      return false;
    }
  } catch (error) {
    console.error("Error testing protected endpoint:", error);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log("Starting authentication tests...");
  
  let authenticated = await testCredentials();
  
  if (!authenticated) {
    console.log("User not authenticated, attempting login...");
    authenticated = await testLogin();
    
    if (authenticated) {
      console.log("Login successful, testing user endpoint again...");
      await testCredentials();
    }
  }
  
  if (authenticated) {
    console.log("Testing protected endpoint...");
    await testProtectedEndpoint();
  }
  
  console.log("Authentication tests completed!");
}

runTests();