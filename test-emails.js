// Script to test email templates
import('./server/email-test.js')
  .then(module => {
    // Use the test email address here
    const testEmail = 'test@example.com';
    
    // Run the confirmation email test
    console.log('Starting confirmation email test...');
    module.testConfirmationEmail(testEmail)
      .then(() => {
        console.log('Confirmation email test completed.');
        
        // Run the reminder email test
        console.log('\nStarting reminder email test...');
        return module.testReminderEmail(testEmail, 24);
      })
      .then(() => {
        console.log('Reminder email test completed.');
        console.log('\nAll email tests completed successfully!');
      })
      .catch(err => {
        console.error('Error during email tests:', err);
      });
  })
  .catch(err => {
    console.error('Error importing email test module:', err);
    
    // Try with TypeScript extension
    import('./server/email-test.ts').catch(err2 => {
      console.error('Error importing with .ts extension:', err2);
      console.error('Make sure the email-test module exists and is properly exported');
    });
  });