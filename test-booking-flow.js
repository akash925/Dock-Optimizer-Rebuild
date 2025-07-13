// Simple test to check the booking flow
const testBookingFlow = async () => {
  try {
    // Step 1: Test the booking page loads
    const pageResponse = await fetch('http://localhost:5001/external/test-booking-page');
    console.log('Page response status:', pageResponse.status);
    
    // Step 2: Test the booking API directly
    const bookingData = {
      facilityId: 1,
      appointmentTypeId: 1,
      date: "2025-07-16",
      time: "15:00",
      driverName: "Test Driver",
      driverPhone: "555-123-4567",
      driverEmail: "test@example.com",
      truckNumber: "TEST123",
      trailerNumber: "TRL456",
      bolNumber: "BOL789",
      notes: "Test booking from script"
    };
    
    const bookingResponse = await fetch('http://localhost:5001/api/booking-pages/test-booking-page/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData)
    });
    
    const bookingResult = await bookingResponse.json();
    console.log('Booking API response:', bookingResult);
    
    // Step 3: Test standard questions API
    const questionsResponse = await fetch('http://localhost:5001/api/booking-pages/standard-questions/appointment-type/1');
    const questionsResult = await questionsResponse.json();
    console.log('Standard questions count:', questionsResult.length);
    
    return {
      pageLoads: pageResponse.ok,
      bookingWorks: bookingResponse.ok,
      questionsWork: questionsResponse.ok,
      bookingResult,
      questionsCount: questionsResult.length
    };
    
  } catch (error) {
    console.error('Test failed:', error);
    return { error: error.message };
  }
};

// Run the test
testBookingFlow().then(result => {
  console.log('\n=== BOOKING FLOW TEST RESULTS ===');
  console.log(JSON.stringify(result, null, 2));
});