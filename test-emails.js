// Script to test email templates
import('./server/email-test.js').catch(err => {
  console.error('Error importing email test module:', err);
  
  // Try with TypeScript extension
  import('./server/email-test.ts').catch(err2 => {
    console.error('Error importing with .ts extension:', err2);
    console.error('Make sure the email-test module exists and is properly exported');
  });
});