import { fetchWithAuth } from "./client/src/lib/api";

async function testAvailabilityV2Endpoint() {
  try {
    // Login as a test user first (required for authentication)
    const loginResponse = await fetchWithAuth("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testadmin", password: "password123" }),
    });
    
    if (!loginResponse.ok) {
      console.error("Login failed, status:", loginResponse.status);
      return;
    }
    
    console.log("Login successful, testing availability/v2 endpoint...");
    
    // Test the v2 endpoint
    const date = "2025-05-10"; // A Saturday
    const facilityId = 7; // Fresh Connect HQ
    const appointmentTypeId = 17; // 4 Hour Container Appointment (allowAppointmentsThroughBreaks: true)
    
    const v2Response = await fetchWithAuth(`/api/availability/v2?date=${date}&facilityId=${facilityId}&appointmentTypeId=${appointmentTypeId}`);
    
    if (!v2Response.ok) {
      console.error("API request failed, status:", v2Response.status);
      return;
    }
    
    const v2Data = await v2Response.json();
    
    console.log(`Received ${v2Data.slots?.length || 0} slots from v2 endpoint`);
    
    // Log first few slots for inspection
    if (v2Data.slots && v2Data.slots.length > 0) {
      console.log("First 3 slots:", JSON.stringify(v2Data.slots.slice(0, 3), null, 2));
      
      // Check for enhanced properties
      const hasRemainingProp = v2Data.slots.some(slot => "remaining" in slot);
      const hasReasonProp = v2Data.slots.some(slot => "reason" in slot);
      
      console.log("Has remaining property:", hasRemainingProp);
      console.log("Has reason property:", hasReasonProp);
    }
    
  } catch (error) {
    console.error("Error in test:", error);
  }
}

testAvailabilityV2Endpoint();
