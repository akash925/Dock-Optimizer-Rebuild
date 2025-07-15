import { getStorage } from "../storage";
import bcrypt from 'bcryptjs';

async function testPasswordHashing() {
  try {
    console.log("🔍 TESTING PASSWORD HASHING DIRECTLY");
    console.log("=".repeat(50));
    
    const storage = await getStorage();
    
    // Test 1: Hash password with bcrypt manually
    const plainPassword = "testpassword123";
    const bcryptHash = await bcrypt.hash(plainPassword, 12);
    
    console.log("Step 1: Manual bcrypt hash");
    console.log(`  Plain password: ${plainPassword}`);
    console.log(`  Bcrypt hash: ${bcryptHash}`);
    console.log(`  Starts with $2b$: ${bcryptHash.startsWith('$2b$')}`);
    console.log(`  Length: ${bcryptHash.length}`);
    
    // Test 2: Create user with pre-hashed password
    console.log("\nStep 2: Creating user with pre-hashed password");
    const newUser = await storage.createUser({
      username: "hashdirecttest",
      email: "hashdirecttest@example.com",
      password: bcryptHash, // Pre-hashed
      firstName: "Hash",
      lastName: "Direct",
      role: "user",
      tenantId: null
    });
    
    console.log(`  Created user ID: ${newUser.id}`);
    console.log(`  Stored password starts with $2b$: ${newUser.password.startsWith('$2b$')}`);
    console.log(`  Stored password length: ${newUser.password.length}`);
    console.log(`  Password hash: ${newUser.password.substring(0, 20)}...`);
    
    // Test 3: Verify login with the original plain password
    console.log("\nStep 3: Testing login with original password");
    const loginTest = await bcrypt.compare(plainPassword, newUser.password);
    console.log(`  Login test result: ${loginTest ? 'SUCCESS' : 'FAILED'}`);
    
    console.log("\n" + "=".repeat(50));
    console.log("SUMMARY:");
    console.log(`✅ User created with ID: ${newUser.id}`);
    console.log(`${newUser.password.startsWith('$2b$') ? '✅' : '❌'} Password uses bcrypt format`);
    console.log(`${loginTest ? '✅' : '❌'} Password verification works`);
    
  } catch (error) {
    console.error("❌ Error during password hashing test:", error);
    throw error;
  }
}

// Run the test
testPasswordHashing()
  .then(() => {
    console.log("✅ Password hashing test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Password hashing test failed:", error);
    process.exit(1);
  }); 