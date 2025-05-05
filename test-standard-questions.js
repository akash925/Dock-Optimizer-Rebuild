// Test script to verify standard questions functionality
require('dotenv').config();
const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.HOST_URL || 'https://dockoptimizer.replit.app';
// Using appointment type ID 17 which we know has standard questions
const TEST_APPOINTMENT_TYPE_ID = 17;

// Test 1: Verify standard questions are properly configured for appointment types
async function testStandardQuestionsConfig() {
  console.log('========================================');
  console.log('TEST 1: VERIFY STANDARD QUESTIONS CONFIGURATION');
  console.log('========================================');
  
  try {
    // Fetch the appointment type to confirm it exists
    const appointmentTypeUrl = `${BASE_URL}/api/appointment-types/${TEST_APPOINTMENT_TYPE_ID}`;
    console.log(`Fetching appointment type: ${appointmentTypeUrl}`);
    
    let appointmentType;
    try {
      const response = await fetch(appointmentTypeUrl);
      if (response.ok) {
        appointmentType = await response.json();
        console.log(`✅ Found appointment type: ${appointmentType.name} (ID: ${appointmentType.id})`);
      } else {
        console.error(`❌ Error fetching appointment type: ${response.status} ${response.statusText}`);
        return;
      }
    } catch (error) {
      console.error('❌ Error fetching appointment type:', error.message);
      return;
    }
    
    // Fetch standard questions for this appointment type
    const questionsUrl = `${BASE_URL}/api/standard-questions/${TEST_APPOINTMENT_TYPE_ID}`;
    console.log(`Fetching standard questions: ${questionsUrl}`);
    
    try {
      const response = await fetch(questionsUrl);
      if (response.ok) {
        const questions = await response.json();
        
        if (questions && questions.length > 0) {
          console.log(`✅ Found ${questions.length} standard questions for appointment type ${TEST_APPOINTMENT_TYPE_ID}`);
          
          // Log each question to verify its configuration
          questions.forEach((question, index) => {
            console.log(`\nQuestion ${index + 1}:`);
            console.log(`  Label: ${question.label}`);
            console.log(`  Type: ${question.fieldType}`);
            console.log(`  Key: ${question.fieldKey}`);
            console.log(`  Required: ${question.required ? 'Yes' : 'No'}`);
            console.log(`  Included: ${question.included ? 'Yes' : 'No'}`);
            console.log(`  Order Position: ${question.orderPosition}`);
            
            // Check for any inconsistencies or issues
            if (!question.label) {
              console.warn('⚠️ Warning: Question has no label');
            }
            if (!question.fieldType) {
              console.warn('⚠️ Warning: Question has no field type');
            }
            if (!question.fieldKey) {
              console.warn('⚠️ Warning: Question has no field key');
            }
            // Check if the question's "included" flag is false but "required" is true (inconsistent)
            if (!question.included && question.required) {
              console.warn('⚠️ Warning: Question is marked as required but not included');
            }
          });
          
          // Verify order positions are sequential and unique
          const orderPositions = questions.map(q => q.orderPosition).sort((a, b) => a - b);
          const uniqueOrderPositions = [...new Set(orderPositions)];
          
          if (uniqueOrderPositions.length !== questions.length) {
            console.warn('⚠️ Warning: Some questions have duplicate order positions');
          }
          
          // Check if any questions are included but missing critical properties
          const includedQuestions = questions.filter(q => q.included);
          if (includedQuestions.some(q => !q.fieldType || !q.fieldKey)) {
            console.warn('⚠️ Warning: Some included questions are missing critical properties');
          }
          
          console.log('\n✅ Standard questions verification complete');
        } else {
          console.warn(`⚠️ No standard questions found for appointment type ${TEST_APPOINTMENT_TYPE_ID}`);
        }
      } else {
        console.error(`❌ Error fetching standard questions: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error fetching standard questions:', error.message);
    }
  } catch (error) {
    console.error('❌ Error testing standard questions configuration:', error);
  }
}

// Test 2: Verify external booking form properly includes standard questions
async function testBookingFormQuestions() {
  console.log('\n========================================');
  console.log('TEST 2: VERIFY BOOKING FORM QUESTIONS');
  console.log('========================================');
  
  try {
    // We need to know a booking page that includes our test appointment type
    // For testing, let's try to find one or assume a default
    console.log('Checking for booking pages that include our test appointment type...');
    
    const bookingPagesUrl = `${BASE_URL}/api/booking-pages`;
    
    try {
      const response = await fetch(bookingPagesUrl);
      if (response.ok) {
        const bookingPages = await response.json();
        if (bookingPages && bookingPages.length > 0) {
          console.log(`✅ Found ${bookingPages.length} booking pages`);
          
          // Let's find a booking page that doesn't exclude our test appointment type
          // Note: The API design uses excludedAppointmentTypes, so we need to check if our type is NOT in that list
          const compatiblePages = bookingPages.filter(page => 
            !page.excludedAppointmentTypes || 
            !page.excludedAppointmentTypes.includes(TEST_APPOINTMENT_TYPE_ID)
          );
          
          if (compatiblePages.length > 0) {
            const testPage = compatiblePages[0];
            console.log(`✅ Found compatible booking page: ${testPage.name} (slug: ${testPage.slug})`);
            
            // Now we can test the booking wizard with this page's slug
            const wizardUrl = `${BASE_URL}/${testPage.slug}`;
            console.log(`\nExternal booking wizard URL: ${wizardUrl}`);
            console.log(`To fully test the booking form questions:`);
            console.log(`1. Navigate to the external booking wizard at ${wizardUrl}`);
            console.log(`2. Select appointment type ID ${TEST_APPOINTMENT_TYPE_ID}`);
            console.log(`3. Verify all standard questions appear in the form`);
            console.log(`4. Verify required fields are marked with an asterisk (*)`);
            console.log(`5. Try submitting the form without filling required fields to check validation`);
            
            // Check the API that would be called by the frontend to get questions
            console.log('\nVerifying API for standard questions in the booking form...');
            const bookingQuestionsUrl = `${BASE_URL}/api/booking-pages/${testPage.slug}/standard-questions?appointmentTypeId=${TEST_APPOINTMENT_TYPE_ID}`;
            
            try {
              const questionsResponse = await fetch(bookingQuestionsUrl);
              if (questionsResponse.ok) {
                const bookingQuestions = await questionsResponse.json();
                if (bookingQuestions && bookingQuestions.length > 0) {
                  console.log(`✅ Booking form API returned ${bookingQuestions.length} questions`);
                  
                  // Check which questions are required in the form
                  const requiredQuestions = bookingQuestions.filter(q => q.required);
                  console.log(`✅ ${requiredQuestions.length} questions are marked as required`);
                  
                  // List the required questions
                  if (requiredQuestions.length > 0) {
                    console.log('\nRequired questions in booking form:');
                    requiredQuestions.forEach((q, i) => {
                      console.log(`  ${i+1}. ${q.label} (${q.fieldType})`);
                    });
                  }
                } else {
                  console.warn('⚠️ No questions returned from booking form API');
                }
              } else {
                console.error(`❌ Error fetching booking form questions: ${questionsResponse.status} ${questionsResponse.statusText}`);
              }
            } catch (error) {
              console.error('❌ Error fetching booking form questions:', error.message);
            }
          } else {
            console.warn(`⚠️ No booking pages found that include appointment type ${TEST_APPOINTMENT_TYPE_ID}`);
          }
        } else {
          console.warn('⚠️ No booking pages found');
        }
      } else {
        console.error(`❌ Error fetching booking pages: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error fetching booking pages:', error.message);
    }
  } catch (error) {
    console.error('❌ Error testing booking form questions:', error);
  }
}

// Test 3: Verify questions data is saved with appointment
async function testQuestionDataSaving() {
  console.log('\n========================================');
  console.log('TEST 3: VERIFY QUESTION DATA SAVING');
  console.log('========================================');
  
  console.log('This test requires creating a real appointment and checking its saved data.');
  console.log('To verify question data is properly saved:');
  console.log('\nStep 1: Create a test appointment through the external booking form');
  console.log('  - Fill in all standard questions');
  console.log('  - Submit the form to create the appointment');
  console.log('\nStep 2: Use the admin interface to view the created appointment');
  console.log('  - Check that all question responses are saved in customFormData');
  console.log('  - Verify required questions have valid answers');
  console.log('\nStep 3: Update the appointment');
  console.log('  - Edit some of the question responses');
  console.log('  - Verify changes are saved correctly');
  
  console.log('\nAutomated API test for question data:');
  
  try {
    // First, we'll check if we can find any existing appointments that use our test appointment type
    // This assumes you have authentication to access this endpoint
    const scheduleUrl = `${BASE_URL}/api/schedules?appointmentTypeId=${TEST_APPOINTMENT_TYPE_ID}&limit=1`;
    
    try {
      const response = await fetch(scheduleUrl);
      if (response.ok) {
        const schedules = await response.json();
        if (schedules && schedules.length > 0) {
          console.log(`✅ Found an existing appointment with type ID ${TEST_APPOINTMENT_TYPE_ID}`);
          const testAppointment = schedules[0];
          
          // Check if this appointment has customFormData
          if (testAppointment.customFormData) {
            console.log(`✅ Appointment has customFormData:`);
            console.log(JSON.stringify(testAppointment.customFormData, null, 2));
            
            // Count the number of questions answered
            const questionCount = Object.keys(testAppointment.customFormData).length;
            console.log(`✅ Appointment has answers for ${questionCount} questions`);
          } else {
            console.warn('⚠️ Appointment does not have customFormData');
          }
        } else {
          console.log(`ℹ️ No existing appointments found with type ID ${TEST_APPOINTMENT_TYPE_ID}`);
          console.log('Please create a test appointment to verify question data saving');
        }
      } else {
        console.log(`ℹ️ Cannot access schedule data: ${response.status} ${response.statusText}`);
        console.log('Please manually verify question data saving');
      }
    } catch (error) {
      console.log('ℹ️ Cannot access schedule data:', error.message);
      console.log('Please manually verify question data saving');
    }
  } catch (error) {
    console.error('❌ Error testing question data saving:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting standard questions verification tests...');
  console.log(`Using base URL: ${BASE_URL}`);
  console.log(`Test appointment type ID: ${TEST_APPOINTMENT_TYPE_ID}`);
  console.log('----------------------------------------');
  
  await testStandardQuestionsConfig();
  await testBookingFormQuestions();
  await testQuestionDataSaving();
  
  console.log('\n========================================');
  console.log('SUMMARY OF STANDARD QUESTIONS VERIFICATION TESTS');
  console.log('========================================');
  console.log('These tests verify:');
  console.log('1. Standard questions are properly configured for appointment types');
  console.log('2. Booking form includes the correct standard questions');
  console.log('3. Question data is properly saved with appointments');
  console.log('\nTo fully verify the end-to-end process:');
  console.log('1. Create a real appointment through the external booking form');
  console.log('2. Fill in all standard questions, especially required ones');
  console.log('3. Check the database to verify all answers are saved correctly');
  console.log('4. Update the appointment and verify changes are saved');
}

// Export the tests for the main verification script
module.exports = {
  runTests: runAllTests
};

// Run the tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}