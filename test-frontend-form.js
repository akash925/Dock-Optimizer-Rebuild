// Test frontend form submission by accessing the actual page
const puppeteer = require('puppeteer-core');

async function testFrontendBookingForm() {
  console.log('Testing frontend booking form...');
  
  // Since we don't have puppeteer, let's test with a simulated form submission
  const formData = {
    driverName: 'Tony',
    driverPhone: '4082303749',
    driverEmail: 'AKASH@AGARWALHOME.COM',
    truckNumber: 'TR123',
    trailerNumber: 'TL456',
    bolNumber: 'BOL789',
    numberOfPallets: '10',
    shipmentWeight: '2000',
    notes: 'Test booking from frontend'
  };
  
  // Test the payload that would be sent from frontend
  const bookingPayload = {
    facilityId: 1,
    appointmentTypeId: 1,
    date: "2025-07-16",
    time: "09:00",
    timezone: "America/New_York",
    pickupOrDropoff: "pickup",
    customerName: formData.driverName,
    contactName: formData.driverName,
    email: formData.driverEmail,
    phone: formData.driverPhone,
    driverName: formData.driverName,
    driverPhone: formData.driverPhone,
    driverEmail: formData.driverEmail,
    carrierName: 'External Carrier',
    truckNumber: formData.truckNumber,
    trailerNumber: formData.trailerNumber,
    bolNumber: formData.bolNumber,
    mcNumber: '',
    notes: formData.notes,
    customFields: formData
  };

  console.log('Testing booking payload:', JSON.stringify(bookingPayload, null, 2));
  
  const bookingResponse = await fetch('http://localhost:5001/api/booking-pages/test-booking-page/book', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bookingPayload)
  });
  
  const bookingResult = await bookingResponse.json();
  console.log('Booking result:', bookingResult);
  
  return {
    success: bookingResponse.ok,
    result: bookingResult
  };
}

// Test OCR upload
async function testOCRUpload() {
  console.log('Testing OCR upload...');
  
  const fs = require('fs');
  const FormData = require('form-data');
  
  const formData = new FormData();
  formData.append('bolFile', fs.createReadStream('attached_assets/20250414123526782.pdf'));
  formData.append('scheduleId', '226');
  
  try {
    const response = await fetch('http://localhost:5001/api/ocr/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('OCR upload result:', result);
    
    return {
      success: response.ok,
      result: result
    };
  } catch (error) {
    console.error('OCR upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run tests
async function runTests() {
  try {
    console.log('=== FRONTEND FORM TEST ===');
    const formTest = await testFrontendBookingForm();
    
    console.log('\n=== OCR UPLOAD TEST ===');
    const ocrTest = await testOCRUpload();
    
    console.log('\n=== FINAL RESULTS ===');
    console.log('Form submission:', formTest.success ? 'SUCCESS' : 'FAILED');
    console.log('OCR upload:', ocrTest.success ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTests();