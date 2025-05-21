import { db } from './db';
import { standardQuestions } from '@shared/schema';
import { eq } from 'drizzle-orm';
// Import directly from the module where storage is created and exposed
import storage from './storage';

/**
 * This script adds or updates the Driver/Dispatcher Email field as required
 * in all appointment types to ensure confirmation emails work properly
 */
export async function addEmailField() {
  try {
    console.log('Starting email field update process...');
    
    // Get all appointment types
    const appointmentTypes = await storage.getAllAppointmentTypes();
    console.log(`Found ${appointmentTypes.length} appointment types to process`);
    
    for (const type of appointmentTypes) {
      // Check if email field already exists for this appointment type
      const existingQuestions = await storage.getStandardQuestionsByAppointmentType(type.id);
      console.log(`Processing appointment type: ${type.id} - ${type.name} - Found ${existingQuestions.length} existing questions`);
      
      // Look for an existing email field
      const emailField = existingQuestions.find(q => 
        q.fieldType === 'EMAIL' && 
        (q.fieldKey === 'driverEmail' || q.fieldKey === 'contactEmail' || q.label.toLowerCase().includes('email'))
      );
      
      if (emailField) {
        console.log(`Email field already exists for appointment type ${type.id}: ${emailField.label} (ID: ${emailField.id})`);
        
        // Make sure it's marked as required and included
        if (!emailField.required || !emailField.included) {
          console.log(`Updating email field ${emailField.id} - Setting required=true, included=true`);
          
          await db.update(standardQuestions)
            .set({ 
              required: true, 
              included: true 
            })
            .where(eq(standardQuestions.id, emailField.id));
            
          console.log(`Email field ${emailField.id} updated successfully`);
        }
      } else {
        // Need to add a new email field
        console.log(`Adding new Driver/Dispatcher Email field for appointment type ${type.id}`);
        
        // Find the highest order position to add this after existing questions
        const maxOrder = existingQuestions.length > 0 
          ? Math.max(...existingQuestions.map(q => q.orderPosition || 0)) 
          : 0;
        
        const newEmailField = {
          appointmentTypeId: type.id,
          fieldKey: 'driverEmail',
          label: 'Driver/Dispatcher Email',
          fieldType: 'EMAIL' as const,
          included: true,
          required: true,
          orderPosition: maxOrder + 1
        };
        
        const result = await storage.createStandardQuestion(newEmailField);
        console.log(`Added new email field for appointment type ${type.id} with ID ${result.id}`);
      }
    }
    
    console.log('Email field update process completed successfully');
    return { success: true, message: 'Driver/Dispatcher Email field added or updated for all appointment types' };
  } catch (error) {
    console.error('Error in email field update process:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
}