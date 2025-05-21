import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useNavigate } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SeedQuestionsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const seedQuestions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. First, fetch all appointment types
      const appointmentTypesResponse = await fetch('/api/appointment-types');
      if (!appointmentTypesResponse.ok) {
        throw new Error(`Failed to fetch appointment types: ${appointmentTypesResponse.statusText}`);
      }
      
      const appointmentTypes = await appointmentTypesResponse.json();
      console.log(`Found ${appointmentTypes.length} appointment types to process`);
      
      // 2. For each appointment type, check if it has questions and add default ones if not
      let addedCount = 0;
      let skippedCount = 0;
      
      for (const appointmentType of appointmentTypes) {
        // Check if there are existing questions for this appointment type
        const existingQuestionsResponse = await fetch(`/api/standard-questions/appointment-type/${appointmentType.id}`);
        const existingQuestions = await existingQuestionsResponse.json();
        
        if (existingQuestions.length === 0) {
          console.log(`Adding questions for appointment type ${appointmentType.id} (${appointmentType.name})`);
          
          // Add default questions for this appointment type
          for (const question of defaultQuestions) {
            const response = await fetch('/api/standard-questions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...question,
                appointmentTypeId: appointmentType.id
              })
            });
            
            if (!response.ok) {
              console.error(`Failed to add question "${question.label}" to appointment type ${appointmentType.id}`);
              continue;
            }
          }
          
          addedCount++;
        } else {
          console.log(`Skipping appointment type ${appointmentType.id} (${appointmentType.name}) - already has ${existingQuestions.length} questions`);
          skippedCount++;
        }
      }
      
      setIsSuccess(true);
      toast({
        title: "Questions Added Successfully",
        description: `Added default questions to ${addedCount} appointment types. Skipped ${skippedCount} appointment types that already had questions.`,
      });
    } catch (err: any) {
      console.error('Error seeding questions:', err);
      setError(err.message || 'An error occurred while seeding questions');
      toast({
        title: "Error",
        description: `Failed to seed questions: ${err.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Seed Standard Questions</CardTitle>
          <CardDescription>
            Add default questions to appointment types that don't have any questions configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This utility will add common standard questions like Driver Name, BOL Number, and Trailer Number to all appointment types that don't currently have questions configured.
          </p>
          
          {isSuccess && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Default questions have been added to appointment types. You can now manage them in the Appointment Master.
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => navigate('/appointment-master')}>
            Cancel
          </Button>
          <Button onClick={seedQuestions} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Add Default Questions'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}