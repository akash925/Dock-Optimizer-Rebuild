/**
 * This script adds default standard questions to appointment types
 * Run this script once to initialize the question bank for all existing appointment types
 */

import { db } from '../server/db.js';
import { standardQuestions, appointmentTypes } from '../shared/schema.js';

async function addDefaultQuestions() {
  try {
    console.log('Starting to add default questions to appointment types...');
    
    // Get all appointment types
    const allAppointmentTypes = await db.select().from(appointmentTypes);
    console.log(`Found ${allAppointmentTypes.length} appointment types`);
    
    // Define default standard questions
    const defaultQuestions = [
      {
        label: 'Driver Name',
        fieldKey: 'driverName',
        fieldType: 'TEXT',
        required: true,
        included: true,
        orderPosition: 1,
        options: null
      },
      {
        label: 'Driver Phone',
        fieldKey: 'driverPhone',
        fieldType: 'PHONE',
        required: true, 
        included: true,
        orderPosition: 2,
        options: null
      },
      {
        label: 'Truck Number',
        fieldKey: 'truckNumber',
        fieldType: 'TEXT',
        required: false,
        included: true,
        orderPosition: 3,
        options: null
      },
      {
        label: 'Trailer Number',
        fieldKey: 'trailerNumber',
        fieldType: 'TEXT',
        required: false,
        included: true,
        orderPosition: 4,
        options: null
      },
      {
        label: 'BOL Number',
        fieldKey: 'bolNumber',
        fieldType: 'TEXT',
        required: false,
        included: true,
        orderPosition: 5,
        options: null
      },
      {
        label: 'Number of Pallets',
        fieldKey: 'palletCount',
        fieldType: 'NUMBER',
        required: false,
        included: true,
        orderPosition: 6,
        options: null
      },
      {
        label: 'Shipment Weight (lbs)',
        fieldKey: 'weight',
        fieldType: 'NUMBER',
        required: false,
        included: true,
        orderPosition: 7,
        options: null
      },
      {
        label: 'Special Instructions',
        fieldKey: 'specialInstructions',
        fieldType: 'TEXTAREA',
        required: false,
        included: true,
        orderPosition: 8,
        options: null
      }
    ];
    
    // For each appointment type, add the default questions if they don't exist
    for (const appointmentType of allAppointmentTypes) {
      console.log(`Processing appointment type ${appointmentType.id}: ${appointmentType.name}`);
      
      // Check for existing questions
      const existingQuestions = await db
        .select()
        .from(standardQuestions)
        .where({ appointmentTypeId: appointmentType.id });
      
      console.log(`  Found ${existingQuestions.length} existing questions`);
      
      // If no questions exist, add the defaults
      if (existingQuestions.length === 0) {
        console.log(`  Adding ${defaultQuestions.length} default questions`);
        
        // Add each default question
        for (const question of defaultQuestions) {
          await db.insert(standardQuestions).values({
            ...question,
            appointmentTypeId: appointmentType.id
          });
        }
        
        console.log(`  Successfully added default questions to appointment type ${appointmentType.id}`);
      } else {
        console.log(`  Skipping: This appointment type already has questions defined`);
      }
    }
    
    console.log('Default questions have been added successfully!');
  } catch (error) {
    console.error('Error adding default questions:', error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the script
addDefaultQuestions();